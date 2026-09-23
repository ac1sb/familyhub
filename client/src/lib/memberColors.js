import { useEffect, useState } from 'react';

const BASE_COLORS = ['#1a1a1a', '#c0392b', '#2d6cdf', '#2e8b57', '#e08e2b'];
const MEMBER_VARS = ['--color-member-1', '--color-member-2', '--color-member-3'];

// A pen-color palette for drawing surfaces (whiteboard, ...): a few basics
// plus each family member's own color, read from the CSS custom properties
// so it stays in sync with the current theme instead of a second hardcoded
// copy of those hex values.
export function useMemberColorPalette() {
  const [palette, setPalette] = useState(BASE_COLORS);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const memberHexes = MEMBER_VARS.map((v) => styles.getPropertyValue(v).trim()).filter(Boolean);
    setPalette([...BASE_COLORS, ...memberHexes]);
  }, []);

  return palette;
}
