// Registry of every page: path, SEO text, H1 and lastmod.
// Single source of truth for page metadata, navigation and sitemap lastmod.

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
  /** Short label for nav, footer and breadcrumbs. */
  label: string;
  /** ISO date (YYYY-MM-DD) of the last meaningful content change. */
  lastmod: string;
  /** ISO date first published; used for Article JSON-LD. */
  published: string;
  noindex?: boolean;
}

const LAUNCH = '2026-10-06';

function page(meta: Omit<PageMeta, 'lastmod' | 'published'> & Partial<PageMeta>): PageMeta {
  return { lastmod: LAUNCH, published: LAUNCH, ...meta };
}

export const PAGES = {
  home: page({
    path: '/',
    label: 'Home',
    title: 'Free Printable Chore Charts for Kids & Families',
    h1: 'Free printable chore charts for kids and families',
    description:
      'Make free printable chore charts, reward charts and routine charts for kids and families. No sign-up, nothing to install, and your info stays in your browser.',
  }),
  choreChartMaker: page({
    path: '/chore-chart-maker/',
    label: 'Chore Chart Maker',
    title: 'Chore Chart Maker – Free Printable Chore Charts',
    h1: 'Chore Chart Maker',
    description:
      'Create a free printable chore chart in minutes. Add kids, choose chores by age, pick a layout and print on Letter or A4. Everything stays in your browser.',
  }),
  rewardChartMaker: page({
    path: '/reward-chart-maker/',
    label: 'Reward Chart',
    title: 'Reward Chart Maker – Free Printable Reward Charts',
    h1: 'Reward Chart Maker',
    description:
      'Build a free printable reward chart with sticker boxes, custom goals and rewards for kids. Print on Letter or A4. No sign-up, and no data leaves your device.',
  }),
  choresByAge: page({
    path: '/chores-for-kids-by-age/',
    label: 'Chores by Age',
    title: 'Age-Appropriate Chores for Kids: List by Age (2–14)',
    h1: 'Age-appropriate chores for kids, by age',
    description:
      'A practical list of age-appropriate chores for kids from 2 to 14, with what to expect at each age and tips to get started. Turn any list into a printable chart.',
  }),
  roommateChoreChart: page({
    path: '/roommate-chore-chart/',
    label: 'Roommate Chore Chart',
    title: 'Roommate Chore Chart – Free Printable Chore Schedule',
    h1: 'Roommate chore chart',
    description:
      'Split housework fairly with a free printable roommate chore chart. Rotate chores weekly, add everyone in the house, then print or share it. No sign-up required.',
  }),
  morningRoutineChart: page({
    path: '/morning-routine-chart/',
    label: 'Morning Routine Chart',
    title: 'Morning Routine Chart – Free Printable for Kids',
    h1: 'Morning routine chart for kids',
    description:
      'Make a free printable morning routine chart for kids with simple picture steps, from brushing teeth to packing a backpack. Customize it and print it at home.',
  }),
  familyChoreChart: page({
    path: '/family-chore-chart/',
    label: 'Family Chore Chart',
    title: 'Family Chore Chart – Free Printable for the Whole House',
    h1: 'Family chore chart',
    description:
      'Plan housework for the whole family with a free printable family chore chart. Assign chores to each person, set a weekly schedule and print on Letter or A4.',
  }),
  about: page({
    path: '/about/',
    label: 'About',
    title: 'About Chore Chart Maker',
    h1: 'About Chore Chart Maker',
    description:
      'Chore Chart Maker builds free, privacy-first printable tools for parents, teachers and households. Learn who makes the site and how we keep your data private.',
  }),
  contact: page({
    path: '/contact/',
    label: 'Contact',
    title: 'Contact Chore Chart Maker',
    h1: 'Contact us',
    description:
      'Get in touch with the Chore Chart Maker team about our free printable chore chart tools: feedback, bug reports or ideas for new printable charts for kids.',
  }),
  privacyPolicy: page({
    path: '/privacy-policy/',
    label: 'Privacy Policy',
    title: 'Privacy Policy | Chore Chart Maker',
    h1: 'Privacy policy',
    description:
      'How Chore Chart Maker protects your privacy: names and chores on your charts stay in your browser, there are no accounts, and analytics never see what you type.',
  }),
  terms: page({
    path: '/terms/',
    label: 'Terms of Use',
    title: 'Terms of Use | Chore Chart Maker',
    h1: 'Terms of use',
    description:
      "The terms of use for Chore Chart Maker's free printable tools, including acceptable use, printing and sharing your charts, and the limits of our responsibility.",
  }),
  notFound: page({
    path: '/404/',
    label: 'Page not found',
    title: 'Page Not Found | Chore Chart Maker',
    h1: 'Page not found',
    description:
      "Sorry, we couldn't find that page. Head back to Chore Chart Maker to make free printable chore charts, reward charts and routine charts for kids and families.",
    noindex: true,
  }),
} as const satisfies Record<string, PageMeta>;

/** Ages with a published /chores-for-[N]-year-olds/ page. Add ages here as pages go live. */
export const AGE_PAGE_AGES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function agePagePath(age: number): string {
  return `/chores-for-${age}-year-olds/`;
}

export function agePage(age: number): PageMeta {
  return page({
    path: agePagePath(age),
    label: `Chores for ${age}-Year-Olds`,
    title: `Chores for ${age}-Year-Olds: Age-Appropriate Chore List`,
    h1: `Chores for ${age}-year-olds`,
    description: `Age-appropriate chores for ${age}-year-olds, with daily and weekly ideas, tips for teaching each job, and a free printable chore chart you can customize.`,
  });
}

export function allPages(): PageMeta[] {
  return [...Object.values(PAGES), ...AGE_PAGE_AGES.map(agePage)];
}

export function indexablePages(): PageMeta[] {
  return allPages().filter((p) => !p.noindex);
}
