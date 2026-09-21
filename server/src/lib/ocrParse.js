import * as chrono from 'chrono-node';

const LOCATION_HINTS = /\b(at|@|location|room|gym|school|church|park|center|centre|library|field|hall|studio|street|st\.|ave|avenue|rd\.|road)\b/i;

// Best-effort extraction of a title/date/time/location from raw OCR text off a flyer,
// poster, or paper calendar page. Always returns editable suggestions - the person
// confirms/corrects them in the UI before anything is saved to the calendar.
export function parseFlyerText(text) {
  const lines = text
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

  const dateLineIndexes = new Set(
    parsedDates.map((p) => lines.findIndex((l) => l.includes(p.text))).filter((i) => i >= 0)
  );

  let title = lines.find((l, i) => !dateLineIndexes.has(i) && l.length > 3) || lines[0] || '';
  title = title.slice(0, 120);

  let location = '';
  const locationLine = lines.find((l, i) => !dateLineIndexes.has(i) && LOCATION_HINTS.test(l));
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
