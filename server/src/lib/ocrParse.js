import * as chrono from 'chrono-node';

const LOCATION_HINTS = /\b(at|@|location|room|gym|school|church|park|center|centre|library|field|hall|studio|street|st\.|ave|avenue|rd\.|road)\b/i;

// A street address ("123 Main St") or a bare zip code is a much stronger
// location signal than the keyword list above, which misses plain venue
// addresses that don't happen to contain a word like "at" or "gym".
const ADDRESS_PATTERN =
  /\b\d{1,6}\s+[\w.]+(\s+[\w.]+){0,2}\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|circle|cir|highway|hwy)\.?\b/i;
const ZIP_PATTERN = /\b\d{5}(-\d{4})?\b/;

function isNoiseLine(text) {
  return text.length <= 3 || /^[\W_]+$/.test(text);
}

// Best-effort extraction of a title/date/time/location from raw OCR text off a flyer,
// poster, or paper calendar page. Always returns editable suggestions - the person
// confirms/corrects them in the UI before anything is saved to the calendar.
//
// `lines` is tesseract.js's optional per-line result data (each with a `text` and a
// `bbox`), when the caller has it available - used to prefer whichever line has the
// tallest bounding box as the title, since a flyer's event name is almost always the
// biggest/boldest text on the page, not necessarily the first line read top-to-bottom
// (that's often a logo, header, or date line instead). Falls back to the old
// first-non-date-line heuristic when no line data is passed in.
export function parseFlyerText(text, lines = []) {
  const textLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsedDates = chrono.parse(text, new Date(), { forwardDate: true });

  let start_datetime = null;
  let end_datetime = null;
  if (parsedDates.length > 0) {
    const best = parsedDates[0];
    start_datetime = best.start ? best.start.date().toISOString() : null;
    end_datetime = best.end ? best.end.date().toISOString() : null;
  }

  function overlapsDate(line) {
    return parsedDates.some((p) => line.includes(p.text) || p.text.includes(line));
  }

  const dateLineIndexes = new Set(textLines.map((l, i) => (overlapsDate(l) ? i : -1)).filter((i) => i >= 0));

  let title = null;
  if (Array.isArray(lines) && lines.length > 0) {
    const candidates = lines
      .map((l) => ({
        text: (l.text || '').trim(),
        height: (l.bbox?.y1 ?? 0) - (l.bbox?.y0 ?? 0),
      }))
      .filter((l) => !isNoiseLine(l.text) && l.text.length <= 120 && !overlapsDate(l.text));
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.height - a.height);
      title = candidates[0].text;
    }
  }
  if (!title) {
    title = textLines.find((l, i) => !dateLineIndexes.has(i) && l.length > 3) || textLines[0] || '';
  }
  title = title.slice(0, 120);

  let location = '';
  const addressLine = textLines.find(
    (l, i) => !dateLineIndexes.has(i) && (ADDRESS_PATTERN.test(l) || ZIP_PATTERN.test(l))
  );
  const keywordLine = textLines.find((l, i) => !dateLineIndexes.has(i) && LOCATION_HINTS.test(l));
  const locationLine = addressLine || keywordLine;
  if (locationLine) {
    location = locationLine.replace(/^(at|location:?|@)\s*/i, '').trim();
  }

  return {
    title,
    location,
    start_datetime,
    end_datetime,
    raw_text: text,
    confidence: parsedDates.length > 0 ? 'medium' : 'low',
  };
}
