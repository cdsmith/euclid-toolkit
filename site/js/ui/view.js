// The view of the sheet: the canvas, how the construction's coordinates map onto it (pan and zoom),
// fitting the construction in view, and the colors it's drawn in.
import { $ } from './dom.js';
import { draw } from './draw.js';
import { ELIST, VALS, doc, roleOf, sheet } from './sheet.js';

// The view's center, in the construction's coordinates, and its scale (screen pixels per unit).
export const view = { cx: 0, cy: 0, s: 1.5 };

export const cv = $('#cv');
export const ctx = cv.getContext('2d');

// The canvas's size on screen, in CSS pixels, and the device pixels in each.
export let W = 0;
export let H = 0;
export let dpr = 1;

// Where draw() blurs the goal from.
export const goalCanvas = document.createElement('canvas');

export const toScreen = (x, y) => [(x - view.cx) * view.s + W / 2, (y - view.cy) * view.s + H / 2];
export const toWorld = (sx, sy) => [
  (sx - W / 2) / view.s + view.cx,
  (sy - H / 2) / view.s + view.cy,
];

// Sizes the canvas to fit its place on the page.
export function measure() {
  const r = $('#stage').getBoundingClientRect();
  W = r.width;
  H = r.height;
  dpr = window.devicePixelRatio || 1;
  const cw = Math.max(1, Math.round(W * dpr));
  const ch = Math.max(1, Math.round(H * dpr));
  if (cv.width !== cw) cv.width = cw;
  if (cv.height !== ch) cv.height = ch;
}

// Puts the construction in view. What's fitted is what's shown of the givens, and arbitrary points;
// not the hidden setup behind the givens. A lesson's diagram is a picture, all of it shown.
export function fitView() {
  if (!W || !H || !doc) return;
  const xs = [];
  const ys = [];
  const add = (v) => {
    if (v?.kind === 'point') {
      xs.push(v.x);
      ys.push(v.y);
    } else if (v?.kind === 'circle') {
      xs.push(v.cx - v.r, v.cx + v.r);
      ys.push(v.cy - v.r, v.cy + v.r);
    }
  };
  for (const e of ELIST) {
    const role = roleOf(e);
    const fitted = sheet.kind === 'diagram' || role === 'given' || role === 'arb';
    if (!e.internal && fitted) add(VALS.get(e.id));
  }
  if (!xs.length) ELIST.forEach((e) => add(VALS.get(e.id)));
  if (!xs.length) {
    xs.push(-150, 150);
    ys.push(-100, 100);
  }
  // The drawing takes up a little over half the view (a lesson's diagram, more: there's nothing to
  // add to it), centered across, and down a little above center, clear of the buttons along the
  // bottom.
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const room = sheet.kind === 'diagram' ? 1.2 : 1.75;
  const across = (W - 40) / (Math.max(x1 - x0, 180) * room);
  const down = (H - 70) / (Math.max(y1 - y0, 180) * room);
  view.s = Math.max(0.2, Math.min(across, down));
  view.cx = (x0 + x1) / 2;
  view.cy = (y0 + y1) / 2 + 20 / view.s;
}

// Zooms by a factor f, keeping the point under (sx, sy) where it is.
export function zoomAt(sx, sy, f) {
  const [wx, wy] = toWorld(sx, sy);
  view.s = Math.min(60, Math.max(0.05, view.s * f));
  view.cx = wx - (sx - W / 2) / view.s;
  view.cy = wy - (sy - H / 2) / view.s;
  draw();
}

// The colors an element can be given (their CSS variables are --c-<name>), and line styles.
// prettier-ignore
export const PALETTE = [
  ['ink', 'Black'], ['red', 'Red'], ['orange', 'Orange'], ['gold', 'Gold'], ['green', 'Green'],
  ['teal', 'Teal'], ['blue', 'Blue'], ['violet', 'Violet'], ['pink', 'Pink'], ['gray', 'Gray'],
];
export const DASH = { dashed: [9, 6], dotted: [1.5, 5] };
export const WEIGHT = { thin: 0.6, bold: 2 };

// The canvas draws in the page's colors (CSS variables, which change with dark mode), read into
// COL by name.
export const COL = {};
// prettier-ignore
const COLOR_NAMES = [
  'paper', 'ink', 'ink-2', 'ink-3', 'grid', 'grid-major', 'blue', 'accent', 'goal', 'ok', 'hover',
  'sel-in', 'sel-out', ...PALETTE.map(([name]) => 'c-' + name),
];
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const name of COLOR_NAMES) COL[name] = cs.getPropertyValue('--' + name).trim();
}
readColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  readColors();
  draw();
});
