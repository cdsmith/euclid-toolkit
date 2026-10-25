// Tests for the graph engine.
import * as E from './engine.js';

const PROBLEMS = E.ITEMS.filter((it) => it.kind === 'problem');

let fails = 0;

let passes = 0;

const ok = (c, m) => {
  if (!c) {
    fails++;
    console.log('FAIL', m);
  } else {
    passes++;
    if (process.env.V) console.log('ok  ', m);
  }
};

// ---------- helpers that build graphs the way the app does ----------
// A problem's sheet, or a blank diagram.
function mk(id) {
  if (id === 'diagram') return { L: null, g: E.newGraph() };
  const L = PROBLEMS.find((p) => p.id === id);
  return { L, g: E.problemSheet(L) };
}

const key = (d, label) => Object.values(d.g.elems).find((e) => e.label === label && !e.internal).id;

const add = (d, node, kinds, labels = []) => E.addNode(d.g, node, kinds, labels).outs;

const vals = (d) => E.evaluate(d.g);

const line = (d, a, b) => add(d, { op: 'line', ins: [a, b] }, ['line'])[0];

const circ = (d, c, p) => add(d, { op: 'circle', ins: [c, p] }, ['circle'])[0];

const free = (d, x, y, label = '') => add(d, { op: 'point', ins: [], x, y }, ['point'], [label])[0];

const onl = (d, l, t, label = '') => add(d, { op: 'point', ins: [l], t }, ['point'], [label])[0];

const onc = (d, c, a, label = '') => add(d, { op: 'point', ins: [c], a }, ['point'], [label])[0];

// choose: function(points) -> index, or {not: elemId}
function X(d, a, b, choose, label = '') {
  const v = vals(d);
  const pts = E.isectAll(v.get(a), v.get(b));
  if (!pts.length) throw new Error('no intersection');
  if (choose && choose.not)
    return add(d, { op: 'isect', ins: [a, b, choose.not] }, ['point'], [label])[0];
  return add(
    d,
    { op: 'isect', ins: [a, b], which: typeof choose === 'function' ? choose(pts) : 0 },
    ['point'],
    [label],
  )[0];
}

const use = (d, t, args) =>
  add(
    d,
    { op: 'tool', tool: t.id, ins: args },
    t.outs.map((o) => o.kind),
    t.outs.map((o, i) => (o.kind === 'point' ? 'T' + i : '')),
  );

function solved(d, name) {
  const r = E.checkGoal(d.L, d.g, vals(d));
  ok(r.solved, `${name}: solved (${r.found}/${r.total})`);
  return r;
}

function save(d, ins, outs, name) {
  const r = E.compileTool(
    d.g,
    ins.map((x) => (d.g.elems[x] ? x : key(d, x))),
    outs,
    name,
  );
  if (r.error) {
    ok(false, `${name}: ${r.error}`);
    return null;
  }
  E.TOOLS.set(r.tool.id, r.tool);
  ok(true, `${name} compiled`);
  return r.tool;
}

const minY = (pts) => (pts[0].y < pts[1].y ? 0 : 1);

const near = (v, p) => E.dist(v, p) < 1e-6;

const rnd = (() => {
  let a = 12345;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
})();

const rp = () => E.pt(rnd() * 300 - 150, rnd() * 300 - 150);

// ---------- all 16 problems ----------
let d;

let r;

let T = {};

d = mk('equilateral');

{
  const c1 = circ(d, key(d, 'A'), key(d, 'B'));
  const c2 = circ(d, key(d, 'B'), key(d, 'A'));
  X(d, c1, c2, minY);
  r = solved(d, 'equilateral');
  T.eq = save(d, ['A', 'B'], r.ids, 'Equilateral apex');
}

d = mk('perp-bisector');

{
  const c1 = circ(d, key(d, 'A'), key(d, 'B'));
  const c2 = circ(d, key(d, 'B'), key(d, 'A'));
  line(
    d,
    X(d, c1, c2, () => 0),
    X(d, c1, c2, () => 1),
  );
  r = solved(d, 'perp bisector');
  T.pb = save(d, ['A', 'B'], r.ids, 'Perpendicular bisector');
}

d = mk('midpoint');

{
  const [pb] = use(d, T.pb, [key(d, 'A'), key(d, 'B')]);
  X(d, pb, line(d, key(d, 'A'), key(d, 'B')), () => 0);
  r = solved(d, 'midpoint using a saved tool');
  T.mid = save(d, ['A', 'B'], r.ids, 'Midpoint');
}

d = mk('mirror');

{
  const a = onl(d, key(d, 'ℓ'), 0.3);
  const b = onl(d, key(d, 'ℓ'), 0.7);
  X(d, circ(d, a, key(d, 'P')), circ(d, b, key(d, 'P')), { not: key(d, 'P') });
  r = solved(d, 'mirror');
  T.refl = save(d, ['ℓ', 'P'], r.ids, 'Reflect');
}

d = mk('perpendicular');

{
  const P = key(d, 'P');
  const F = free(d, 60, 140);
  const c = circ(d, P, F);
  const q1 = X(d, key(d, 'ℓ'), c, () => 0);
  const q2 = X(d, key(d, 'ℓ'), c, () => 1);
  const c1 = circ(d, q1, q2);
  const c2 = circ(d, q2, q1);
  line(
    d,
    X(d, c1, c2, () => 0),
    X(d, c1, c2, () => 1),
  );
  r = solved(d, 'perpendicular');
  T.perp = save(d, ['ℓ', 'P'], r.ids, 'Perpendicular');
}

d = mk('parallel');

{
  const A = onl(d, key(d, 'ℓ'), 0.35);
  const ca = circ(d, A, key(d, 'P'));
  const B = X(d, key(d, 'ℓ'), ca, () => 1);
  const Q = X(d, circ(d, B, A), circ(d, key(d, 'P'), A), { not: A });
  line(d, key(d, 'P'), Q);
  r = solved(d, 'parallel');
  T.par = save(d, ['ℓ', 'P'], r.ids, 'Parallel');
}

d = mk('angle-bisector');

{
  const l = key(d, 'ℓ');
  const m = key(d, 'm');
  const V = X(d, l, m, () => 0);
  const P = onl(d, l, 0.85);
  const cv = circ(d, V, P);
  const Q = X(d, m, cv, () => 1);
  const Z = X(d, circ(d, P, V), circ(d, Q, V), { not: V });
  line(d, V, Z);
  r = solved(d, 'angle bisector (acute)');
}

d = mk('transfer');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  const C = key(d, 'C');
  const c1 = circ(d, A, C);
  const c2 = circ(d, C, A);
  const X1 = X(d, c1, c2, () => 0);
  const X2 = X(d, c1, c2, () => 1);
  const B2 = X(d, circ(d, X1, B), circ(d, X2, B), { not: B });
  circ(d, C, B2);
  r = solved(d, 'transfer distance');
  T.rig = save(d, ['A', 'B', 'C'], r.ids, 'Rigid compass');
}

d = mk('trisect');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  const ca = circ(d, A, B);
  const cb = circ(d, B, A);
  const P = X(d, ca, cb, () => 0);
  const Q = X(d, ca, cb, () => 1);
  const Rr = X(d, ca, circ(d, Q, A), { not: B });
  const N = X(d, line(d, B, Rr), line(d, A, Q), () => 0);
  const lab = line(d, A, B);
  const X1 = X(d, line(d, P, N), lab, () => 0);
  X(d, circ(d, X1, A), lab, { not: A });
  r = solved(d, 'trisect');
}

d = mk('circumcircle');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  const C = key(d, 'C');
  const a1 = circ(d, A, B);
  const a2 = circ(d, B, A);
  const l1 = line(
    d,
    X(d, a1, a2, () => 0),
    X(d, a1, a2, () => 1),
  );
  const b1 = circ(d, B, C);
  const b2 = circ(d, C, B);
  const l2 = line(
    d,
    X(d, b1, b2, () => 0),
    X(d, b1, b2, () => 1),
  );
  circ(
    d,
    X(d, l1, l2, () => 0),
    A,
  );
  r = solved(d, 'circumcircle');
}

d = mk('center');

{
  const w = key(d, 'ω');
  const A = onc(d, w, -2.2);
  const B = onc(d, w, -0.9);
  const cab = circ(d, A, B);
  const C = X(d, cab, w, { not: B });
  const cba = circ(d, B, A);
  const l1 = line(
    d,
    X(d, cab, cba, () => 0),
    X(d, cab, cba, () => 1),
  );
  const Dp = X(d, cba, circ(d, C, A), { not: A });
  X(d, l1, line(d, A, Dp), () => 0);
  r = solved(d, 'find the center');
  T.ctr = save(d, ['ω'], r.ids, 'Center');
  if (T.ctr)
    ok(
      near(E.runTool(T.ctr, [E.mkCircle(E.pt(300, -40), 57)])[0], E.pt(300, -40)),
      'center tool works on a new circle',
    );
}

d = mk('tangents');

{
  const O = key(d, 'O');
  const P = key(d, 'P');
  const w = key(d, 'ω');
  const c1 = circ(d, O, P);
  const c2 = circ(d, P, O);
  const M = X(
    d,
    line(
      d,
      X(d, c1, c2, () => 0),
      X(d, c1, c2, () => 1),
    ),
    line(d, O, P),
    () => 0,
  );
  const cm = circ(d, M, O);
  line(
    d,
    P,
    X(d, cm, w, () => 0),
  );
  line(
    d,
    P,
    X(d, cm, w, () => 1),
  );
  r = solved(d, 'tangents');
}

d = mk('hexagon');

{
  const O = key(d, 'O');
  const A = key(d, 'A');
  const w = key(d, 'ω');
  const D = X(d, line(d, O, A), w, { not: A });
  const cd = circ(d, D, O);
  const ca = circ(d, A, O);
  [cd, ca].forEach((c) => {
    X(d, c, w, () => 0);
    X(d, c, w, () => 1);
  });
  r = solved(d, 'hexagon');
  T.hex = save(d, ['ω', 'O', 'A'], r.ids, 'Hexagon');
}

d = mk('square-in-circle');

{
  const O = key(d, 'O');
  const A = key(d, 'A');
  const w = key(d, 'ω');
  const C = X(d, line(d, O, A), w, { not: A });
  const c1 = circ(d, A, C);
  const c2 = circ(d, C, A);
  const l = line(
    d,
    X(d, c1, c2, () => 0),
    X(d, c1, c2, () => 1),
  );
  X(d, l, w, () => 0);
  X(d, l, w, () => 1);
  r = solved(d, 'square in circle');
}

d = mk('square-on-segment');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  const [perpLine] = use(d, T.perp, [line(d, A, B), B]);
  const cba = circ(d, B, A);
  const C = X(d, perpLine, cba, minY);
  X(d, circ(d, A, B), circ(d, C, B), { not: B });
  r = solved(d, 'square on segment using the saved Perpendicular tool');
}

d = mk('pentagon');

{
  const O = key(d, 'O');
  const A = key(d, 'A');
  const w = key(d, 'ω');
  const A2 = X(d, line(d, O, A), w, { not: A });
  const c1 = circ(d, A, A2);
  const c2 = circ(d, A2, A);
  const dia = line(
    d,
    X(d, c1, c2, () => 0),
    X(d, c1, c2, () => 1),
  );
  const B = X(d, dia, w, () => 0);
  const cbo = circ(d, B, O);
  const M = X(
    d,
    line(
      d,
      X(d, cbo, w, () => 0),
      X(d, cbo, w, () => 1),
    ),
    dia,
    () => 0,
  );
  const v = vals(d);
  const Ov = v.get(O);
  const N = X(d, circ(d, M, A), dia, (pts) => (E.dist(pts[0], Ov) < E.dist(pts[1], Ov) ? 0 : 1));
  const can = circ(d, A, N);
  const P1 = X(d, can, w, () => 0);
  const P4 = X(d, can, w, () => 1);
  X(d, circ(d, P1, A), w, { not: A });
  X(d, circ(d, P4, A), w, { not: A });
  r = solved(d, 'pentagon');
}

// ---------- tools ----------
// hexagon tool on a fresh circle
if (T.hex) {
  const out = E.runTool(T.hex, [E.mkCircle(E.pt(200, 50), 40), E.pt(200, 50), E.pt(240, 50)]);
  const ang = out
    .map((p) => Math.round((Math.atan2(p.y - 50, p.x - 200) * 180) / Math.PI))
    .sort((a, b) => a - b);
  ok(JSON.stringify(ang) === '[-120,-60,60,120,180]', 'hexagon tool on a new circle: ' + ang);
}

// reflect works on both sides of a line, and when P is dragged across
if (T.refl)
  for (const P of [E.pt(20, -50), E.pt(20, 50)]) {
    const o = E.runTool(T.refl, [E.mkLine(E.pt(-100, 0), E.pt(100, 0)), P])[0];
    ok(near(o, E.pt(P.x, -P.y)), `reflect P=(${P.x},${P.y})`);
  }

// midpoint was built with perp bisector, and keeps using it: it follows changes to perp bisector
if (T.mid) {
  ok(
    Object.values(T.mid.graph.nodes).some((n) => n.op === 'tool' && n.tool === T.pb.id),
    'midpoint uses perp bisector',
  );
  const o = E.runTool(T.mid, [E.pt(0, 0), E.pt(100, 40)])[0];
  ok(near(o, E.pt(50, 20)), 'a tool that uses another replays');
  const pb = E.TOOLS.get(T.pb.id);
  E.TOOLS.set(
    T.pb.id,
    Object.assign({}, pb, { graph: { rel: true, nodes: {}, elems: {}, seq: 0 }, outIds: [] }),
  );
  ok(!E.runTool(T.mid, [E.pt(0, 0), E.pt(100, 40)])[0], 'breaking perp bisector breaks midpoint');
  E.TOOLS.set(T.pb.id, pb);
}

// rigid compass
if (T.rig) {
  const o = E.runTool(T.rig, [E.pt(0, 0), E.pt(30, 40), E.pt(200, 100)])[0];
  ok(Math.abs(o.r - 50) < 1e-6 && near(E.pt(o.cx, o.cy), E.pt(200, 100)), 'rigid compass replays');
}

// perpendicular: P on or off the line
if (T.perp)
  for (const P of [E.pt(10, -80), E.pt(25, 5)]) {
    const L = E.mkLine(E.pt(-100, 0), E.pt(100, 40));
    const o = E.runTool(T.perp, [L, P])[0];
    const dx = o.x2 - o.x1;
    const dy = o.y2 - o.y1;
    ok(
      Math.abs(dx * 200 + dy * 40) < 1e-6 * Math.hypot(dx, dy) * 204 &&
        Math.abs((P.x - o.x1) * dy - (P.y - o.y1) * dx) / Math.hypot(dx, dy) < 1e-6,
      `perpendicular tool P=(${P.x},${P.y})`,
    );
  }

// dependence on an arbitrary point is rejected; names for unlabeled points
d = mk('perp-bisector');

{
  const F = free(d, 20, 80);
  const bad = E.compileTool(d.g, [key(d, 'A'), key(d, 'B')], [line(d, key(d, 'A'), F)], 'bad');
  ok(/the free point moves/.test(bad.error || ''), 'arbitrary dependence rejected: ' + bad.error);
}

d = mk('perp-bisector');

{
  const F = free(d, 20, 80, 'F');
  const bad = E.compileTool(d.g, [key(d, 'A'), key(d, 'B')], [line(d, key(d, 'A'), F)], 'bad');
  ok(
    /arbitrary point F moves/.test(bad.error || ''),
    'labeled arbitrary point named: ' + bad.error,
  );
}

// a given that isn't an input
d = mk('mirror');

{
  const c = circ(d, key(d, 'P'), onl(d, key(d, 'ℓ'), 0.5));
  const bad = E.compileTool(d.g, [key(d, 'P')], [c], 'bad');
  ok(
    /depend on ℓ, which isn't an input/.test(bad.error || ''),
    'missing input named: ' + bad.error,
  );
}

// free points placed on an input line before it was drawn count as points on it (the reported case)
d = mk('diagram');

{
  const A = free(d, -90, 30, 'A');
  const B = free(d, 80, 50, 'B');
  const AB = line(d, A, B);
  const P = free(d, -10, -70, 'P');
  const cA = circ(d, A, P);
  const cB = circ(d, B, P);
  const Q = X(d, cA, cB, { not: P });
  const out = line(d, P, Q);
  const t = save(d, [AB, P], [out], 'Perp via points on the line');
  if (t) {
    const L = E.mkLine(E.pt(0, 0), E.pt(50, 120));
    const Pn = E.pt(140, -20);
    const o = E.runTool(t, [L, Pn])[0];
    const dx = o.x2 - o.x1;
    const dy = o.y2 - o.y1;
    ok(
      Math.abs(dx * 50 + dy * 120) < 1e-6 * Math.hypot(dx, dy) * 130,
      'free points on an input line slide along it',
    );
  }
  const bad = E.compileTool(d.g, [AB, P], [cB], 'bad');
  ok(/arbitrary point B moves/.test(bad.error || ''), 'real dependence on B still caught');
}

// eyeballed point is not accepted
d = mk('midpoint');

{
  const v = vals(d);
  const A = v.get(key(d, 'A'));
  const B = v.get(key(d, 'B'));
  free(d, (A.x + B.x) / 2, (A.y + B.y) / 2);
  ok(!E.checkGoal(d.L, d.g, vals(d)).solved, 'eyeballed point is not accepted');
}

// "other than" survives reflection; handedness picks a side
d = mk('mirror');

{
  const a = onl(d, key(d, 'ℓ'), 0.3);
  const b = onl(d, key(d, 'ℓ'), 0.7);
  const R = X(d, circ(d, a, key(d, 'P')), circ(d, b, key(d, 'P')), { not: key(d, 'P') });
  const pn = d.g.nodes[d.g.elems[key(d, 'P')].node];
  pn.y = 185;
  const v = vals(d);
  ok(!E.same(v.get(R), v.get(key(d, 'P'))), 'dragging P across ℓ keeps the reflection');
}

// ---------- deleting ----------
d = mk('diagram');

{
  const A = free(d, 0, 0, 'A');
  const B = free(d, 100, 0, 'B');
  const c1 = circ(d, A, B);
  const c2 = circ(d, B, A);
  // made only as the line's input
  const top = add(d, { op: 'isect', ins: [c1, c2], which: 0, aux: true }, ['point'])[0];
  const far = add(d, { op: 'point', ins: [], x: 300, y: 300, aux: true }, ['point'])[0];
  const ln = line(d, top, far);
  const keep = free(d, -50, -50, 'K');
  const lineNode = d.g.elems[ln].node;
  let plan = E.deletionPlan(d.g, [lineNode]);
  ok(
    plan.all.has(lineNode) &&
      plan.all.has(d.g.elems[top].node) &&
      plan.all.has(d.g.elems[far].node) &&
      plan.all.size === 3,
    'deleting a line removes the side-effect points made for it',
  );
  const c1Node = d.g.elems[c1].node;
  plan = E.deletionPlan(d.g, [c1Node]);
  ok(
    [c1Node, d.g.elems[top].node, lineNode, d.g.elems[far].node].every((n) => plan.all.has(n)) &&
      !plan.all.has(d.g.elems[c2].node) &&
      !plan.all.has(d.g.elems[keep].node),
    'deleting a circle removes what is built on it, and nothing else',
  );
  {
    const m = mk('midpoint');
    ok(
      E.deletionPlan(m.g, [m.g.elems[key(m, 'A')].node]).roots.length === 0,
      'given nodes cannot be deleted',
    );
  }
  E.removeNodes(d.g, plan.all);
  const v = vals(d);
  ok(
    !d.g.elems[ln] && !!d.g.elems[c2] && v.get(c2) && v.get(keep),
    'removal leaves the rest evaluating',
  );
}

// labeled side-effect points are kept
d = mk('diagram');

{
  const A = free(d, 0, 0, 'A');
  const aux = add(d, { op: 'point', ins: [], x: 50, y: 50, aux: true }, ['point'], ['Q'])[0];
  const ln = line(d, A, aux);
  const plan = E.deletionPlan(d.g, [d.g.elems[ln].node]);
  ok(!plan.all.has(d.g.elems[aux].node), 'a side-effect point you labeled survives');
}

// ---------- editing tools ----------
if (T.mid) {
  const g = E.instantiateTool(T.mid);
  const v = E.evaluate(g);
  ok(
    T.mid.inIds.every((id) => g.nodes[g.elems[id].node].op === 'fixed') &&
      T.mid.outIds.every((id) => v.get(id)),
    'a tool lays out on a sheet with given inputs',
  );
  ok(
    T.mid.outIds.every((id, i) => E.same(v.get(id), E.runTool(T.mid, T.mid.sample)[i])),
    'laid-out tool matches the tool',
  );
  const r2 = E.compileTool(g, T.mid.inIds, T.mid.outIds, 'Midpoint');
  ok(
    !r2.error && r2.tool.ins.map((x) => x.kind).join() === T.mid.ins.map((x) => x.kind).join(),
    'resaving an unchanged tool keeps its signature',
  );
  let same = true;
  for (let i = 0; i < 20; i++) {
    const s = [rp(), rp()];
    const a = E.runTool(T.mid, s)[0];
    const b = E.runTool(r2.tool, s)[0];
    if (!E.same(a, b)) same = false;
  }
  ok(same, 'resaved tool behaves identically');
}

if (T.refl) {
  // edit Reflect to also output the line through P and its reflection: the signature changes
  const g = E.instantiateTool(T.refl);
  const dd = { g };
  const extra = add(dd, { op: 'line', ins: [T.refl.inIds[1], T.refl.outIds[0]] }, ['line'])[0];
  const r2 = E.compileTool(g, T.refl.inIds, [...T.refl.outIds, extra], 'Reflect plus');
  ok(!r2.error && r2.tool.outs.length === 2, 'adding an output changes the signature');
  const helper = Object.values(g.nodes).find((n) => n.op === 'circle').outs[0];
  ok(
    /point on ℓ moves/.test(E.compileTool(g, T.refl.inIds, [helper], 'x').error || ''),
    'an output that depends on a helper point is refused',
  );
}

// ---------- relations between a tool's inputs ---------- A tool keeps the relations its inputs
// have where it's made, if they hold however the free points are placed: O is the center of ω, P is
// on ℓ; Q, put on ℓ by eye, isn't.
{
  const d = mk('diagram');
  const O = free(d, -40, -30, 'O');
  const w = circ(d, O, free(d, 20, -30));
  const A = free(d, -120, 60, 'A');
  const B = free(d, 130, 60, 'B');
  const l = line(d, A, B);
  const P = onl(d, l, 0.3, 'P');
  const Q = free(d, -120 + 250 * 0.8, 60, 'Q');
  const out = line(d, O, P);
  const out2 = line(d, O, Q);
  const t = save(d, [w, O, l, P], [out], 'Mark');
  ok(
    t &&
      JSON.stringify(t.ins.map((x) => [x.on || [], x.center || []])) ===
        '[[[],[]],[[],[0]],[[],[]],[[2],[]]]',
    'O is the center of ω and P is on ℓ: ' + JSON.stringify(t && t.ins),
  );
  const t2 = save(d, [w, O, l, Q], [out2], 'Mark by eye');
  ok(t2 && !t2.ins[3].on, 'a point on ℓ by eye has no relation to it');
  // Using it: inputs that keep the relations pass; a point on ℓ by eye, or off it, doesn't, and
  // says whether it's there now.
  ok(
    E.brokenRelations(d.g, t, [w, O, l, P]).length === 0,
    'the inputs it was made from keep its relations',
  );
  const now = E.brokenRelations(d.g, t, [w, O, l, Q]);
  ok(
    now.length === 1 && JSON.stringify(now[0]) === '["on",3,2,true]',
    'a point on ℓ by eye breaks P on ℓ, though it holds as placed: ' + JSON.stringify(now),
  );
  const off = E.brokenRelations(d.g, t, [w, A, l, P]);
  ok(
    off.length === 1 && JSON.stringify(off[0]) === '["center",1,0,false]',
    'a point that is not the center breaks O the center of ω: ' + JSON.stringify(off),
  );
  // Laid out for editing, its inputs keep the relations, so saving it again keeps them too.
  const g = E.instantiateTool(t);
  const n = (id) => g.nodes[g.elems[id].node];
  ok(
    n(t.inIds[0]).op === 'circle' &&
      n(t.inIds[0]).ins[0] === t.inIds[1] &&
      n(t.inIds[3]).op === 'point' &&
      n(t.inIds[3]).ins[0] === t.inIds[2],
    'laid out for editing, ω is drawn about O and P is on ℓ',
  );
  const r = E.compileTool(g, t.inIds, t.outIds, 'Mark');
  ok(
    !r.error && JSON.stringify(r.tool.ins) === JSON.stringify(t.ins),
    'and saving it again keeps them: ' + JSON.stringify(r.tool && r.tool.ins),
  );
}

console.log(fails ? `${fails} FAILED` : 'relation checks ok');

// ---------- one goal per problem ----------
d = mk('equilateral');

{
  const c1 = circ(d, key(d, 'A'), key(d, 'B'));
  const c2 = circ(d, key(d, 'B'), key(d, 'A'));
  X(d, c1, c2, (pts) => 1 - minY(pts));
  ok(!E.checkGoal(d.L, d.g, vals(d)).solved, 'the clockwise apex is not the equilateral goal');
}

d = mk('angle-bisector');

{
  const l = key(d, 'ℓ');
  const m = key(d, 'm');
  const V = X(d, l, m, () => 0);
  const P = onl(d, l, 0.85);
  const cv = circ(d, V, P);
  const Q = X(d, m, cv, () => 0);
  const Z = X(d, circ(d, P, V), circ(d, Q, V), { not: V });
  line(d, V, Z);
  ok(!E.checkGoal(d.L, d.g, vals(d)).solved, 'the obtuse bisector is not the goal');
}

console.log(fails ? `${fails} FAILED` : 'goal checks ok');

// ---------- problems are diagrams ----------
for (const p of PROBLEMS) {
  const sheet = E.problemSheet(p);
  const shown = Object.values(sheet.elems)
    .filter((e) => !e.internal)
    .map((e) => e.id)
    .sort();
  ok(
    JSON.stringify(shown) === JSON.stringify([...p.givens, ...p.scaffold].sort()),
    `${p.id}: the sheet shows exactly the givens and scaffold`,
  );
  ok(
    Object.values(sheet.nodes).every((n) => n.given),
    `${p.id}: the whole setup is fixed`,
  );
  ok(E.goalTargets(p, sheet).every(Boolean), `${p.id}: every goal exists`);
}

// a solution built by hand on the sheet matches the diagram's goals as the givens move
d = mk('equilateral');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  X(d, circ(d, A, B), circ(d, B, A), minY);
  const nA = d.g.nodes[d.g.elems[A].node];
  nA.x += 40;
  nA.y -= 30;
  ok(E.checkGoal(d.L, d.g, vals(d)).solved, 'still solved after moving A');
}

console.log(fails ? `${fails} FAILED` : 'problem checks ok');

// a given circle built from given points that are inputs is part of the tool (the reported case)
d = mk('hexagon');

{
  const O = key(d, 'O');
  const A = key(d, 'A');
  const w = key(d, 'ω');
  const D = X(d, line(d, O, A), w, { not: A });
  const r2 = E.compileTool(d.g, [O, A], [D], 'Opposite');
  ok(!r2.error, 'tool from O and A may use the given ω built on them: ' + (r2.error || ''));
  if (!r2.error)
    ok(
      near(E.runTool(r2.tool, [E.pt(10, 10), E.pt(10, 60)])[0], E.pt(10, -40)),
      'and it works on new inputs',
    );
  ok(
    /depend on O, which isn't an input/.test(E.compileTool(d.g, [A], [D], 'x').error || ''),
    'leaving out O names O',
  );
}

d = mk('mirror');

{
  const P = key(d, 'P');
  const c = circ(d, P, onl(d, key(d, 'ℓ'), 0.5));
  ok(
    /depend on ℓ, which isn't an input/.test(E.compileTool(d.g, [P], [c], 'x').error || ''),
    'a given line from hidden points still names the line',
  );
}

console.log(fails ? `${fails} FAILED` : 'given-walk checks ok');

// a given point the outputs don't depend on is fine (the nudge test decides)
d = mk('tangents');

{
  const O = key(d, 'O');
  const P = key(d, 'P');
  const w = key(d, 'ω');
  const c1 = circ(d, O, P);
  const c2 = circ(d, P, O);
  const pb = line(
    d,
    X(d, c1, c2, () => 0),
    X(d, c1, c2, () => 1),
  );
  const r3 = E.compileTool(d.g, [O, P], [pb], 'Bisector');
  ok(!r3.error, 'a tool needs no unused givens: ' + (r3.error || ''));
  const toW = circ(
    d,
    P,
    X(d, line(d, O, P), w, () => 0),
  );
  const r4 = E.compileTool(d.g, [O, P], [toW], 'x');
  ok(
    /depend on ω, which isn't an input/.test(r4.error || ''),
    'a real dependence on a given circle is named: ' + r4.error,
  );
}

// a given point used only where it doesn't matter
d = mk('transfer');

{
  const A = key(d, 'A');
  const B = key(d, 'B');
  const C = key(d, 'C');
  // A reflected through C and back through C is A again, so the output is built on C but doesn't
  // depend on it
  const R1 = X(d, line(d, A, C), circ(d, C, A), { not: A });
  const R2 = X(d, line(d, R1, C), circ(d, C, R1), { not: R1 });
  const out = circ(d, R2, B);
  const r5 = E.compileTool(d.g, [A, B], [out], 'x');
  ok(!r5.error, 'built on given C but not depending on it: ' + (r5.error || ''));
  const r6 = E.compileTool(d.g, [A, B], [circ(d, R1, B)], 'x');
  ok(
    /depend on C, which isn't an input/.test(r6.error || ''),
    'depending on C is caught: ' + r6.error,
  );
}

console.log(fails ? `${fails} FAILED` : 'given-nudge checks ok');

// ---------- exercises ---------- An exercise whose goal follows from its givens is sound; one with
// a free goal, or a deleted given, isn't.
{
  const d = mk('diagram');
  const A = free(d, -60, 0, 'A');
  const B = free(d, 60, 0, 'B');
  const F = free(d, 10, 90, 'F');
  const C = X(d, circ(d, A, B), circ(d, B, A), () => 1, 'C');
  const ex0 = (givens, goals) => ({ givens, scaffold: [], goals, elaboration: [] });
  ok(E.exerciseError(d.g, ex0([A, B], [C])) === '', 'a sound exercise');
  ok(
    /goals shift when arbitrary point F moves\. Make it a given/.test(
      E.exerciseError(d.g, ex0([A, B], [F])),
    ),
    'a free goal is caught, in exercise words',
  );
  ok(/deleted/.test(E.exerciseError(d.g, ex0(['nope', B], [C]))), 'a missing given is caught');
}

// Scaffold and elaboration are built from the givens alone, and the scaffold not from a goal. On
// the problem's sheet the scaffold is shown and can be built on, and the tool earned rebuilds it;
// the elaboration comes with the solution, where the diagram puts it.
{
  const d = mk('diagram');
  const A = free(d, -60, 0, 'A');
  const B = free(d, 60, 0, 'B');
  const F = free(d, 10, 90, 'F');
  const cA = circ(d, A, B);
  const cB = circ(d, B, A);
  const C = X(d, cA, cB, () => 1, 'C');
  const fa = line(d, F, A);
  const around = circ(d, C, A);
  const ex = (scaffold, elaboration) => ({
    givens: [A, B],
    scaffold,
    goals: [C],
    elaboration,
    toolName: 'Apex',
  });
  ok(
    E.exerciseError(d.g, ex([cA, cB], [around])) === '',
    'scaffold and elaboration built from the givens are sound',
  );
  ok(
    /isn't built from the givens alone/.test(E.exerciseError(d.g, ex([fa], []))),
    'a scaffold with a free point in it is caught',
  );
  ok(
    /isn't built from the givens alone/.test(E.exerciseError(d.g, ex([], [fa]))),
    'and an elaboration',
  );
  ok(
    /built from the goal C/.test(E.exerciseError(d.g, ex([around], []))),
    'a scaffold built from a goal is caught',
  );
  const pr = E.exerciseProblem({ name: 'Apex', exercise: ex([cA, cB], [around]) }, d.g);
  const sheet = E.problemSheet(pr);
  const shown = Object.values(sheet.elems)
    .filter((e) => !e.internal)
    .map((e) => e.id)
    .sort();
  ok(
    JSON.stringify(shown) === JSON.stringify([A, B, cA, cB].sort()),
    'the sheet shows the givens and the scaffold',
  );
  ok(
    E.checkGoal(pr, sheet, E.evaluate(sheet)).after.length === 0,
    'and no elaboration before it is solved',
  );
  const sv = E.evaluate(sheet);
  const w = E.isectAll(sv.get(cA), sv.get(cB)).findIndex((q) => E.same(q, vals(d).get(C)));
  E.addNode(sheet, { op: 'isect', ins: [cA, cB], which: w }, ['point'], ['']);
  const st = E.checkGoal(pr, sheet, E.evaluate(sheet));
  ok(
    st.solved && st.after.length === 1 && E.same(st.after[0].v, vals(d).get(around)),
    'built on the scaffold, it is solved, with the elaboration where the diagram puts it',
  );
  const r = E.compileTool(sheet, [A, B], [st.ids[0]], 'Apex');
  ok(
    !r.error && r.tool.ins.length === 2,
    'the tool it earns takes the givens, and rebuilds the scaffold: ' + (r.error || ''),
  );
}

// An exercise diagram that uses a tool becomes a problem diagram with no tools in it, cut down to
// what it needs, and its goal is still where it was.
if (T.pb) {
  const d = mk('diagram');
  const A = free(d, -50, 10, 'A');
  const B = free(d, 70, -20, 'B');
  const junk = free(d, 200, 200, 'Z');
  const [l] = use(d, T.pb, [A, B]);
  const p = {
    name: 'Bisect',
    text: 'Bisect $AB$.',
    exercise: { givens: [A, B], scaffold: [], goals: [l], elaboration: [], toolName: 'Bisect' },
  };
  const pr = E.exerciseProblem(p, d.g);
  ok(pr.kind === 'problem' && pr.text === 'Bisect $AB$.', "the problem's text is the diagram's");
  ok(
    Object.values(pr.diagram.nodes).every((n) => n.op !== 'tool') && !pr.diagram.elems[junk],
    'the problem diagram is flattened and cut down',
  );
  const sheetG = E.problemSheet(pr);
  const target = E.goalTargets(pr, sheetG)[0];
  ok(E.same(target, vals(d).get(l)), 'its goal is where the tool put it');
  ok(!E.checkGoal(pr, sheetG, E.evaluate(sheetG)).solved, 'the bare setup does not solve it');
}

// A tool that uses another, used in an exercise: the problem diagram has every step of both, in an
// order where each comes after what it's built on.
if (T.mid) {
  const d = mk('diagram');
  const A = free(d, -50, 10, 'A');
  const B = free(d, 70, -20, 'B');
  const [M] = use(d, T.mid, [A, B]);
  const c = circ(d, M, A);
  const pr = E.exerciseProblem(
    {
      name: 'Half',
      exercise: { givens: [A, B], scaffold: [], goals: [c], elaboration: [], toolName: 'Half' },
    },
    d.g,
  );
  const made = new Set();
  const inOrder = E.order(pr.diagram).every((n) => {
    const ok = n.ins.every((e) => made.has(e));
    n.outs.forEach((e) => made.add(e));
    return ok;
  });
  ok(
    Object.values(pr.diagram.nodes).every((n) => n.op !== 'tool') && inOrder,
    'a tool inside a tool is flattened all the way, in order',
  );
  ok(
    E.same(E.goalTargets(pr, E.problemSheet(pr))[0], vals(d).get(c)),
    'and its goal is where the tools put it',
  );
}

// A diagram that isn't an exercise goes into a lesson whole and flattened, with what was hidden and
// the steps inside tool uses out of sight, and with its text.
if (T.pb) {
  const d = mk('diagram');
  const A = free(d, -50, 10, 'A');
  const B = free(d, 70, -20, 'B');
  const C = free(d, 0, 80, 'C');
  const [l] = use(d, T.pb, [A, B]);
  const m = line(d, A, C);
  d.g.elems[m].hidden = true;
  const it = E.diagramItem({ id: 'dgX', name: 'Bisector', text: 'The $\\perp$ bisector' }, d.g);
  const dg = it.diagram;
  ok(
    it.kind === 'diagram' &&
      it.title === 'Bisector' &&
      Object.values(dg.nodes).every((n) => n.op !== 'tool'),
    'a plain diagram goes in flattened',
  );
  ok(
    [A, B, C, l].every((id) => dg.elems[id] && !dg.elems[id].internal) && dg.elems[m].internal,
    'what was shown shows, and what was hidden stays hidden',
  );
  ok(
    Object.values(dg.elems)
      .filter((e) => !d.g.elems[e.id])
      .every((e) => e.internal),
    "a tool use's insides are out of sight",
  );
  ok(E.same(E.evaluate(dg).get(l), vals(d).get(l)), 'it draws the same');
  ok(
    it.text === 'The $\\perp$ bisector' && !('texts' in dg),
    'its text goes with it, under its title',
  );
}

// A segment is the line through its ends, marked seg to be drawn only between them, and stays one
// in a lesson's diagram.
{
  const d = mk('diagram');
  const A = free(d, -50, 10);
  const B = free(d, 70, -20);
  const s = add(d, { op: 'segment', ins: [A, B] }, ['line'])[0];
  const v = vals(d).get(s);
  const dg = E.diagramItem({ id: 'dgS', name: 'Segment' }, d.g).diagram;
  ok(
    v.seg && E.same(v, E.mkLine(vals(d).get(A), vals(d).get(B))),
    'a segment is its line, marked seg',
  );
  ok(E.evaluate(dg).get(s).seg, 'and stays one in a diagram');
}

console.log(fails ? `${fails} FAILED` : 'exercise checks ok');

// ---------- the lessons that come with the app ---------- Every problem has its goals wherever its
// givens are nudged, and none is solved before anything is drawn.
for (const p of PROBLEMS) {
  const g = E.problemSheet(p);
  const r = E.checkGoal(p, g, E.evaluate(g));
  ok(
    r.targets && r.targets.every(Boolean) && !r.solved,
    `${p.lesson.title}: ${p.title} has its goals and starts unsolved`,
  );
}

// A lesson's own tools run where they were made.
for (const L of E.LESSONS)
  for (const t of L.tools)
    ok((E.runTool(t, t.sample) || []).every(Boolean), `${L.title}: ${t.name} runs`);

console.log(fails ? `${fails} FAILED` : 'lesson checks ok');

// ---------- near where a construction stops working ---------- Inverting P by the circle centered
// at P through O only works while P is more than half ω's radius from O. Done with P just past
// that, it's right, and must count as right.
{
  const pr = PROBLEMS.find((p) => p.id === 'compass.invert');
  const d = { g: E.problemSheet(pr) };
  const el = (label) => Object.values(d.g.elems).find((e) => e.label === label && !e.internal).id;
  const O = el('O');
  const w = el('ω');
  const P = el('P');
  const pn = d.g.nodes[d.g.elems[P].node];
  Object.assign(pn, { x: 37, y: 0 }); // ω has radius 70 about (0, 0)
  const k = circ(d, P, O);
  const A1 = add(d, { op: 'isect', ins: [k, w], which: 0 }, ['point'])[0];
  const A2 = add(d, { op: 'isect', ins: [k, w, A1] }, ['point'])[0];
  add(d, { op: 'isect', ins: [circ(d, A1, O), circ(d, A2, O), O] }, ['point']);
  ok(
    E.checkGoal(pr, d.g, vals(d)).solved,
    'a construction close to where it stops working still counts',
  );
}

console.log(fails ? `${fails} FAILED` : 'boundary checks ok');

// ---------- a tool's insides, while its inputs are picked ---------- What the inputs picked so far
// settle: Perpendicular's point on ℓ needs only ℓ; its circle needs P too. Where P is that point,
// or right above it, the circle has no radius or only touches ℓ, so the tool runs with its point
// moved.
{
  const perp = E.LESSONS.find((L) => L.id === 'triangle').tools.find(
    (t) => t.name === 'Perpendicular',
  );
  const [l, P] = perp.sample;
  const g = perp.graph;
  const el = (vals, op) =>
    Object.values(g.nodes)
      .filter((n) => n.op === op)
      .map((n) => vals.get(n.outs[0]));
  const part = E.toolInsides(perp, [l]);
  ok(
    el(part, 'point').every(Boolean) &&
      el(part, 'circle').every((v) => !v) &&
      !part.get(perp.outIds[0]),
    'with only ℓ picked, its point on ℓ and nothing more',
  );
  const full = E.toolInsides(perp, [l, P]);
  ok(
    E.same(full.get(perp.outIds[0]), E.runTool(perp, [l, P])[0]),
    'with both picked, what it makes, as when it runs',
  );
  const X = el(full, 'point')[0];
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  for (const [Q, where] of [
    [X, 'at'],
    [E.pt(X.x - dy * 0.3, X.y + dx * 0.3), 'right above'],
  ]) {
    const r = E.runTool(perp, [l, Q]);
    const m = r && r[0];
    const ins = E.toolInsides(perp, [l, Q]);
    const right =
      m &&
      Math.abs((m.x2 - m.x1) * dx + (m.y2 - m.y1) * dy) <
        1e-6 * Math.hypot(m.x2 - m.x1, m.y2 - m.y1) * Math.hypot(dx, dy);
    const through =
      m &&
      Math.abs((Q.x - m.x1) * (m.y2 - m.y1) - (Q.y - m.y1) * (m.x2 - m.x1)) /
        Math.hypot(m.x2 - m.x1, m.y2 - m.y1) <
        1e-6;
    ok(
      right && through && E.same(ins.get(perp.outIds[0]), m),
      `P ${where} its point on ℓ: it still makes the perpendicular through P, and shows how`,
    );
  }
  // Used inside another tool, it sorts that out itself.
  E.TOOLS.set(perp.id, perp);
  const d = mk('diagram');
  const ln = line(d, free(d, l.x1, l.y1, 'A'), free(d, l.x2, l.y2, 'B'));
  const Pt = free(d, P.x, P.y, 'P');
  const wrap = save(d, [ln, Pt], [use(d, perp, [ln, Pt])[0]], 'Wrapped perpendicular');
  const w = wrap && E.runTool(wrap, [l, X]);
  ok(w && w[0] && E.same(w[0], E.runTool(perp, [l, X])[0]), 'and so it does inside another tool');
  // An arbitrary point placed by the inputs (free, or on a circle) waits for all of them, and so
  // does what's built on it.
  const t = { ins: [{ kind: 'point' }, { kind: 'point' }], outIds: [], graph: E.newGraph(true) };
  const tg = t.graph;
  const [A] = E.addNode(tg, { op: 'input', ins: [], idx: 0 }, ['point']).outs;
  E.addNode(tg, { op: 'input', ins: [], idx: 1 }, ['point']);
  const [Q] = E.addNode(tg, { op: 'point', ins: [], u: 0.5, v: 0.5 }, ['point']).outs;
  const [cq] = E.addNode(tg, { op: 'circle', ins: [A, Q] }, ['circle']).outs;
  const [ca] = E.addNode(tg, { op: 'circle', ins: [A, A] }, ['circle']).outs;
  const one = E.toolInsides(t, [E.pt(0, 0)]);
  const both = E.toolInsides(t, [E.pt(0, 0), E.pt(100, 0)]);
  ok(
    one.has(A) && !one.has(Q) && !one.has(cq) && one.has(ca),
    'a free point waits for every input: ' + [...one.keys()],
  );
  ok(near(both.get(Q), E.pt(50, 50)) && both.get(cq), 'then it is placed by them');
}

console.log(fails ? `${fails} FAILED` : 'insides checks ok');

console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nALL ${passes} PASSED`);
