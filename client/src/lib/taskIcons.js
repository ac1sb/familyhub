// A little "chore chart" icon library: maps common kid/household task
// wording to an emoji, for Squares display mode where a task is a small
// tile rather than a line of text. Grouped into categories so Settings can
// show a browsable picker instead of one huge flat grid - see
// DashboardWidgetsSetup-adjacent Chore/Daily Checklist Setup pages.
//
// Order matters within a category's `keywords` list, and categories are
// checked in the order below - a specific phrase (e.g. "clean litter box")
// should come before a generic word it also contains (e.g. "clean") or the
// generic one would win first. Each entry lists several ways a task might
// actually get typed - a full phrase ("pack backpack") alongside the bare
// noun someone might type instead ("backpack") - since a real chore list is
// often just one or two words, not a full sentence.
export const TASK_ICON_CATEGORIES = [
  {
    name: 'Personal Care',
    icons: [
      { icon: '🪥', keywords: ['brush teeth', 'brushing teeth', 'toothbrush'] },
      { icon: '💇', keywords: ['brush hair', 'hair brush', 'hairbrush'] },
      { icon: '🚿', keywords: ['shower'] },
      { icon: '🛁', keywords: ['bath', 'bathtime'] },
      { icon: '👕', keywords: ['get dressed', 'getting dressed'] },
      { icon: '🧼', keywords: ['wash hands', 'soap'] },
      { icon: '👟', keywords: ['shoes', 'sneakers'] },
      { icon: '🧥', keywords: ['jacket', 'coat'] },
      { icon: '🧦', keywords: ['socks'] },
      { icon: '💅', keywords: ['nails', 'manicure'] },
      { icon: '🧴', keywords: ['lotion', 'sunscreen'] },
      { icon: '🧻', keywords: ['tissue', 'toilet paper'] },
      { icon: '👓', keywords: ['glasses'] },
      { icon: '🎀', keywords: ['hair bow', 'ribbon'] },
    ],
  },
  {
    name: 'Bedroom & Home',
    icons: [
      { icon: '🛏️', keywords: ['make bed', 'make the bed', 'bed'] },
      { icon: '🧸', keywords: ['put away toys', 'pick up toys', 'clean up toys', 'toys'] },
      { icon: '🪟', keywords: ['clean window', 'wash window', 'windows', 'window'] },
      { icon: '🚪', keywords: ['door'] },
      { icon: '💡', keywords: ['light', 'lights', 'turn off lights'] },
      { icon: '🗄️', keywords: ['closet', 'dresser', 'drawer'] },
      { icon: '🖼️', keywords: ['decorate', 'poster', 'picture'] },
      { icon: '🕯️', keywords: ['candle'] },
      { icon: '📷', keywords: ['photo', 'camera'] },
    ],
  },
  {
    name: 'School',
    icons: [
      { icon: '🎒', keywords: ['backpack', 'pack backpack', 'pack bag', 'book bag'] },
      { icon: '🍱', keywords: ['lunchbox', 'lunch box', 'pack lunch', 'lunch'] },
      { icon: '📓', keywords: ['homework'] },
      { icon: '📖', keywords: ['read', 'reading', 'book', 'books'] },
      { icon: '📚', keywords: ['study', 'spelling', 'flashcards'] },
      { icon: '🚌', keywords: ['bus', 'school bus', 'carpool'] },
      { icon: '✏️', keywords: ['pencil', 'write', 'writing'] },
      { icon: '📝', keywords: ['notes', 'worksheet'] },
      { icon: '🎓', keywords: ['graduation', 'school'] },
      { icon: '🖍️', keywords: ['crayons', 'coloring'] },
      { icon: '✂️', keywords: ['scissors', 'cut'] },
      { icon: '📐', keywords: ['ruler', 'math'] },
    ],
  },
  {
    name: 'Music & Activities',
    icons: [
      { icon: '🎹', keywords: ['piano'] },
      { icon: '🎻', keywords: ['violin'] },
      { icon: '🎸', keywords: ['guitar'] },
      { icon: '🥁', keywords: ['drums'] },
      { icon: '🎺', keywords: ['trumpet'] },
      { icon: '🎵', keywords: ['practice', 'clarinet', 'flute', 'music', 'band'] },
      { icon: '⚽', keywords: ['soccer', 'practice sports', 'sports'] },
      { icon: '🏀', keywords: ['basketball'] },
      { icon: '⚾', keywords: ['baseball'] },
      { icon: '🏈', keywords: ['football'] },
      { icon: '🎾', keywords: ['tennis'] },
      { icon: '🏊', keywords: ['swim', 'swimming'] },
      { icon: '🏃', keywords: ['exercise', 'workout', 'stretch', 'run', 'running'] },
      { icon: '🚴', keywords: ['bike', 'bicycle'] },
      { icon: '🛴', keywords: ['scooter'] },
      { icon: '🛹', keywords: ['skateboard'] },
      { icon: '🎨', keywords: ['draw', 'drawing', 'art'] },
      { icon: '💃', keywords: ['dance', 'dancing'] },
      { icon: '🧩', keywords: ['puzzle'] },
      { icon: '🎲', keywords: ['board game', 'game night'] },
    ],
  },
  {
    name: 'Pets',
    icons: [
      { icon: '🐱', keywords: ['cat', 'feed cat', 'litter box', 'litter', 'clean litter box'] },
      { icon: '🐶', keywords: ['dog', 'feed dog', 'walk dog', 'walk the dog'] },
      { icon: '🐠', keywords: ['fish', 'feed fish', 'fish tank'] },
      { icon: '🐹', keywords: ['hamster', 'guinea pig'] },
      { icon: '🐦', keywords: ['bird', 'feed bird', 'bird cage'] },
      { icon: '🐾', keywords: ['pet', 'feed pet', 'feed the pet', 'pet food'] },
      { icon: '🦴', keywords: ['dog bone', 'dog treat'] },
    ],
  },
  {
    name: 'Kitchen & Meals',
    icons: [
      {
        icon: '🍽️',
        keywords: [
          'set table',
          'set the table',
          'clear table',
          'clear the table',
          'table',
          'empty dishwasher',
          'load dishwasher',
          'unload dishwasher',
          'dishwasher',
        ],
      },
      { icon: '🧽', keywords: ['dishes', 'wash dishes', 'wipe counter', 'clean counter', 'counters', 'scrub'] },
      { icon: '🍳', keywords: ['clean kitchen', 'kitchen', 'cook', 'cooking'] },
      { icon: '🍎', keywords: ['snack', 'snacks'] },
      { icon: '🚰', keywords: ['water bottle', 'refill bottle', 'water'] },
      { icon: '🥤', keywords: ['drink', 'juice'] },
      { icon: '🧊', keywords: ['ice', 'fridge', 'refrigerator'] },
      { icon: '🥪', keywords: ['sandwich', 'make lunch'] },
      { icon: '🍞', keywords: ['bread', 'toast'] },
      { icon: '🧁', keywords: ['bake', 'baking', 'cupcake'] },
      { icon: '🛒', keywords: ['groceries', 'shopping', 'grocery'] },
    ],
  },
  {
    name: 'Laundry & Clothes',
    icons: [
      { icon: '👕', keywords: ['fold laundry', 'fold clothes'] },
      { icon: '🧺', keywords: ['laundry', 'put away clothes', 'clothes', 'hamper'] },
      { icon: '👖', keywords: ['pants', 'jeans'] },
      { icon: '👗', keywords: ['dress'] },
      { icon: '🧵', keywords: ['sew', 'sewing', 'mending'] },
    ],
  },
  {
    name: 'Cleaning',
    icons: [
      { icon: '🧹', keywords: ['vacuum', 'vacuuming', 'sweep', 'sweeping', 'broom', 'dust', 'dusting'] },
      { icon: '🧽', keywords: ['mop', 'mopping'] },
      { icon: '🚽', keywords: ['clean bathroom', 'bathroom'] },
      { icon: '🗑️', keywords: ['trash', 'garbage'] },
      { icon: '♻️', keywords: ['recycling', 'recycle', 'recycle bin'] },
      { icon: '🪣', keywords: ['bucket', 'mop bucket'] },
      { icon: '🕸️', keywords: ['cobweb', 'spider web', 'cobwebs'] },
    ],
  },
  {
    name: 'Outdoor & Yard',
    icons: [
      { icon: '🪴', keywords: ['water plant', 'water the plant', 'water garden', 'water the garden', 'plants'] },
      { icon: '🌱', keywords: ['mow', 'yard work', 'lawn'] },
      { icon: '🍂', keywords: ['rake leaves', 'rake the leaves', 'leaves'] },
      { icon: '❄️', keywords: ['shovel', 'snow'] },
      { icon: '🚗', keywords: ['wash car', 'clean car', 'car'] },
      { icon: '📬', keywords: ['mail', 'mailbox'] },
      { icon: '🌻', keywords: ['garden', 'gardening', 'flowers'] },
      { icon: '🪵', keywords: ['firewood', 'wood'] },
      { icon: '🏡', keywords: ['yard', 'outside', 'outdoor'] },
    ],
  },
  {
    name: 'Screens & Bedtime',
    icons: [
      { icon: '📱', keywords: ['screen time', 'tv time', 'tablet'] },
      { icon: '🎮', keywords: ['video game', 'video games'] },
      { icon: '📺', keywords: ['tv', 'television', 'watch tv'] },
      { icon: '🌙', keywords: ['bedtime', 'go to bed', 'lights out'] },
      { icon: '⏰', keywords: ['alarm', 'alarm clock', 'wake up'] },
      { icon: '😴', keywords: ['sleep', 'nap'] },
    ],
  },
  {
    name: 'Health & Safety',
    icons: [
      { icon: '💊', keywords: ['medicine', 'vitamins', 'pills'] },
      { icon: '🩹', keywords: ['bandage', 'boo boo'] },
      { icon: '🌡️', keywords: ['thermometer', 'temperature', 'sick'] },
      { icon: '😷', keywords: ['mask'] },
      { icon: '🩺', keywords: ['doctor', 'checkup', 'appointment'] },
      { icon: '🦷', keywords: ['dentist', 'teeth'] },
    ],
  },
  {
    name: 'Money & Errands',
    icons: [
      { icon: '🪙', keywords: ['allowance', 'chores money'] },
      { icon: '🐷', keywords: ['piggy bank', 'savings'] },
      { icon: '🛍️', keywords: ['errands'] },
      { icon: '💳', keywords: ['wallet', 'money'] },
      { icon: '📦', keywords: ['package', 'delivery', 'box'] },
    ],
  },
  {
    name: 'Family & Fun',
    icons: [
      { icon: '🎉', keywords: ['party', 'celebrate', 'celebration'] },
      { icon: '🎂', keywords: ['birthday', 'cake'] },
      { icon: '🎁', keywords: ['gift', 'present'] },
      { icon: '🥳', keywords: [] },
      { icon: '❤️', keywords: ['love', 'family'] },
      { icon: '🤗', keywords: ['hug'] },
    ],
  },
  {
    name: 'General',
    icons: [
      { icon: '⭐', keywords: [] },
      { icon: '🌟', keywords: [] },
      { icon: '🏆', keywords: [] },
      { icon: '👍', keywords: [] },
      { icon: '💪', keywords: [] },
      { icon: '🔥', keywords: [] },
      { icon: '✨', keywords: [] },
      { icon: '😊', keywords: [] },
      { icon: '🙌', keywords: [] },
      { icon: '🎯', keywords: [] },
      { icon: '📝', keywords: [] },
    ],
  },
];

// Shown when nothing in the library matches - a plain notepad rather than
// a star, so a task that just hasn't been taught to the library yet reads
// as "unrecognized" instead of looking like a reward/achievement badge.
const DEFAULT_ICON = '📝';

export function getTaskIcon(title) {
  // Word-set match, not a raw substring test - "Feed the dog" still matches
  // the keyword "feed dog" despite "the" sitting in between (every word in
  // the keyword just needs to appear somewhere in the title), and matching
  // on whole words rather than substrings avoids false hits like "read"
  // inside "already" or "bread".
  const titleWords = new Set((title || '').toLowerCase().match(/[a-z']+/g) || []);
  for (const category of TASK_ICON_CATEGORIES) {
    for (const entry of category.icons) {
      const isMatch = entry.keywords.some((keyword) => keyword.split(' ').every((word) => titleWords.has(word)));
      if (isMatch) return entry.icon;
    }
  }
  return DEFAULT_ICON;
}
