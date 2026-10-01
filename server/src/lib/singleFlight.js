// Wraps an async function so a call made while a previous one is still
// running shares that run (and its result) instead of starting a second,
// overlapping one alongside it.
export function singleFlight(fn) {
  let running = null;
  return (...args) => {
    if (!running) {
      running = fn(...args).finally(() => {
        running = null;
      });
    }
    return running;
  };
}
