// A little "chore chart" icon library: maps common kid/household task
// wording to an emoji, for Squares display mode where a task is a small
// tile rather than a line of text. Order matters - checked top to bottom,
// so a specific phrase (e.g. "clean litter box") should come before a
// generic word it also contains (e.g. "clean") or the generic one would
// win first. Each entry lists several ways a task might actually get
// typed - a full phrase ("pack backpack") alongside the bare noun someone
// might type instead ("backpack") - since a real chore list is often just
// one or two words, not a full sentence.
const TASK_ICON_LIBRARY = [
  // Personal care / getting ready
  { keywords: ['brush teeth', 'brushing teeth', 'teeth', 'toothbrush'], icon: '🦷' },
  { keywords: ['brush hair', 'hair brush', 'hairbrush'], icon: '💇' },
  { keywords: ['shower'], icon: '🚿' },
  { keywords: ['bath', 'bathtime'], icon: '🛁' },
  { keywords: ['get dressed', 'getting dressed'], icon: '👕' },
  { keywords: ['wash hands'], icon: '🧼' },
  { keywords: ['shoes', 'sneakers'], icon: '👟' },
  { keywords: ['jacket', 'coat'], icon: '🧥' },
  { keywords: ['socks'], icon: '🧦' },

  // Bedroom / personal space
  { keywords: ['make bed', 'make the bed', 'bed'], icon: '🛏️' },
  { keywords: ['clean room', 'tidy room', 'clean up room', 'bedroom'], icon: '🧹' },
  { keywords: ['put away toys', 'pick up toys', 'clean up toys', 'toys'], icon: '🧸' },

  // School
  { keywords: ['backpack', 'pack backpack', 'pack bag', 'book bag'], icon: '🎒' },
  { keywords: ['lunchbox', 'lunch box', 'pack lunch', 'lunch'], icon: '🍱' },
  { keywords: ['homework'], icon: '📓' },
  { keywords: ['read', 'reading', 'book', 'books'], icon: '📖' },
  { keywords: ['study', 'spelling', 'flashcards'], icon: '📚' },
  { keywords: ['bus', 'school bus', 'carpool'], icon: '🚌' },

  // Music / activities
  { keywords: ['piano'], icon: '🎹' },
  { keywords: ['violin'], icon: '🎻' },
  { keywords: ['guitar'], icon: '🎸' },
  { keywords: ['practice', 'clarinet', 'flute', 'trumpet', 'drums', 'music', 'band'], icon: '🎵' },
  { keywords: ['soccer', 'practice sports', 'basketball', 'baseball', 'sports'], icon: '⚽' },
  { keywords: ['exercise', 'workout', 'stretch'], icon: '🏃' },
  { keywords: ['bike', 'bicycle', 'scooter'], icon: '🚲' },
  { keywords: ['draw', 'drawing', 'art', 'coloring'], icon: '🎨' },

  // Pets
  { keywords: ['clean litter box', 'litter box', 'litter'], icon: '🐱' },
  { keywords: ['feed cat', 'cat'], icon: '🐱' },
  { keywords: ['feed dog', 'walk dog', 'walk the dog', 'dog'], icon: '🐶' },
  { keywords: ['feed fish', 'fish tank', 'fish'], icon: '🐠' },
  { keywords: ['feed pet', 'feed the pet', 'pet food', 'pet'], icon: '🐾' },

  // Kitchen
  { keywords: ['set table', 'set the table'], icon: '🍽️' },
  { keywords: ['clear table', 'clear the table', 'table'], icon: '🍽️' },
  { keywords: ['empty dishwasher', 'load dishwasher', 'unload dishwasher', 'dishwasher'], icon: '🍽️' },
  { keywords: ['dishes', 'wash dishes'], icon: '🧽' },
  { keywords: ['wipe counter', 'clean counter', 'counters'], icon: '🧽' },
  { keywords: ['clean kitchen', 'kitchen'], icon: '🍳' },
  { keywords: ['snack', 'snacks'], icon: '🍎' },
  { keywords: ['water bottle', 'refill bottle'], icon: '🚰' },

  // Laundry
  { keywords: ['fold laundry', 'fold clothes'], icon: '👕' },
  { keywords: ['laundry', 'put away clothes', 'clothes', 'hamper'], icon: '🧺' },

  // Cleaning
  { keywords: ['vacuum', 'vacuuming'], icon: '🧹' },
  { keywords: ['sweep', 'sweeping', 'broom'], icon: '🧹' },
  { keywords: ['mop', 'mopping'], icon: '🧽' },
  { keywords: ['dust', 'dusting'], icon: '🪶' },
  { keywords: ['clean bathroom', 'bathroom'], icon: '🚽' },
  { keywords: ['clean window', 'wash window', 'windows'], icon: '🪟' },

  // Trash / recycling
  { keywords: ['recycling', 'recycle', 'recycle bin'], icon: '♻️' },
  { keywords: ['trash', 'garbage'], icon: '🗑️' },

  // Outdoor
  { keywords: ['water plant', 'water the plant', 'water garden', 'water the garden', 'plants'], icon: '🪴' },
  { keywords: ['mow', 'yard work', 'lawn'], icon: '🌱' },
  { keywords: ['rake leaves', 'rake the leaves', 'leaves'], icon: '🍂' },
  { keywords: ['shovel', 'snow'], icon: '❄️' },
  { keywords: ['wash car', 'clean car', 'car'], icon: '🚗' },
  { keywords: ['mail', 'mailbox'], icon: '📬' },

  // Screens / bedtime
  { keywords: ['screen time', 'tv time', 'video game', 'video games', 'tablet'], icon: '📱' },
  { keywords: ['bedtime', 'go to bed', 'lights out'], icon: '🌙' },
];

// Shown when nothing in the library matches - a plain notepad rather than
// a star, so a task that just hasn't been taught to the library yet reads
// as "unrecognized" instead of looking like a reward or achievement badge.
const DEFAULT_ICON = '📝';

export function getTaskIcon(title) {
  // Word-set match, not a raw substring test - "Feed the dog" still matches
  // the keyword "feed dog" despite "the" sitting in between (every word in
  // the keyword just needs to appear somewhere in the title), and matching
  // on whole words rather than substrings avoids false hits like "read"
  // inside "already" or "bread".
  const titleWords = new Set((title || '').toLowerCase().match(/[a-z']+/g) || []);
  for (const entry of TASK_ICON_LIBRARY) {
    const isMatch = entry.keywords.some((keyword) =>
      keyword.split(' ').every((word) => titleWords.has(word))
    );
    if (isMatch) return entry.icon;
  }
  return DEFAULT_ICON;
}
