// Seed tools for deps.py: Perpendicular bisector, and Midpoint built with it (a tool inside a
// tool).
import fs from 'node:fs';
import * as E from './engine.js';

const add = (g, node, kinds, labels = []) => E.addNode(g, node, kinds, labels).outs;

let g = E.newGraph();

const A = add(g, { op: 'point', ins: [], x: -60, y: 20 }, ['point'], ['A'])[0];

const B = add(g, { op: 'point', ins: [], x: 70, y: -10 }, ['point'], ['B'])[0];

const c1 = add(g, { op: 'circle', ins: [A, B] }, ['circle'])[0];

const c2 = add(g, { op: 'circle', ins: [B, A] }, ['circle'])[0];

const k1 = add(g, { op: 'isect', ins: [c1, c2], which: 0 }, ['point'])[0];

const k2 = add(g, { op: 'isect', ins: [c1, c2], which: 1 }, ['point'])[0];

const l = add(g, { op: 'line', ins: [k1, k2] }, ['line'])[0];

const pb = E.compileTool(g, [A, B], [l], 'Perpendicular bisector').tool;

pb.id = 'tPB';

pb.box = 'nb1';

E.TOOLS.set(pb.id, pb);

g = E.newGraph();

const P = add(g, { op: 'point', ins: [], x: -60, y: 20 }, ['point'], ['A'])[0];

const Q = add(g, { op: 'point', ins: [], x: 70, y: -10 }, ['point'], ['B'])[0];

const [m] = add(g, { op: 'tool', tool: 'tPB', ins: [P, Q] }, ['line']);

const ab = add(g, { op: 'line', ins: [P, Q] }, ['line'])[0];

const M = add(g, { op: 'isect', ins: [m, ab], which: 0 }, ['point'])[0];

const mid = E.compileTool(g, [P, Q], [M], 'Midpoint').tool;

mid.id = 'tMid';

mid.box = 'nb1';

fs.writeFileSync(import.meta.dirname + '/deps-tools.json', JSON.stringify([pb, mid]));

console.log(
  'tool nodes in Midpoint:',
  Object.values(mid.graph.nodes)
    .filter((n) => n.op === 'tool')
    .map((n) => n.tool),
);
