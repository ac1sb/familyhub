// Shared ordering for Chores/Daily Checklist (and anything else with a
// `.done` flag): open items first (in their existing relative order), done
// ones after - checking something off drops it to the bottom instead of
// leaving it in place, so whatever's still open stays what's most visible.
// Array.prototype.sort is stable in every engine this app targets, so ties
// (both open, or both done) keep their original relative order.
export function sortDoneLast(items) {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done));
}
