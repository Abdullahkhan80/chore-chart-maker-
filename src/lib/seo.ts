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
  themeColor: { light: '#fafaf7', dark: '#fafaf7' },
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

export const SCHEMA_CONTEXT = 'https://schema.org';
export const ORGANIZATION_ID = `${SITE_CONFIG.url}/#organization`;
export const WEBSITE_ID = `${SITE_CONFIG.url}/#website`;
export const PERSON_ID = `${SITE_CONFIG.url}${SITE_CONFIG.author.path}#person`;

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

export function organizationNode(includeFounder = false): JsonLd {
  const node: JsonLd = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_CONFIG.name,
    url: buildCanonicalUrl('/'),
    description:
      'Free, privacy-first printable chore charts, reward charts and routine schedules for kids and families.',
    email: SITE_CONFIG.email,
    logo: {
      '@type': 'ImageObject',
      url: buildAssetUrl(SITE_CONFIG.logo.path),
      width: SITE_CONFIG.logo.width,
      height: SITE_CONFIG.logo.height,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE_CONFIG.email,
    },
  };
  if (includeFounder) {
    node.founder = { '@id': PERSON_ID };
  }
  // TODO: add the brand's verified social profile URLs once they exist.
  return withSameAs(node, SITE_CONFIG.socialUrls);
}

export function personNode(): JsonLd {
  return withSameAs(
    {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: SITE_CONFIG.author.name,
      url: buildCanonicalUrl(SITE_CONFIG.author.path),
      jobTitle: 'Independent software engineer',
      description: 'Creator of Chore Chart Maker, independent software engineer.',
      worksFor: { '@id': ORGANIZATION_ID },
    },
    // TODO: add author's verified social profile URLs once provided (do not invent URLs).
    SITE_CONFIG.author.sameAs,
  );
}

export function webSiteNode(isHome = false): JsonLd {
  const node: JsonLd = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_CONFIG.name,
    url: buildCanonicalUrl('/'),
    description: SITE_CONFIG.defaultDescription,
    inLanguage: 'en-US',
    publisher: { '@id': ORGANIZATION_ID },
  };
  if (isHome) {
    node.alternateName = SITE_CONFIG.alternateName;
  }
  return node;
}

export function buildOrganization(): JsonLd {
  return { '@context': SCHEMA_CONTEXT, ...organizationNode(false) };
}

export function buildWebSite(): JsonLd {
  return { '@context': SCHEMA_CONTEXT, ...webSiteNode(true) };
}

export function buildPerson(): JsonLd {
  return { '@context': SCHEMA_CONTEXT, ...personNode() };
}

export const TOOL_FEATURE_LISTS: Record<string, string[]> = {
  '/chore-chart-maker/': [
    'Weekly chore schedule',
    'Picture icons for pre-readers',
    'A4 and Letter PDF & PNG',
    'Private browser storage',
  ],
  '/reward-chart-maker/': [
    '5 to 30 sticker track',
    'Custom goal & prize fields',
    'Letter and A4 printable',
    'Private browser storage',
  ],
  '/morning-routine-chart/': [
    'Morning routine checklist',
    'Picture routine steps',
    'Print, PDF and PNG download',
    'Private browser storage',
  ],
  '/bedtime-routine-chart/': [
    'Evening routine checklist',
    'Bedtime picture steps',
    'Print, PDF and PNG download',
    'Private browser storage',
  ],
  '/family-chore-chart/': [
    'Household chores up to 8 people',
    'Color-coded or per-child pages',
    'Letter and A4 printable',
    'Private browser storage',
  ],
  '/roommate-chore-chart/': [
    'Weekly rotation schedule',
    'Fair roommate split',
    'Print and share link',
    'Private browser storage',
  ],
  '/free-chore-chart-template/': [
    'Ready-made chore templates',
    'In-browser customization',
    'Clean minimal and ink-saver',
    'Free PDF and PNG export',
  ],
  '/elegant-chore-chart/': [
    'Minimalist chart designs',
    'Calm aesthetic themes',
    'Framing-ready PDF and PNG',
    'Private browser storage',
  ],
  '/pt/': [
    'Tabela com ilustrações',
    'Rotinas para todas as idades',
    'Impressão em PDF e PNG',
    'Sem cadastro e 100% privado',
  ],
  '/fr/': [
    'Tableau illustré pour enfants',
    'Routines par tranche d\'âge',
    'Export PDF et PNG gratuit',
    'Sans inscription et privé',
  ],
};

export function buildWebApplication(input: {
  name: string;
  path: string;
  description: string;
  lang?: string;
  imagePath?: string;
  features?: string[];
}): JsonLd {
  const canonical = buildCanonicalUrl(input.path);
  const slug = input.path === '/' ? 'home' : input.path.replace(/^\/|\/$/g, '');
  const image = input.imagePath ?? `/og/${slug}.png`;
  const features = input.features ?? TOOL_FEATURE_LISTS[input.path] ?? [
    'Customizable printable chore charts',
    'Visual chore icons library for pre-readers',
    'A4 and US Letter printable PDF and PNG export',
    'Works 100% in-browser with private local storage',
  ];
  return {
    '@type': 'WebApplication',
    '@id': `${canonical}#app`,
    name: input.name,
    url: canonical,
    description: input.description,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    inLanguage: input.lang ?? SITE_CONFIG.language,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    image: buildAssetUrl(image),
    featureList: features,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function buildWebPage(input: {
  name: string;
  description: string;
  path: string;
  lang?: string;
  datePublished?: string;
  dateModified?: string;
  mainEntityId?: string;
  breadcrumbId?: string;
  primaryImageOfPage?: string;
  type?: string;
}): JsonLd {
  const canonical = buildCanonicalUrl(input.path);
  const node: JsonLd = {
    '@type': input.type ?? 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: input.name,
    description: input.description,
    inLanguage: input.lang ?? SITE_CONFIG.language,
    isPartOf: { '@id': WEBSITE_ID },
  };
  if (input.breadcrumbId) node.breadcrumb = { '@id': input.breadcrumbId };
  if (input.mainEntityId) node.mainEntity = { '@id': input.mainEntityId };
  if (input.primaryImageOfPage) {
    node.primaryImageOfPage = {
      '@type': 'ImageObject',
      url: buildAssetUrl(input.primaryImageOfPage),
    };
  }
  if (input.datePublished) node.datePublished = input.datePublished;
  if (input.dateModified) node.dateModified = input.dateModified;
  return node;
}

export function buildAboutPage(input: {
  name: string;
  description: string;
  path: string;
  lang?: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLd {
  return buildWebPage({
    ...input,
    type: 'AboutPage',
    mainEntityId: ORGANIZATION_ID,
  });
}

export function buildContactPage(input: {
  name: string;
  description: string;
  path: string;
  lang?: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLd {
  return buildWebPage({
    ...input,
    type: 'ContactPage',
    mainEntityId: ORGANIZATION_ID,
  });
}

export function buildCollectionPage(input: {
  name: string;
  description: string;
  path: string;
  itemListId?: string;
  lang?: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLd {
  return buildWebPage({
    ...input,
    type: 'CollectionPage',
    mainEntityId: input.itemListId,
  });
}

export function buildItemList(
  items: readonly { name: string; url: string; description?: string }[],
  id?: string,
): JsonLd {
  return {
    '@type': 'ItemList',
    ...(id ? { '@id': id } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[], pagePath?: string): JsonLd {
  const canonical = buildCanonicalUrl(pagePath ?? items[items.length - 1]!.path);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
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

export function buildFaqPage(items: readonly FaqItem[], pagePath?: string): JsonLd {
  const node: JsonLd = {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/<[^>]+>/g, '').trim() },
    })),
  };
  if (pagePath) {
    node['@id'] = `${buildCanonicalUrl(pagePath)}#faq`;
  }
  return node;
}

export function buildArticle(input: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  imagePath?: string;
  lang?: string;
}): JsonLd {
  const canonical = buildCanonicalUrl(input.path);
  return {
    '@type': 'Article',
    '@id': `${canonical}#article`,
    headline: input.headline,
    description: input.description,
    url: canonical,
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
    image: buildAssetUrl(input.imagePath ?? SITE_CONFIG.ogImage.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: input.lang ?? SITE_CONFIG.language,
    author: { '@id': PERSON_ID },
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export interface PageGraphInput {
  path: string;
  title: string;
  description: string;
  lang?: string;
  datePublished?: string;
  dateModified?: string;
  imagePath?: string;
  nodes?: JsonLd[];
}

export function buildPageGraph(input: PageGraphInput): JsonLd {
  const canonical = buildCanonicalUrl(input.path);
  const lang = input.lang ?? SITE_CONFIG.language;
  const nodes = input.nodes ?? [];
  const isHome = input.path === '/';

  const graph: JsonLd[] = [];

  let hasArticle = false;
  let hasPerson = false;
  let hasFaq = false;
  let mainEntityId: string | undefined;
  let hasBreadcrumb = false;
  let webPageNodeFromInput: JsonLd | undefined;

  for (const node of nodes) {
    const type = node['@type'];
    if (type === 'Article') {
      hasArticle = true;
      if (!node['@id']) node['@id'] = `${canonical}#article`;
      mainEntityId = `${canonical}#article`;
    } else if (type === 'WebApplication') {
      if (!node['@id']) node['@id'] = `${canonical}#app`;
      mainEntityId = `${canonical}#app`;
    } else if (type === 'AboutPage' || type === 'ContactPage') {
      mainEntityId = ORGANIZATION_ID;
      if (!node['@id']) node['@id'] = `${canonical}#webpage`;
      webPageNodeFromInput = node;
    } else if (type === 'WebPage' || type === 'CollectionPage') {
      if (!node['@id']) node['@id'] = `${canonical}#webpage`;
      webPageNodeFromInput = node;
    } else if (type === 'Person') {
      hasPerson = true;
      if (!node['@id']) node['@id'] = PERSON_ID;
    } else if (type === 'BreadcrumbList') {
      hasBreadcrumb = true;
      if (!node['@id']) node['@id'] = `${canonical}#breadcrumb`;
    } else if (type === 'FAQPage') {
      hasFaq = true;
      if (!node['@id']) node['@id'] = `${canonical}#faq`;
    }
  }

  const hasPersonNode = hasArticle || hasPerson || input.path === '/about/';

  // Always include WebSite and Organization
  graph.push(webSiteNode(isHome));
  graph.push(organizationNode(hasPersonNode));

  // Include Person node on every Article page or About page
  if (hasPersonNode) {
    graph.push(personNode());
  }

  let targetWebPage: JsonLd;

  // If a specialized page node was provided, integrate it; otherwise generate a WebPage node
  if (webPageNodeFromInput) {
    targetWebPage = webPageNodeFromInput;
    if (!targetWebPage.isPartOf) targetWebPage.isPartOf = { '@id': WEBSITE_ID };
    if (!targetWebPage.description) targetWebPage.description = input.description;
    if (!targetWebPage.inLanguage) targetWebPage.inLanguage = lang;
    if (hasBreadcrumb && !targetWebPage.breadcrumb) {
      targetWebPage.breadcrumb = { '@id': `${canonical}#breadcrumb` };
    }
    if (input.imagePath && !targetWebPage.primaryImageOfPage) {
      targetWebPage.primaryImageOfPage = {
        '@type': 'ImageObject',
        url: buildAssetUrl(input.imagePath),
      };
    }
    if (input.datePublished && !targetWebPage.datePublished) {
      targetWebPage.datePublished = input.datePublished;
    }
    if (input.dateModified && !targetWebPage.dateModified) {
      targetWebPage.dateModified = input.dateModified;
    }
  } else {
    targetWebPage = {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: input.title,
      description: input.description,
      inLanguage: lang,
      isPartOf: { '@id': WEBSITE_ID },
    };
    if (input.imagePath) {
      targetWebPage.primaryImageOfPage = {
        '@type': 'ImageObject',
        url: buildAssetUrl(input.imagePath),
      };
    }
    if (hasBreadcrumb) {
      targetWebPage.breadcrumb = { '@id': `${canonical}#breadcrumb` };
    }
    if (mainEntityId) {
      targetWebPage.mainEntity = { '@id': mainEntityId };
    }
    if (input.datePublished) {
      targetWebPage.datePublished = input.datePublished;
    }
    if (input.dateModified) {
      targetWebPage.dateModified = input.dateModified;
    }
    graph.push(targetWebPage);
  }

  if (hasFaq) {
    targetWebPage.hasPart = { '@id': `${canonical}#faq` };
  }

  // Add the custom nodes (deduplicating by @id)
  for (const node of nodes) {
    const id = node['@id'];
    if (!id || !graph.some((existing) => existing['@id'] === id)) {
      graph.push(node);
    }
  }

  // Strip @context from individual nodes within the graph array
  const cleanGraph = graph.map((node) => {
    const { '@context': _, ...rest } = node;
    return rest;
  });

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': cleanGraph,
  };
}
