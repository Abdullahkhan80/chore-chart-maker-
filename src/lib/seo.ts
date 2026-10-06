// SEO config, canonical URLs and JSON-LD builders.
// Pure TypeScript (no Astro/Vite syntax) so Node can import it in tests.

export const SITE_CONFIG = {
  name: 'Chore Chart Maker',
  alternateName: 'chorechartmaker.com',
  domain: 'chorechartmaker.com',
  email: 'hello@chorechartmaker.com',
  url: 'https://chorechartmaker.com',
  defaultTitle: 'Free Printable Chore Charts for Kids & Families',
  defaultDescription:
    'Make free printable chore charts, reward charts and routine charts for kids and families. No sign-up, nothing to install, and your info stays in your browser.',
  locale: 'en_US',
  language: 'en-US',
  themeColor: { light: '#0f766e', dark: '#0b1220' },
  logo: { path: '/logo.png', width: 512, height: 512 },
  ogImage: { path: '/og-default.png', width: 1200, height: 630, alt: 'Chore Chart Maker: free printable chore charts' },
  // TODO: add the brand's social profile URLs once they exist.
  socialUrls: [] as string[],
  author: {
    name: 'Abdullah',
    path: '/about/',
    sameAs: ['https://abdullahsystems.com'],
  },
} as const;

export type JsonLd = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';
const ORGANIZATION_ID = `${SITE_CONFIG.url}/#organization`;
const WEBSITE_ID = `${SITE_CONFIG.url}/#website`;
const PERSON_ID = `${SITE_CONFIG.url}${SITE_CONFIG.author.path}#person`;

/**
 * Absolute https URL on the apex domain with a trailing slash on page paths.
 * Accepts a path ("/about", "about/") or a full URL on any host/protocol.
 */
export function buildCanonicalUrl(pathOrUrl: string): string {
  const url = new URL(pathOrUrl, SITE_CONFIG.url);
  let pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/index\.html$/, '/');
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!pathname.endsWith('/') && !lastSegment.includes('.')) pathname += '/';
  return `https://${SITE_CONFIG.domain}${pathname}`;
}

/** Absolute URL for a static asset such as an image (no trailing slash added). */
export function buildAssetUrl(path: string): string {
  return new URL(path, `https://${SITE_CONFIG.domain}`).href;
}


// U+2028/U+2029 are valid in JSON but were line terminators in older JS engines.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

/** JSON for a <script type="application/ld+json"> body, safe against `</script>` breakouts. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/[<>&]/g, escapeChar).replace(LINE_SEPARATORS, escapeChar);
}

function escapeChar(char: string): string {
  return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

function withSameAs<T extends JsonLd>(node: T, sameAs: readonly string[]): T {
  return sameAs.length > 0 ? { ...node, sameAs: [...sameAs] } : node;
}

function organizationNode(): JsonLd {
  return withSameAs(
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_CONFIG.name,
      url: buildCanonicalUrl('/'),
      email: SITE_CONFIG.email,
      logo: {
        '@type': 'ImageObject',
        url: buildAssetUrl(SITE_CONFIG.logo.path),
        width: SITE_CONFIG.logo.width,
        height: SITE_CONFIG.logo.height,
      },
    },
    SITE_CONFIG.socialUrls,
  );
}

function personNode(): JsonLd {
  return withSameAs(
    {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: SITE_CONFIG.author.name,
      url: buildCanonicalUrl(SITE_CONFIG.author.path),
    },
    SITE_CONFIG.author.sameAs,
  );
}

export function buildOrganization(): JsonLd {
  return { '@context': SCHEMA_CONTEXT, ...organizationNode() };
}

export function buildWebSite(): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.alternateName,
    url: buildCanonicalUrl('/'),
    inLanguage: SITE_CONFIG.language,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function buildPerson(): JsonLd {
  return { '@context': SCHEMA_CONTEXT, ...personNode() };
}

export function buildWebApplication(input: { name: string; path: string; description: string }): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebApplication',
    name: input.name,
    url: buildCanonicalUrl(input.path),
    description: input.description,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    inLanguage: SITE_CONFIG.language,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: organizationNode(),
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqPage(items: readonly FaqItem[]): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildArticle(input: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  imagePath?: string;
}): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: buildCanonicalUrl(input.path),
    mainEntityOfPage: buildCanonicalUrl(input.path),
    image: buildAssetUrl(input.imagePath ?? SITE_CONFIG.ogImage.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: SITE_CONFIG.language,
    author: personNode(),
    publisher: organizationNode(),
  };
}
