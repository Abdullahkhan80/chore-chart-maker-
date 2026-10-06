// Icon manifest: every icon id the app may reference. Each id maps to an external
// file at public/icons/<id>.svg (never inlined in bulk).

export const CHORE_ICON_IDS = [
  'alarm', 'apple', 'abc', 'backpack', 'ball', 'bath', 'bathroom', 'battery', 'bed', 'bedroom', 'bike', 'bone',
  'books', 'broom', 'calendar', 'car', 'cereal', 'closet', 'coat', 'comb', 'cupboard', 'desk', 'dishwasher',
  'dog-leash', 'drawer', 'duster', 'dustpan', 'face-wash', 'fish', 'folded-clothes', 'fridge', 'grocery-bag',
  'hamper', 'hanger', 'iron', 'laundry-basket', 'lawn-mower', 'litter', 'lunchbox', 'mail', 'microwave', 'mirror',
  'moon', 'mop', 'music', 'note', 'pajamas', 'pencil', 'pet-bowl', 'pet-brush', 'pet-cage', 'place-setting',
  'plate', 'poop-bag', 'pot', 'potty', 'rake', 'recycle', 'seedling', 'shirt', 'shoes', 'sink', 'snow-shovel',
  'soap', 'socks', 'sofa', 'sponge', 'spray-bottle', 'star', 'sun', 'tablet', 'teddy', 'toilet', 'toilet-paper',
  'toothbrush', 'towel', 'toy-box', 'trash-can', 'tree', 'utensils', 'vacuum', 'washing-machine', 'water',
  'water-bottle', 'watering-can', 'weed', 'whisk', 'window',
] as const;

export const AVATAR_ICON_IDS = [
  'avatar-bear', 'avatar-cat', 'avatar-dog', 'avatar-fox', 'avatar-lion', 'avatar-owl', 'avatar-penguin',
  'avatar-rabbit', 'avatar-rocket', 'avatar-star',
] as const;

export type ChoreIconId = (typeof CHORE_ICON_IDS)[number];
export type AvatarIconId = (typeof AVATAR_ICON_IDS)[number];
export type IconId = ChoreIconId | AvatarIconId;

export const ICON_IDS: ReadonlySet<string> = new Set<string>([...CHORE_ICON_IDS, ...AVATAR_ICON_IDS]);

export function isIconId(value: unknown): value is IconId {
  return typeof value === 'string' && ICON_IDS.has(value);
}

export function iconUrl(id: IconId): string {
  return `/icons/${id}.svg`;
}
