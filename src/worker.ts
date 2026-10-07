// Cloudflare Worker: canonical redirects in front of the static assets in dist/.
// Pure TypeScript (no Workers-only imports) so Node can import it in tests.

export const APEX_HOST = 'chorechartmaker.com';
const PRODUCTION_HOSTS = new Set([APEX_HOST, `www.${APEX_HOST}`]);

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function hasFileExtension(pathname: string): boolean {
  return pathname.slice(pathname.lastIndexOf('/') + 1).includes('.');
}

/** True when the asset server has a page at `url` (used before adding a trailing slash). */
async function pageExists(env: Env, url: URL): Promise<boolean> {
  const response = await env.ASSETS.fetch(new Request(url, { method: 'HEAD' }));
  return response.ok;
}

async function serve500(env: Env, request: Request): Promise<Response> {
  try {
    const response = await env.ASSETS.fetch(new Request(new URL('/500.html', request.url)));
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: 500, headers });
    }
  } catch {
    // If fetching /500.html fails, fall through to plain text.
  }
  return new Response('Internal Server Error', {
    status: 500,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const target = new URL(url);

      // http → https and www → apex, only on production hosts (not localhost or *.workers.dev).
      if (PRODUCTION_HOSTS.has(url.hostname)) {
        target.protocol = 'https:';
        target.hostname = APEX_HOST;
        target.port = '';
      }

      // /foo/index.html → /foo/
      if (target.pathname.endsWith('/index.html')) {
        target.pathname = target.pathname.slice(0, -'index.html'.length);
      } else if (!target.pathname.endsWith('/') && !hasFileExtension(target.pathname)) {
        // /foo → /foo/, but only if /foo/ exists; unknown paths fall through to a real 404.
        const withSlash = new URL(url);
        withSlash.pathname += '/';
        if (await pageExists(env, withSlash)) target.pathname += '/';
      }

      if (target.href !== url.href) {
        return Response.redirect(target.href, 301);
      }

      // Unknown paths get dist/404.html with a 404 status (not_found_handling = "404-page").
      const response = await env.ASSETS.fetch(request);
      if (response.status >= 500) {
        return await serve500(env, request);
      }
      if (response.ok) {
        const headers = new Headers(response.headers);
        if (target.pathname.startsWith('/_astro/')) {
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (target.pathname.startsWith('/fonts/')) {
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (target.pathname.startsWith('/icons/') || target.pathname.startsWith('/ui/')) {
          headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        } else if (target.pathname.endsWith('/') || target.pathname.endsWith('.html') || !hasFileExtension(target.pathname)) {
          headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      return response;
    } catch {
      return await serve500(env, request);
    }
  },
};

