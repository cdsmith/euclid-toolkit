// Where a problem's sheet puts things on screen: the bounds fitView fits, for a test to click at.
import * as E from './engine.js';

const pr = E.ITEMS.find((p) => p.id === process.argv[2]);

const g = E.problemSheet(pr);

const v = E.evaluate(g);

const xs = [];

const ys = [];

for (const e of Object.values(g.elems)) {
  const x = v.get(e.id);
  if (!x || e.internal) continue;
  if (x.kind === 'point') {
    xs.push(x.x);
    ys.push(x.y);
  } else if (x.kind === 'circle') {
    xs.push(x.cx - x.r, x.cx + x.r);
    ys.push(x.cy - x.r, x.cy + x.r);
  }
}

const x0 = Math.min(...xs);

const x1 = Math.max(...xs);

const y0 = Math.min(...ys);

const y1 = Math.max(...ys);

console.log(
  JSON.stringify({
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    bw: Math.max(x1 - x0, 180),
    bh: Math.max(y1 - y0, 180),
  }),
);
