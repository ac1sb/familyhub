// A little "chore chart" icon library: maps common kid/household task
// wording to an emoji, for Squares display mode where a task is a small
// tile rather than a line of text. Order matters - checked top to bottom,
// so a specific phrase (e.g. "clean litter box") must come before a
// generic word it also contains (e.g. "clean") or the generic one would
// win first. Matching is a plain substring test against the lowercased
// title, so "Brush teeth before bed" still matches "brush teeth".
const TASK_ICON_LIBRARY = [
  // Personal care / getting ready
  { keywords: ['brush teeth', 'brushing teeth'], icon: '🦷' },
  { keywords: ['brush hair', 'hair brush'], icon: '💇' },
  { keywords: ['shower'], icon: '🚿' },
  { keywords: ['bath'], icon: '🛁' },
  { keywords: ['get dressed', 'getting dressed'], icon: '👕' },
  { keywords: ['wash hands'], icon: '🧼' },

  // Bedroom / personal space
  { keywords: ['make bed', 'make the bed'], icon: '🛏️' },
  { keywords: ['clean room', 'tidy room', 'clean up room'], icon: '🧸' },
  { keywords: ['put away toys', 'pick up toys', 'clean up toys'], icon: '🧸' },

  // School
  { keywords: ['pack backpack', 'pack bag', 'pack lunch'], icon: '🎒' },
  { keywords: ['homework'], icon: '📓' },
  { keywords: ['read', 'reading'], icon: '📖' },
  { keywords: ['study'], icon: '📚' },

  // Music / activities
  { keywords: ['piano'], icon: '🎹' },
  { keywords: ['violin'], icon: '🎻' },
  { keywords: ['guitar'], icon: '🎸' },
  { keywords: ['practice', 'clarinet', 'flute', 'trumpet', 'drums', 'music'], icon: '🎵' },
  { keywords: ['soccer', 'practice sports', 'basketball', 'baseball'], icon: '⚽' },
  { keywords: ['exercise', 'workout'], icon: '🏃' },

  // Pets
  { keywords: ['clean litter box', 'litter box'], icon: '🐱' },
  { keywords: ['feed cat'], icon: '🐱' },
  { keywords: ['feed dog'], icon: '🐶' },
  { keywords: ['walk dog', 'walk the dog'], icon: '🐕' },
  { keywords: ['feed fish'], icon: '🐠' },
  { keywords: ['feed pet', 'feed the pet', 'pet food'], icon: '🐾' },

  // Kitchen
  { keywords: ['set table', 'set the table'], icon: '🍽️' },
  { keywords: ['clear table', 'clear the table'], icon: '🍽️' },
  { keywords: ['empty dishwasher', 'load dishwasher', 'unload dishwasher'], icon: '🍽️' },
  { keywords: ['dishes', 'wash dishes'], icon: '🧽' },
  { keywords: ['wipe counter', 'clean counter'], icon: '🧽' },
  { keywords: ['clean kitchen'], icon: '🍳' },

  // Laundry
  { keywords: ['fold laundry', 'fold clothes'], icon: '👕' },
  { keywords: ['laundry', 'put away clothes'], icon: '🧺' },

  // Cleaning
  { keywords: ['vacuum'], icon: '🧹' },
  { keywords: ['sweep'], icon: '🧹' },
  { keywords: ['mop'], icon: '🧽' },
  { keywords: ['dust'], icon: '🪶' },
  { keywords: ['clean bathroom'], icon: '🚽' },
  { keywords: ['clean window', 'wash window'], icon: '🪟' },

  // Trash / recycling
  { keywords: ['recycling', 'recycle'], icon: '♻️' },
  { keywords: ['trash', 'garbage'], icon: '🗑️' },

  // Outdoor
  { keywords: ['water plant', 'water the plant', 'water garden', 'water the garden'], icon: '🪴' },
  { keywords: ['mow', 'yard work', 'lawn'], icon: '🌱' },
  { keywords: ['rake leaves', 'rake the leaves'], icon: '🍂' },
  { keywords: ['shovel', 'snow'], icon: '❄️' },
  { keywords: ['wash car', 'clean car'], icon: '🚗' },

  // Screens / bedtime
  { keywords: ['screen time', 'tv time', 'video game'], icon: '📱' },
  { keywords: ['bedtime', 'go to bed', 'lights out'], icon: '🌙' },
];

// Shown when nothing in the library matches - still friendly/on-theme
// rather than a blank or a generic bullet.
const DEFAULT_ICON = '⭐';

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
