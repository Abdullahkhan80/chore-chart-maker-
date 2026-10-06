// Downloads the Fluent Emoji (flat) SVGs listed in ICON_SOURCES, optimizes them
// with SVGO, writes public/icons/<id>.svg and generates src/lib/iconManifest.ts.
//
// Fluent Emoji: https://github.com/microsoft/fluentui-emoji (MIT License).
// Run (needs network): node --experimental-strip-types scripts/fetch-icons.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { optimize } from 'svgo';
import { ALL_ICON_IDS } from '../src/lib/icons.ts';

const REPO = 'microsoft/fluentui-emoji';
const REF = 'main';
const ICON_DIR = new URL('../public/icons/', import.meta.url);
const MANIFEST = new URL('../src/lib/iconManifest.ts', import.meta.url);

/** id → [Fluent Emoji asset name, alt text]. Keys must match src/lib/icons.ts exactly. */
const ICON_SOURCES = {
  // Chores
  alarm: ['Alarm clock', 'Alarm clock'],
  apple: ['Red apple', 'Apple'],
  abc: ['Input latin letters', 'Letters'],
  backpack: ['Backpack', 'Backpack'],
  ball: ['Soccer ball', 'Ball'],
  bath: ['Bathtub', 'Bathtub'],
  bathroom: ['Shower', 'Shower'],
  battery: ['Battery', 'Battery'],
  bed: ['Bed', 'Bed'],
  bedroom: ['Door', 'Bedroom door'],
  bike: ['Bicycle', 'Bicycle'],
  bone: ['Bone', 'Bone'],
  books: ['Books', 'Books'],
  broom: ['Broom', 'Broom'],
  calendar: ['Spiral calendar', 'Calendar'],
  car: ['Automobile', 'Car'],
  cereal: ['Pancakes', 'Breakfast'],
  closet: ['Kimono', 'Clothes in the closet'],
  coat: ['Coat', 'Coat'],
  comb: ['Hair pick', 'Comb'],
  cupboard: ['Teacup without handle', 'Cup'],
  desk: ['Card file box', 'Desk organizer'],
  dishwasher: ['Clinking glasses', 'Clean glasses'],
  'dog-leash': ['Dog', 'Dog'],
  drawer: ['Shorts', 'Folded shorts'],
  duster: ['Feather', 'Feather duster'],
  dustpan: ['Dashing away', 'Swept dust'],
  'face-wash': ['Bubbles', 'Bubbles'],
  fish: ['Tropical fish', 'Fish'],
  'folded-clothes': ['Womans clothes', 'Clothes'],
  fridge: ['Ice', 'Ice'],
  'grocery-bag': ['Shopping bags', 'Shopping bags'],
  hamper: ['Dress', 'Dirty clothes'],
  hanger: ['Hook', 'Hook'],
  iron: ['Jeans', 'Jeans'],
  'laundry-basket': ['Basket', 'Laundry basket'],
  'lawn-mower': ['Tractor', 'Lawn tractor'],
  litter: ['Cat', 'Cat'],
  lunchbox: ['Bento box', 'Lunch box'],
  mail: ['Open mailbox with raised flag', 'Mailbox'],
  microwave: ['Timer clock', 'Timer'],
  mirror: ['Mirror', 'Mirror'],
  moon: ['Crescent moon', 'Moon'],
  mop: ['Bucket', 'Bucket'],
  music: ['Musical notes', 'Music notes'],
  note: ['Memo', 'Note'],
  pajamas: ['Zzz', 'Sleep'],
  pencil: ['Pencil', 'Pencil'],
  'pet-bowl': ['Paw prints', 'Paw prints'],
  'pet-brush': ['Poodle', 'Dog'],
  'pet-cage': ['Hamster', 'Hamster'],
  'place-setting': ['Fork and knife with plate', 'Place setting'],
  plate: ['Fork and knife', 'Fork and knife'],
  'poop-bag': ['Guide dog', 'Dog'],
  pot: ['Cooking', 'Frying pan'],
  potty: ['Water closet', 'Toilet sign'],
  rake: ['Fallen leaf', 'Fallen leaf'],
  recycle: ['Recycling symbol', 'Recycling'],
  seedling: ['Seedling', 'Seedling'],
  shirt: ['T-shirt', 'T-shirt'],
  shoes: ['Running shoe', 'Shoe'],
  sink: ['Potable water', 'Running water'],
  'snow-shovel': ['Snowman', 'Snowman'],
  soap: ['Soap', 'Soap'],
  socks: ['Socks', 'Socks'],
  sofa: ['Couch and lamp', 'Couch'],
  sponge: ['Sponge', 'Sponge'],
  'spray-bottle': ['Lotion bottle', 'Spray bottle'],
  star: ['Star', 'Star'],
  sun: ['Sun', 'Sun'],
  tablet: ['Mobile phone off', 'Phone off'],
  teddy: ['Teddy bear', 'Teddy bear'],
  toilet: ['Toilet', 'Toilet'],
  'toilet-paper': ['Roll of paper', 'Toilet paper'],
  toothbrush: ['Toothbrush', 'Toothbrush'],
  towel: ['Scarf', 'Towel'],
  'toy-box': ['Puzzle piece', 'Toy'],
  'trash-can': ['Wastebasket', 'Trash can'],
  tree: ['Deciduous tree', 'Tree'],
  utensils: ['Spoon', 'Spoon'],
  vacuum: ['Electric plug', 'Plug'],
  'washing-machine': ['Water wave', 'Water'],
  water: ['Droplet', 'Water drop'],
  'water-bottle': ['Cup with straw', 'Drink cup'],
  'watering-can': ['Potted plant', 'Potted plant'],
  weed: ['Herb', 'Herb'],
  whisk: ['Pot of food', 'Pot of food'],
  window: ['Window', 'Window'],
  // Kid avatars
  'avatar-bear': ['Bear', 'Bear'],
  'avatar-cat': ['Cat face', 'Cat'],
  'avatar-dog': ['Dog face', 'Dog'],
  'avatar-fox': ['Fox', 'Fox'],
  'avatar-lion': ['Lion', 'Lion'],
  'avatar-owl': ['Owl', 'Owl'],
  'avatar-penguin': ['Penguin', 'Penguin'],
  'avatar-rabbit': ['Rabbit face', 'Rabbit'],
  'avatar-rocket': ['Rocket', 'Rocket'],
  'avatar-panda': ['Panda', 'Panda'],
  'avatar-tiger': ['Tiger face', 'Tiger'],
  'avatar-koala': ['Koala', 'Koala'],
  'avatar-frog': ['Frog', 'Frog'],
  'avatar-unicorn': ['Unicorn', 'Unicorn'],
  'avatar-dinosaur': ['Sauropod', 'Dinosaur'],
  'avatar-robot': ['Robot', 'Robot'],
  // Reward stickers and badges
  'reward-star': ['Glowing star', 'Gold star'],
  'reward-trophy': ['Trophy', 'Trophy'],
  'reward-medal': ['1st place medal', 'Gold medal'],
  'reward-rosette': ['Rosette', 'Rosette'],
  'reward-crown': ['Crown', 'Crown'],
  'reward-heart': ['Heart decoration', 'Heart'],
  'reward-rainbow': ['Rainbow', 'Rainbow'],
  'reward-gift': ['Wrapped gift', 'Gift'],
  'reward-party': ['Party popper', 'Party popper'],
  'reward-sparkles': ['Sparkles', 'Sparkles'],
};

const SVGO_CONFIG = {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    // preset-default keeps viewBox in SVGO 4.
    'preset-default',
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: ['data-name', 'class'] } },
  ],
};

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPO}/${REF}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'chorechartmaker-icon-fetch' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

const ids = Object.keys(ICON_SOURCES);
const missing = ALL_ICON_IDS.filter((id) => !(id in ICON_SOURCES));
const extra = ids.filter((id) => !ALL_ICON_IDS.includes(id));
if (missing.length || extra.length) {
  throw new Error(`ICON_SOURCES out of sync with icons.ts. Missing: ${missing.join(', ')}. Extra: ${extra.join(', ')}`);
}

// Map Fluent asset names to their flat SVG path (skin-tone variants use the Default folder).
const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`));
const flatPaths = new Map();
for (const { path } of tree.tree) {
  const match = /^assets\/([^/]+)\/(?:Default\/)?Flat\/[^/]+\.svg$/.exec(path);
  if (match && !flatPaths.has(match[1])) flatPaths.set(match[1], path);
}

mkdirSync(ICON_DIR, { recursive: true });
for (const file of readdirSync(ICON_DIR)) if (file.endsWith('.svg')) rmSync(new URL(file, ICON_DIR));

const entries = [];
let totalBytes = 0;
for (const id of ALL_ICON_IDS) {
  const [fluentName, alt] = ICON_SOURCES[id];
  const path = flatPaths.get(fluentName);
  if (!path) throw new Error(`No flat Fluent Emoji named "${fluentName}" (for ${id})`);
  const source = await fetchText(rawUrl(path));
  const { data } = optimize(source, { ...SVGO_CONFIG, path: `${id}.svg` });
  if (!/^<svg[^>]*viewBox=/.test(data) || /<script|\son\w+=|href="(?!#)/i.test(data)) {
    throw new Error(`Unexpected SVG content for ${id}`);
  }
  writeFileSync(new URL(`${id}.svg`, ICON_DIR), data);
  totalBytes += data.length;
  entries.push({ id, alt, source: fluentName });
}

writeFileSync(
  new URL('LICENSE.txt', ICON_DIR),
  `Icons in this folder are from Microsoft Fluent Emoji (flat style),
https://github.com/microsoft/fluentui-emoji, optimized with SVGO.
Some files are renamed; the source emoji for each file is listed in
src/lib/iconManifest.ts.

${await fetchText(rawUrl('LICENSE'))}`,
);

const lines = entries.map(
  ({ id, alt, source }) => `  '${id}': { path: '/icons/${id}.svg', alt: ${JSON.stringify(alt)}, source: ${JSON.stringify(source)} },`,
);
writeFileSync(
  MANIFEST,
  `// GENERATED by scripts/fetch-icons.mjs. Do not edit by hand; change ICON_SOURCES there and re-run.
// Icons: Microsoft Fluent Emoji (flat), MIT License. See public/icons/LICENSE.txt.
import type { IconId } from './icons.ts';

export interface IconEntry {
  /** Public URL of the optimized SVG. */
  path: string;
  /** Short alt text describing the picture. */
  alt: string;
  /** Fluent Emoji asset name the file was made from. */
  source: string;
}

/** Icons render at this size by default; every icon has a square viewBox. */
export const ICON_SIZE = 32;

export const ICON_MANIFEST: Readonly<Record<IconId, IconEntry>> = {
${lines.join('\n')}
};

/** Attributes for a lazily loaded <img>; icons are always external files, never inlined. */
export function iconImgAttrs(id: IconId, size: number = ICON_SIZE, alt?: string) {
  const entry = ICON_MANIFEST[id];
  return {
    src: entry.path,
    alt: alt ?? entry.alt,
    width: size,
    height: size,
    loading: 'lazy',
    decoding: 'async',
  } as const;
}
`,
);

console.log(`Wrote ${entries.length} icons (${(totalBytes / 1024).toFixed(1)} KB total) and iconManifest.ts`);
