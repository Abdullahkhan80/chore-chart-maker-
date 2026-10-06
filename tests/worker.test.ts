// Redirect and 404 behavior of the Cloudflare Worker, with a fake ASSETS binding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../src/worker.ts';

/** Paths the fake asset server knows; anything else is a 404. */
const ASSET_PATHS = new Set(['/', '/about/', '/chore-chart-maker/', '/chores-for-5-year-olds/', '/favicon.svg', '/robots.txt']);

const env: Env = {
  ASSETS: {
    async fetch(request: Request) {
      const { pathname } = new URL(request.url);
      return ASSET_PATHS.has(pathname)
        ? new Response(`asset ${pathname}`, { status: 200 })
        : new Response('not found page', { status: 404 });
    },
  },
};

const get = (url: string) => worker.fetch(new Request(url), env);

async function assertRedirect(from: string, to: string) {
  const response = await get(from);
  assert.equal(response.status, 301, `${from} status`);
  assert.equal(response.headers.get('location'), to, `${from} location`);
}

async function assertServed(url: string, status: number) {
  const response = await get(url);
  assert.equal(response.status, status, `${url} status`);
  assert.equal(response.headers.get('location'), null, `${url} should not redirect`);
}

test('http → https on the apex', async () => {
  await assertRedirect('http://chorechartmaker.com/about/', 'https://chorechartmaker.com/about/');
  await assertRedirect('http://chorechartmaker.com/', 'https://chorechartmaker.com/');
});

test('www → apex, keeping path and query', async () => {
  await assertRedirect('https://www.chorechartmaker.com/about/?ref=x', 'https://chorechartmaker.com/about/?ref=x');
  await assertRedirect('https://www.chorechartmaker.com/', 'https://chorechartmaker.com/');
});

test('http + www + missing slash collapse into one redirect', async () => {
  await assertRedirect('http://www.chorechartmaker.com/about', 'https://chorechartmaker.com/about/');
});

test('missing trailing slash on an existing page → 301 with slash', async () => {
  await assertRedirect('https://chorechartmaker.com/about', 'https://chorechartmaker.com/about/');
  await assertRedirect(
    'https://chorechartmaker.com/chores-for-5-year-olds?utm_source=x',
    'https://chorechartmaker.com/chores-for-5-year-olds/?utm_source=x',
  );
});

test('/index.html → directory URL', async () => {
  await assertRedirect('https://chorechartmaker.com/about/index.html', 'https://chorechartmaker.com/about/');
  await assertRedirect('https://chorechartmaker.com/index.html', 'https://chorechartmaker.com/');
});

test('canonical URLs and files are served without redirects', async () => {
  await assertServed('https://chorechartmaker.com/', 200);
  await assertServed('https://chorechartmaker.com/chore-chart-maker/', 200);
  await assertServed('https://chorechartmaker.com/favicon.svg', 200);
  await assertServed('https://chorechartmaker.com/robots.txt', 200);
});

test('unknown paths return a real 404, not a redirect', async () => {
  await assertServed('https://chorechartmaker.com/does-not-exist', 404);
  await assertServed('https://chorechartmaker.com/does-not-exist/', 404);
  await assertServed('https://chorechartmaker.com/missing.png', 404);
});

test('preview hosts are not forced to https or the apex', async () => {
  await assertServed('http://localhost:8787/about/', 200);
  await assertRedirect('http://localhost:8787/about', 'http://localhost:8787/about/');
  await assertServed('https://chorechartmaker.example.workers.dev/', 200);
});

test('asset server that throws returns 500 page with status 500', async () => {
  const throwingEnv: Env = {
    ASSETS: {
      async fetch(request: Request) {
        const { pathname } = new URL(request.url);
        if (pathname === '/500.html') {
          return new Response('<!doctype html><title>Error 500</title>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        }
        throw new Error('asset server failure');
      },
    },
  };
  const response = await worker.fetch(new Request('https://chorechartmaker.com/'), throwingEnv);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '<!doctype html><title>Error 500</title>');
});

test('asset server returning 503 returns 500 page with status 500', async () => {
  const failingEnv: Env = {
    ASSETS: {
      async fetch(request: Request) {
        const { pathname } = new URL(request.url);
        if (pathname === '/500.html') {
          return new Response('<!doctype html><title>Error 500</title>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        }
        return new Response('Service Unavailable', { status: 503 });
      },
    },
  };
  const response = await worker.fetch(new Request('https://chorechartmaker.com/'), failingEnv);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '<!doctype html><title>Error 500</title>');
});

test('falls back to plain-text 500 if fetching /500.html also fails', async () => {
  const completelyFailingEnv: Env = {
    ASSETS: {
      async fetch() {
        throw new Error('total storage crash');
      },
    },
  };
  const response = await worker.fetch(new Request('https://chorechartmaker.com/'), completelyFailingEnv);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
  assert.equal(await response.text(), 'Internal Server Error');
});

