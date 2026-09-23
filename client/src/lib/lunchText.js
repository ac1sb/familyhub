// Many school menu sites list the day's actual entree, then a standing list
// of always-available alternatives right after it with no separator
// ("...Marinated Black Bean Salad Daily Choices:Peanut Butter or..."). The
// sync now stops there for anything imported from here on, but this also
// cleans up display of anything already saved from before that fix, without
// needing a re-sync.
const AFTER_ENTREE_MARKER = /\bdaily\s+choices?\s*:/i;

// The source site's own markup sometimes puts a day's theme name (e.g.
// "Wacky Wednesday") directly against the entree text with no separator at
// all ("Wacky WednesdayChicken Philly..."), because the two came from
// adjacent block-level elements that plain text extraction just concatenates.
// Inserting a space wherever a lowercase letter/punctuation is immediately
// followed by a capital letter un-runs that without touching normal text.
const RUN_ON_WORD_BOUNDARY = /([a-z0-9!?.,;:])([A-Z])/g;

export function stripDailyChoices(text) {
  if (!text) return text;
  const match = text.match(AFTER_ENTREE_MARKER);
  const trimmed = match ? text.slice(0, match.index) : text;
  return trimmed.replace(RUN_ON_WORD_BOUNDARY, '$1 $2').replace(/\s+/g, ' ').trim();
}
