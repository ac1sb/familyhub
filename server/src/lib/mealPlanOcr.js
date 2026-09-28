// Best-effort extraction of a recipe list from OCR'd text off a meal-kit
// order-slip screenshot (the layout this was built against: a left column of
// order metadata - date, "Delivered", order number, buttons - next to a
// right column listing one recipe per delivery, each recipe sometimes
// wrapping across two lines). Always returns whatever it found; the caller
// decides what to do with an empty result.
//
// `words` is tesseract.js's per-word result data: [{ text, bbox: {x0,y0,x1,y1} }].
// Word-level boxes are used rather than tesseract's own per-line grouping,
// because tesseract merges the two columns onto one "line" whenever they sit
// at the same height, and a short glyph like a stray "+" can otherwise land
// in its own tesseract "line" instead of the recipe line it is actually part
// of. Three steps do the work, all driven by bounding boxes rather than the
// words themselves, so this does not depend on any particular meal-kit
// service's exact copy:
//   1. Column split - a word is part of the recipe list only if it starts
//      past the widest horizontal gap between word start positions, which
//      throws out the left column's metadata regardless of what it says.
//   2. Line rebuilding - right-column words are regrouped into lines by
//      vertical center, letting a word join a line whenever its center falls
//      within that line's own (growing) vertical extent rather than just
//      near its immediate neighbor - this is what keeps a narrow glyph like
//      "+" attached to the normal-height words on either side of it.
//   3. Recipe grouping - two consecutive rebuilt lines get merged into one
//      recipe if the vertical gap between them is small relative to the
//      typical line height, which is what a wrapped second line of the same
//      recipe name looks like; a bigger gap means a new recipe started.
const COLUMN_MIN_FRACTION = 0.1;
const COLUMN_MAX_FRACTION = 0.7;
const COLUMN_FALLBACK_FRACTION = 0.35;
const LINE_CLUSTER_TOLERANCE_FACTOR = 0.4;
const WRAP_GAP_FACTOR = 0.8;
const BOILERPLATE = /^(delivered|order\s*#|order slip|view delivery|track|questions about|we.?re here to help|shipped|out for delivery)/i;
// A word with no letters or digits at all (stray OCR marks like "~~" or
// "--") never carries real recipe text, except "+", which is meaningful
// mid-name (e.g. "Ham + Swiss").
const JUNK_WORD = /^[^a-z0-9]+$/i;
const KEEP_DESPITE_JUNK = new Set(['+']);

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Finds where the recipe column starts by looking for the widest gap between
// consecutive word start-positions, in the middle stretch of the image width
// (avoiding trivial gaps right at either edge). Falls back to a fixed
// fraction of the content width if no clear gap is found.
function findColumnStart(words) {
  const contentWidth = Math.max(...words.map((w) => w.bbox.x1));
  const xs = [...new Set(words.map((w) => w.bbox.x0))].sort((a, b) => a - b);
  const minX = contentWidth * COLUMN_MIN_FRACTION;
  const maxX = contentWidth * COLUMN_MAX_FRACTION;

  let bestGap = 0;
  let bestSplit = null;
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i] < minX || xs[i] > maxX) continue;
    const gap = xs[i + 1] - xs[i];
    if (gap > bestGap) {
      bestGap = gap;
      bestSplit = (xs[i] + xs[i + 1]) / 2;
    }
  }
  return bestSplit != null ? bestSplit : contentWidth * COLUMN_FALLBACK_FRACTION;
}

// Rebuilds text lines from word-level boxes by vertical center, letting a
// word join the line above it whenever its center falls inside that line's
// own extent (expanded by a small tolerance) - not just close to the last
// word added - so an odd-shaped glyph nested between two normal words still
// lands on the same line as both of them.
function buildLines(words) {
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const typicalHeight = median(sorted.map((w) => w.bbox.y1 - w.bbox.y0)) || 20;
  const tolerance = typicalHeight * LINE_CLUSTER_TOLERANCE_FACTOR;

  const lines = [];
  for (const word of sorted) {
    const center = (word.bbox.y0 + word.bbox.y1) / 2;
    const last = lines[lines.length - 1];
    if (last && center >= last.y0 - tolerance && center <= last.y1 + tolerance) {
      last.words.push(word);
      last.y0 = Math.min(last.y0, word.bbox.y0);
      last.y1 = Math.max(last.y1, word.bbox.y1);
    } else {
      lines.push({ y0: word.bbox.y0, y1: word.bbox.y1, words: [word] });
    }
  }

  return lines.map((line) => ({
    text: line.words
      .slice()
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .map((w) => w.text)
      .join(' ')
      .trim(),
    bbox: { y0: line.y0, y1: line.y1 },
  }));
}

export function parseMealPlanRecipes(words) {
  const cleaned = (Array.isArray(words) ? words : [])
    .map((w) => ({ text: (w.text || '').trim(), bbox: w.bbox }))
    .filter(
      (w) => w.text.length > 0 && w.bbox && (KEEP_DESPITE_JUNK.has(w.text) || !JUNK_WORD.test(w.text))
    );

  if (cleaned.length === 0) return [];

  const columnStart = findColumnStart(cleaned);
  const recipeWords = cleaned.filter((w) => w.bbox.x0 >= columnStart);
  if (recipeWords.length === 0) return [];

  const recipeLines = buildLines(recipeWords).filter(
    (l) => l.text.length > 1 && !BOILERPLATE.test(l.text)
  );
  if (recipeLines.length === 0) return [];

  const lineHeight = median(recipeLines.map((l) => l.bbox.y1 - l.bbox.y0)) || 20;

  const recipes = [];
  let prevBottom = null;
  for (const line of recipeLines) {
    const gap = prevBottom == null ? Infinity : line.bbox.y0 - prevBottom;
    if (recipes.length > 0 && gap < lineHeight * WRAP_GAP_FACTOR) {
      recipes[recipes.length - 1] += ' ' + line.text;
    } else {
      recipes.push(line.text);
    }
    prevBottom = line.bbox.y1;
  }

  // A stray single word or two (a misread fragment, a page header) isn't a
  // real recipe name - real ones from every meal-kit service seen so far
  // run well past this.
  return recipes.filter((r) => r.length >= 8);
}
