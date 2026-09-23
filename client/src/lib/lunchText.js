// Many school menu sites list the day's actual entree, then a standing list
// of always-available alternatives right after it with no separator
// ("...Marinated Black Bean Salad Daily Choices:Peanut Butter or..."). The
// sync now stops there for anything imported from here on, but this also
// cleans up display of anything already saved from before that fix, without
// needing a re-sync.
const AFTER_ENTREE_MARKER = /\bdaily\s+choices?\s*:/i;

export function stripDailyChoices(text) {
  if (!text) return text;
  const match = text.match(AFTER_ENTREE_MARKER);
  const trimmed = match ? text.slice(0, match.index) : text;
  return trimmed.replace(/\s+/g, ' ').trim();
}
