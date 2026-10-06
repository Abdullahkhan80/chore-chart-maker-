// Built-in chore library with age ranges, based on common age-appropriate chore guidance.
// minAge/maxAge are inclusive; maxAge AGE_MAX means "and older".
import type { ChoreIconId } from './icons.ts';
import type { TimeOfDay } from './types.ts';

export const AGE_MIN = 2;
export const AGE_MAX = 18;

export const CHORE_CATEGORIES = [
  'bedroom',
  'kitchen',
  'pets',
  'outdoor',
  'self-care',
  'school',
  'laundry',
  'cleaning',
] as const;
export type ChoreCategory = (typeof CHORE_CATEGORIES)[number];

export interface LibraryChore {
  id: string;
  label: string;
  iconId: ChoreIconId;
  category: ChoreCategory;
  minAge: number;
  maxAge: number;
  timeOfDay?: TimeOfDay;
}

export interface AgeBand {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
}

export const AGE_BANDS: readonly AgeBand[] = [
  { id: '2-3', label: 'Ages 2–3', minAge: 2, maxAge: 3 },
  { id: '4-5', label: 'Ages 4–5', minAge: 4, maxAge: 5 },
  { id: '6-7', label: 'Ages 6–7', minAge: 6, maxAge: 7 },
  { id: '8-9', label: 'Ages 8–9', minAge: 8, maxAge: 9 },
  { id: '10-12', label: 'Ages 10–12', minAge: 10, maxAge: 12 },
  { id: '13-plus', label: 'Ages 13+', minAge: 13, maxAge: AGE_MAX },
];

type Row = [id: string, label: string, iconId: ChoreIconId, minAge: number, maxAge?: number, timeOfDay?: TimeOfDay];

function category(name: ChoreCategory, rows: Row[]): LibraryChore[] {
  return rows.map(([id, label, iconId, minAge, maxAge = AGE_MAX, timeOfDay]) => ({
    id,
    label,
    iconId,
    category: name,
    minAge,
    maxAge,
    ...(timeOfDay ? { timeOfDay } : {}),
  }));
}

export const CHORE_LIBRARY: readonly LibraryChore[] = [
  ...category('bedroom', [
    ['put-toys-in-bin', 'Put toys in the toy bin', 'toy-box', 2, 8],
    ['stuffed-animals-on-bed', 'Put stuffed animals on the bed', 'teddy', 2, 5],
    ['books-on-shelf', 'Put books back on the shelf', 'books', 2, 10],
    ['clothes-in-hamper', 'Put dirty clothes in the hamper', 'hamper', 2],
    ['pick-up-floor', 'Pick up the bedroom floor', 'bedroom', 3, 12],
    ['pull-up-covers', 'Pull up the bed covers', 'bed', 3, 6, 'morning'],
    ['open-curtains', 'Open the curtains', 'window', 4, 12, 'morning'],
    ['pick-tomorrows-clothes', "Pick out tomorrow's clothes", 'shirt', 4, 12, 'evening'],
    ['put-away-clean-clothes', 'Put away clean clothes', 'drawer', 5],
    ['tidy-bedroom', 'Tidy the bedroom', 'bedroom', 5],
    ['make-bed', 'Make the bed', 'bed', 6, AGE_MAX, 'morning'],
    ['dust-bedroom', 'Dust bedroom shelves', 'duster', 6],
    ['organize-closet', 'Organize the closet', 'closet', 9],
    ['set-alarm', 'Set the alarm clock', 'alarm', 9, AGE_MAX, 'evening'],
    ['change-sheets', 'Change the bed sheets', 'bed', 10],
  ]),
  ...category('kitchen', [
    ['carry-plate-to-sink', 'Carry plate to the sink', 'plate', 2, 6],
    ['wipe-own-spills', 'Wipe up own spills', 'sponge', 3, 10],
    ['help-stir', 'Help stir when cooking', 'whisk', 3, 6],
    ['set-table', 'Set the table', 'place-setting', 4, 12],
    ['clear-table', 'Clear the table', 'plate', 4],
    ['wipe-table', 'Wipe the table', 'sponge', 4],
    ['help-put-away-groceries', 'Help put away groceries', 'grocery-bag', 4, 8],
    ['wash-fruit-veg', 'Wash fruits and vegetables', 'apple', 5, 12],
    ['help-pack-lunch', 'Help pack lunch', 'lunchbox', 5, 7],
    ['refill-water-pitcher', 'Refill the water pitcher', 'water', 5],
    ['empty-dishwasher-utensils', 'Empty dishwasher utensils', 'utensils', 6, 8],
    ['dry-dishes', 'Dry the dishes', 'towel', 6, 14],
    ['make-simple-snack', 'Make a simple snack', 'apple', 6, 12],
    ['wipe-counters', 'Wipe kitchen counters', 'spray-bottle', 7],
    ['put-away-dishes', 'Put away clean dishes', 'cupboard', 7],
    ['empty-dishwasher', 'Empty the dishwasher', 'dishwasher', 8],
    ['load-dishwasher', 'Load the dishwasher', 'dishwasher', 8],
    ['pack-lunch', 'Pack own lunch', 'lunchbox', 8, AGE_MAX, 'morning'],
    ['make-breakfast', 'Make own breakfast', 'cereal', 8, AGE_MAX, 'morning'],
    ['put-away-groceries', 'Put away groceries', 'grocery-bag', 9],
    ['wash-dishes', 'Wash dishes by hand', 'sink', 10],
    ['cook-simple-meal', 'Cook a simple meal', 'pot', 10],
    ['clean-microwave', 'Clean the microwave', 'microwave', 10],
    ['clean-fridge', 'Clean out the fridge', 'fridge', 12],
    ['cook-family-meal', 'Plan and cook a family meal', 'pot', 13],
  ]),
  ...category('pets', [
    ['help-feed-pet', 'Help feed the pet', 'pet-bowl', 2, 3],
    ['put-away-pet-toys', 'Put away pet toys', 'bone', 3, 10],
    ['feed-pet', 'Feed the pet', 'pet-bowl', 4],
    ['fill-pet-water', "Fill the pet's water bowl", 'water', 4],
    ['walk-dog-with-adult', 'Walk the dog with a grown-up', 'dog-leash', 5, 9],
    ['brush-pet', 'Brush the pet', 'pet-brush', 6],
    ['help-clean-fish-tank', 'Help clean the fish tank', 'fish', 8],
    ['walk-dog', 'Walk the dog', 'dog-leash', 10],
    ['scoop-litter-box', 'Scoop the litter box', 'litter', 10],
    ['clean-pet-cage', 'Clean the pet cage', 'pet-cage', 10],
    ['pick-up-dog-poop', 'Pick up dog poop in the yard', 'poop-bag', 10],
    ['bathe-dog', 'Give the dog a bath', 'bath', 12],
  ]),
  ...category('outdoor', [
    ['water-plants', 'Water the plants', 'watering-can', 3],
    ['put-away-outdoor-toys', 'Put away outdoor toys', 'ball', 3, 12],
    ['pick-up-sticks', 'Pick up sticks in the yard', 'tree', 4, 12],
    ['bring-in-mail', 'Bring in the mail', 'mail', 5],
    ['plant-seeds', 'Plant seeds in the garden', 'seedling', 5],
    ['pull-weeds', 'Pull weeds', 'weed', 6],
    ['rake-leaves', 'Rake leaves', 'rake', 7],
    ['sweep-porch', 'Sweep the porch', 'broom', 7],
    ['take-out-trash', 'Take out the trash', 'trash-can', 7],
    ['put-away-bike', 'Clean and put away bike', 'bike', 7],
    ['bring-in-bins', 'Bring in the trash bins', 'trash-can', 8],
    ['help-wash-car', 'Help wash the car', 'car', 8],
    ['shovel-snow', 'Shovel snow', 'snow-shovel', 10],
    ['mow-lawn', 'Mow the lawn', 'lawn-mower', 13],
  ]),
  ...category('self-care', [
    ['brush-teeth-morning', 'Brush teeth (morning)', 'toothbrush', 2, AGE_MAX, 'morning'],
    ['brush-teeth-bedtime', 'Brush teeth (bedtime)', 'toothbrush', 2, AGE_MAX, 'evening'],
    ['wash-hands-before-meals', 'Wash hands before meals', 'soap', 2, 10],
    ['put-on-shoes', 'Put on shoes', 'shoes', 2, 6, 'morning'],
    ['try-potty', 'Try the potty', 'potty', 2, 3],
    ['eat-breakfast', 'Eat breakfast', 'cereal', 2, 12, 'morning'],
    ['bath-time', 'Bath or shower time', 'bath', 2, AGE_MAX, 'evening'],
    ['put-on-pajamas', 'Put on pajamas', 'pajamas', 2, 12, 'evening'],
    ['drink-water', 'Drink a glass of water', 'water', 2],
    ['get-dressed', 'Get dressed', 'shirt', 3, AGE_MAX, 'morning'],
    ['wash-face', 'Wash face', 'face-wash', 3],
    ['brush-hair', 'Brush or comb hair', 'comb', 3, AGE_MAX, 'morning'],
    ['put-shoes-away', 'Put shoes away', 'shoes', 3, 12],
    ['hang-up-coat', 'Hang up coat', 'coat', 3, 12],
    ['read-before-bed', 'Read a book before bed', 'books', 3, 12, 'evening'],
    ['hang-up-towel', 'Hang up bath towel', 'towel', 4],
    ['lights-out-on-time', 'Lights out on time', 'moon', 4, 14, 'evening'],
    ['put-on-sunscreen', 'Put on sunscreen', 'sun', 6, AGE_MAX, 'morning'],
    ['screens-off-before-bed', 'Turn off screens before bed', 'tablet', 6, AGE_MAX, 'evening'],
    ['floss-teeth', 'Floss teeth', 'toothbrush', 7, AGE_MAX, 'evening'],
    ['pack-sports-bag', 'Pack sports bag', 'backpack', 8],
  ]),
  ...category('school', [
    ['practice-letters', 'Practice letters', 'abc', 4, 6],
    ['pack-backpack', 'Pack backpack', 'backpack', 5, AGE_MAX, 'morning'],
    ['fill-water-bottle', 'Fill water bottle for school', 'water-bottle', 5, AGE_MAX, 'morning'],
    ['empty-backpack', 'Empty backpack after school', 'backpack', 5, AGE_MAX, 'afternoon'],
    ['hand-in-school-notes', 'Give school notes to a grown-up', 'note', 5, 12, 'afternoon'],
    ['do-homework', 'Do homework', 'pencil', 6, AGE_MAX, 'afternoon'],
    ['read-20-minutes', 'Read for 20 minutes', 'books', 6],
    ['practice-instrument', 'Practice an instrument', 'music', 6],
    ['practice-spelling', 'Practice spelling words', 'pencil', 6, 11],
    ['tidy-desk', 'Tidy the desk', 'desk', 7],
    ['charge-devices', 'Charge school devices', 'battery', 8, AGE_MAX, 'evening'],
    ['check-planner', 'Check planner for assignments', 'calendar', 9],
  ]),
  ...category('laundry', [
    ['match-socks', 'Match socks', 'socks', 3, 12],
    ['sort-laundry', 'Sort laundry by color', 'hamper', 5, 12],
    ['carry-laundry-basket', 'Carry the laundry basket', 'laundry-basket', 5, 12],
    ['fold-towels', 'Fold towels', 'towel', 6],
    ['hang-clothes', 'Hang clothes in the closet', 'hanger', 7],
    ['fold-laundry', 'Fold laundry', 'folded-clothes', 8],
    ['move-laundry-to-dryer', 'Move laundry to the dryer', 'washing-machine', 9],
    ['start-laundry-load', 'Start a load of laundry', 'washing-machine', 11],
    ['own-laundry', 'Do own laundry start to finish', 'washing-machine', 13],
    ['iron-clothes', 'Iron clothes', 'iron', 13],
  ]),
  ...category('cleaning', [
    ['dust-low-shelves', 'Dust low shelves', 'duster', 3, 6],
    ['hold-dustpan', 'Hold the dustpan', 'dustpan', 3, 6],
    ['fluff-pillows', 'Fluff the couch pillows', 'sofa', 3, 8],
    ['empty-small-trash', 'Empty small trash cans', 'trash-can', 5],
    ['sort-recycling', 'Sort the recycling', 'recycle', 5],
    ['wipe-door-handles', 'Wipe door handles', 'spray-bottle', 5, 12],
    ['handheld-vacuum', 'Vacuum crumbs with a handheld vacuum', 'vacuum', 6, 10],
    ['tidy-living-room', 'Tidy the living room', 'sofa', 6],
    ['replace-toilet-paper', 'Replace the toilet paper roll', 'toilet-paper', 6],
    ['wipe-light-switches', 'Wipe light switches', 'spray-bottle', 6, 14],
    ['dust-furniture', 'Dust furniture', 'duster', 7],
    ['sweep-floor', 'Sweep the floor', 'broom', 7],
    ['clean-mirrors', 'Clean mirrors', 'mirror', 7],
    ['new-trash-bag', 'Put a new bag in the trash can', 'trash-can', 7],
    ['clean-bathroom-sink', 'Clean the bathroom sink', 'sink', 8],
    ['wipe-baseboards', 'Wipe baseboards', 'sponge', 8],
    ['vacuum-room', 'Vacuum a room', 'vacuum', 10],
    ['mop-floor', 'Mop the floor', 'mop', 10],
    ['wash-windows', 'Wash windows', 'window', 10],
    ['clean-toilet', 'Clean the toilet', 'toilet', 11],
    ['scrub-bathtub', 'Scrub the bathtub', 'bath', 12],
    ['clean-bathroom', 'Clean the whole bathroom', 'bathroom', 13],
  ]),
];

const CHORES_BY_ID: ReadonlyMap<string, LibraryChore> = new Map(CHORE_LIBRARY.map((chore) => [chore.id, chore]));

export function getChoreById(id: string): LibraryChore | undefined {
  return CHORES_BY_ID.get(id);
}

/** Chores suitable for a child of `age` (clamped to AGE_MIN–AGE_MAX), in library order. */
export function getChoresForAge(age: number): LibraryChore[] {
  if (!Number.isFinite(age)) return [];
  const clamped = Math.min(AGE_MAX, Math.max(AGE_MIN, Math.floor(age)));
  return CHORE_LIBRARY.filter((chore) => chore.minAge <= clamped && clamped <= chore.maxAge);
}

export function getAgeBand(age: number): AgeBand | undefined {
  return AGE_BANDS.find((band) => band.minAge <= age && age <= band.maxAge);
}

const MAX_QUERY_LENGTH = 40;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Chores whose label or category contains every word of `query` (case- and accent-insensitive).
 * Labels that start with the query rank first. An empty query returns no results.
 */
export function searchChores(query: string, options: { age?: number } = {}): LibraryChore[] {
  const normalized = normalize(String(query).slice(0, MAX_QUERY_LENGTH));
  if (!normalized) return [];
  const terms = normalized.split(' ');
  const pool = options.age === undefined ? CHORE_LIBRARY : getChoresForAge(options.age);
  return pool
    .map((chore) => ({ chore, label: normalize(chore.label), haystack: normalize(`${chore.label} ${chore.category}`) }))
    .filter(({ haystack }) => terms.every((term) => haystack.includes(term)))
    .sort((a, b) => Number(b.label.startsWith(normalized)) - Number(a.label.startsWith(normalized)))
    .map(({ chore }) => chore);
}
