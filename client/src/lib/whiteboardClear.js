import { api } from '../api.js';

// A 1x1 fully-transparent PNG - drawn on top of the drawing canvas's own
// white background fill, this reads as a blank board to anyone else's screen.
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGBgAAAAAP//XRcpzQAAAAZJREFUAwAADwADJDd96QAAAABJRU5ErkJggg==';

// Archives whatever was on the canvas right before it's wiped, then persists
// an actually-blank shared board so every other screen picks up the clear
// too - used by both the dashboard widget and the full whiteboard page.
export async function archiveAndClearWhiteboard(dataUrl) {
  await api.archiveWhiteboardNote(dataUrl);
  await api.saveWhiteboard(BLANK_PNG);
}
