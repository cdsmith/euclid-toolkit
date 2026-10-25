// Defining tools: making a tool from part of a construction (compileTool), laying one out again to
// edit it (instantiateTool), replacing uses of tools with their steps (flatten), the relations a
// tool needs between its inputs, and whether an exercise is sound.
import {
  TOOLS,
  evaluate,
  graphNames,
  mulberry,
  nameOf,
  newGraph,
  newId,
  order,
  runTool,
  upstream,
} from './construction.js';
import {
  GEPS,
  curveDist,
  frameOf,
  fromFrame,
  isPt,
  isectAll,
  lineParam,
  pt,
  same,
  toFrame,
} from './geometry.js';

// A step of a tool's graph as it is where the tool's inputs have these values (frameOf them): free
// points and angles on circles are made absolute.
function placedNode(n, frame) {
  const m = structuredClone(n);
  if (n.op === 'point' && !n.ins.length) {
    const p = fromFrame(frame, n.u, n.v);
    m.x = p.x;
    m.y = p.y;
    delete m.u;
    delete m.v;
  } else if (n.op === 'point' && n.a !== undefined) {
    m.a = n.a + frame.ang;
  }
  return m;
}

// The construction with each use of a tool replaced by the tool's own steps, placed where it was
// used (vals). A tool's outputs keep their ids; the steps leading to them get ids under the use's
// node id, and seqs between the use's and the next node's (or the next whole number), so they come
// in order and below any seq still to be given. Steps that are uses of tools are replaced in turn
// when deep, and kept as they are if not.
export function flatten(g, vals, deep = false) {
  const fg = newGraph();
  const all = order(g);
  for (const [i, n] of all.entries()) {
    if (n.op !== 'tool') {
      fg.nodes[n.id] = structuredClone(n);
      for (const e of n.outs) fg.elems[e] = structuredClone(g.elems[e]);
      continue;
    }
    const gap = (i + 1 < all.length ? all[i + 1].seq : Math.floor(n.seq) + 1) - n.seq;
    // A use whose inputs don't all exist makes nothing, so where its steps are placed doesn't
    // matter.
    const t = TOOLS.get(n.tool);
    const inVals = n.ins.map((e) => vals.get(e));
    const frame = frameOf(inVals.every(Boolean) ? inVals : [pt(0, 0)]);
    const ids = new Map(t.outIds.map((e, k) => [e, n.outs[k]]));
    const idOf = (e) => ids.get(e) || n.id + '.' + e;
    const steps = [];
    for (const step of order(t.graph)) {
      if (step.op === 'input') ids.set(step.outs[0], n.ins[step.idx]);
      else steps.push(step);
    }
    steps.forEach((step, k) => {
      const m = Object.assign(placedNode(step, frame), {
        id: n.id + '.' + step.id,
        seq: n.seq + (gap * (k + 1)) / (steps.length + 1),
        ins: step.ins.map(idOf),
        outs: step.outs.map(idOf),
      });
      fg.nodes[m.id] = m;
      m.outs.forEach((e, j) => {
        fg.elems[e] = g.elems[e]
          ? { ...structuredClone(g.elems[e]), node: m.id }
          : { id: e, node: m.id, kind: t.graph.elems[step.outs[j]].kind, label: '' };
      });
    });
  }
  fg.seq = g.seq;
  const more = deep && Object.values(fg.nodes).some((n) => n.op === 'tool');
  return more ? flatten(fg, evaluate(fg), true) : fg;
}

// Relations a tool can need between its inputs: a point on a line or circle, and a point at a
// circle's center. A line here is the whole line, even where it's drawn as a segment.
const lineDist = (p, l) =>
  Math.abs((p.x - l.x1) * (l.y2 - l.y1) - (p.y - l.y1) * (l.x2 - l.x1)) /
  Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
const RELS = {
  on: (p, c) =>
    c.kind === 'line'
      ? lineDist(p, c) < GEPS
      : c.kind === 'circle' && Math.abs(Math.hypot(p.x - c.cx, p.y - c.cy) - c.r) < GEPS,
  center: (p, c) => c.kind === 'circle' && Math.hypot(p.x - c.cx, p.y - c.cy) < GEPS,
};

// Construction g's values as it is, and with all its free points moved a little (as in checkGoal),
// so what holds however they're placed can be told from what holds by chance.
function configs(g) {
  const rnd = mulberry(52021);
  const d = () => (rnd() * 2 - 1) * 0.1;
  const nudged = (n) => {
    if (n.op === 'fixed') return { ...n, val: pt(n.val.x + d(), n.val.y + d()) };
    if (!n.ins.length) return { ...n, x: n.x + d(), y: n.y + d() };
    if (n.t !== undefined) return { ...n, t: n.t + d() / 100 };
    return { ...n, a: n.a + d() / 100 };
  };
  const free = Object.values(g.nodes).filter(
    (n) => n.op === 'point' || (n.op === 'fixed' && isPt(n.val)),
  );
  const out = [evaluate(g)];
  for (let k = 0; k < 3; k++) {
    out.push(evaluate(g, { nodeOver: new Map(free.map((n) => [n.id, nudged(n)])) }));
  }
  return out;
}

// The relations between a tool's inputs (elements ins of construction g) that hold however g's free
// points are placed: for each input point, the indexes of the input circles it's the center of
// (center) and of the input lines and circles it's on (on).
function inputRelations(g, ins) {
  const cs = configs(g);
  const holds = (rel, p, c) =>
    cs.every((v) => v.get(p) && v.get(c) && RELS[rel](v.get(p), v.get(c)));
  return ins.map((p) => {
    const r = {};
    if (g.elems[p].kind !== 'point') return r;
    ins.forEach((c, j) => {
      if (g.elems[c].kind === 'point') return;
      for (const rel of ['center', 'on']) if (holds(rel, p, c)) (r[rel] = r[rel] || []).push(j);
    });
    return r;
  });
}

// The relations tool t needs between its inputs that elements ins of construction g don't keep
// however g's free points are placed, as [relation, point's index, curve's index, whether it holds
// as things are], of those that which(point's index, curve's index) picks.
export function brokenRelations(g, t, ins, which = () => true) {
  const want = t.ins
    .flatMap((x, i) => ['center', 'on'].flatMap((rel) => (x[rel] || []).map((j) => [rel, i, j])))
    .filter(([, i, j]) => which(i, j));
  if (!want.length) return [];
  const cs = configs(g);
  const holds = (v, rel, i, j) => {
    const p = v.get(ins[i]);
    const c = v.get(ins[j]);
    return !!p && !!c && RELS[rel](p, c);
  };
  return want
    .filter(([rel, i, j]) => !cs.every((v) => holds(v, rel, i, j)))
    .map(([rel, i, j]) => [rel, i, j, holds(cs[0], rel, i, j)]);
}

// How a tool's definition, and an exercise, speak of the objects picked for it (see compileTool).
export const TOOL_WORDS = { in: 'input', anIn: 'an input', out: 'output', anOut: 'an output' };
export const EXERCISE_WORDS = { in: 'given', anIn: 'a given', out: 'goal', anOut: 'a goal' };

// A tool is the part of a construction between the chosen inputs and outputs, stored as its own
// graph. Tools used in it stay uses of those tools, so it follows changes to them. An exercise's
// goals must follow from its givens the same way, so it's checked here too, in its own words.
// Returns { tool } or { error }.
export function compileTool(g, inIds, outIds, name, words = TOOL_WORDS) {
  if (!inIds.length) return { error: `Pick at least one ${words.in}.` };
  if (!outIds.length) return { error: `Pick at least one ${words.out}.` };
  const both = outIds.find((id) => inIds.includes(id));
  if (both)
    return { error: `${nameOf(g, both)} is picked as both ${words.anIn} and ${words.anOut}.` };
  const vals = evaluate(g);
  const inVals = inIds.map((id) => vals.get(id));
  if (inVals.some((v) => !v) || outIds.some((id) => !vals.get(id))) {
    return { error: 'One of the picked objects does not exist right now.' };
  }
  const { need, givenNames, error } = neededSteps(g, inIds, outIds, words);
  if (error) return { error };

  const tg = toolGraph(g, need, inIds, inVals, vals);
  const names = graphNames(tg);
  const tool = {
    id: newId('t'),
    name: name.trim() || 'Untitled tool',
    ins: inIds.map((id) => ({ kind: tg.elems[id].kind, label: names.get(id) })),
    outs: outIds.map((id) => ({ kind: tg.elems[id].kind, label: names.get(id) })),
    graph: tg,
    inIds: inIds.slice(),
    outIds: outIds.slice(),
    sample: inVals.map((v) => ({ ...v })),
  };
  const base = runTool(tool, inVals);
  if (!base || base.some((v, i) => !same(v, vals.get(outIds[i]), GEPS * 10))) {
    return { error: `This construction couldn't be replayed from those ${words.in}s.` };
  }

  // Arbitrary points are fine only if the outputs don't depend on where they were put. Givens the
  // outputs depend on are reported first: making them inputs may settle the rest.
  const shifting = shiftingPoints(tool, inVals, base);
  const givens = [
    ...new Set(shifting.filter((id) => givenNames.has(id)).map((id) => givenNames.get(id))),
  ];
  if (givens.length) {
    const many = givens.length > 1;
    const isnt = many ? `aren't ${words.in}s` : `isn't ${words.anIn}`;
    const make = many ? `them ${words.in}s` : `it ${words.anIn}`;
    return {
      error: `The ${words.out}s depend on ${givens.join(', ')}, which ${isnt}. Make ${make}.`,
    };
  }
  if (shifting.length) {
    const which = shifting.map((id) =>
      g.elems[id].label
        ? 'arbitrary point ' + g.elems[id].label
        : nameOf(g, id).replace(/^(a|an) /, 'the '),
    );
    const many = which.length > 1;
    const make = many ? `them ${words.in}s` : `it ${words.anIn}`;
    return {
      error:
        `The ${words.out}s shift when ${which.join(', ')} ${many ? 'move' : 'moves'}. ` +
        `Make ${make}, or build ${many ? 'them' : 'it'} from the ${words.in}s.`,
    };
  }
  // Its inputs need the relations they have here.
  inputRelations(g, inIds).forEach((r, i) => Object.assign(tool.ins[i], r));
  return { tool };
}

// The steps of g the outputs are built from, walking back from them and stopping at the inputs.
// Givens are built like anything else, so the walk goes on through them. A given point that isn't
// an input is taken in like an arbitrary point: compileTool then finds whether the outputs depend
// on it. Such points are named by what's shown of them (givenNames: a given line, for the hidden
// points that fix it). A given line or circle with nothing behind it (an input of a tool being
// edited) can only be an input, and its use is an error.
function neededSteps(g, inIds, outIds, words) {
  const need = new Set();
  const givenNames = new Map();
  let error = null;
  const visit = (eid, via) => {
    if (error || inIds.includes(eid)) return;
    const e = g.elems[eid];
    const n = g.nodes[e.node];
    const shownAs = e.internal ? via : e;
    if (n.op === 'fixed' && !isPt(n.val)) {
      const what = nameOf(g, shownAs.id);
      error = `This construction uses ${what}, which isn't ${words.anIn}. Make it ${words.anIn}.`;
      return;
    }
    if (n.given && (n.op === 'point' || n.op === 'fixed')) {
      givenNames.set(eid, shownAs ? nameOf(g, shownAs.id) : 'a given point');
    }
    if (need.has(n.id)) return;
    need.add(n.id);
    n.ins.forEach((i) => visit(i, shownAs));
  };
  outIds.forEach((id) => visit(id, null));
  return { need, givenNames, error };
}

// The tool's own graph: its inputs, and the steps it needs, with arbitrary points placed relative
// to the inputs (frameOf them). A free point that lies on input curves is tied to them: on one, it
// may slide along it; on two, it is where they meet.
function toolGraph(g, need, inIds, inVals, vals) {
  const frame = frameOf(inVals);
  const tg = newGraph(true);
  inIds.forEach((id, i) => {
    const nid = 'in' + i;
    tg.nodes[nid] = { id: nid, op: 'input', idx: i, ins: [], outs: [id], seq: i - 1000 };
    tg.elems[id] = { id, node: nid, kind: g.elems[id].kind, label: g.elems[id].label };
  });
  for (const n of order(g)) {
    if (!need.has(n.id)) continue;
    const m = { id: n.id, op: n.op, ins: n.ins.slice(), outs: n.outs.slice(), seq: n.seq };
    if (n.op === 'isect') m.which = n.which;
    if (n.op === 'tool') m.tool = n.tool;
    if ((n.op === 'point' && !n.ins.length) || n.op === 'fixed') {
      const here = n.op === 'fixed' ? n.val : pt(n.x, n.y);
      const on = [];
      inVals.forEach((v, i) => {
        if (v.kind !== 'point' && curveDist(v, here.x, here.y) < GEPS) on.push(i);
      });
      const [c, d] = on.map((i) => inVals[i]);
      const which = d ? isectAll(c, d).findIndex((q) => same(q, here)) : -1;
      m.op = 'point';
      if (which >= 0) {
        Object.assign(m, { op: 'isect', ins: [inIds[on[0]], inIds[on[1]]], which });
      } else if (c) {
        m.ins = [inIds[on[0]]];
        if (c.kind === 'line') m.t = lineParam(c, here.x, here.y);
        else m.a = Math.atan2(here.y - c.cy, here.x - c.cx) - frame.ang;
      } else {
        [m.u, m.v] = toFrame(frame, here.x, here.y);
      }
    } else if (n.op === 'point') {
      if (vals.get(n.ins[0]).kind === 'circle') m.a = n.a - frame.ang;
      else m.t = n.t;
    }
    tg.nodes[m.id] = m;
    for (const o of n.outs) {
      tg.elems[o] = { id: o, node: m.id, kind: g.elems[o].kind, label: g.elems[o].label };
    }
  }
  tg.seq = Math.floor(Math.max(0, ...Object.values(tg.nodes).map((n) => n.seq))) + 1;
  return tg;
}

// The arbitrary points of a tool that its outputs (base, on inVals) move with. They're nudged
// slightly (about a tenth of a unit), so one close to where the construction stops working isn't
// pushed past it.
function shiftingPoints(tool, inVals, base) {
  const nudged = (n, sign) => {
    if (!n.ins.length) return { ...n, u: n.u + 0.0011 * sign, v: n.v - 0.0008 * sign };
    if (n.t !== undefined) return { ...n, t: n.t + 0.0012 * sign };
    return { ...n, a: n.a + 0.0013 * sign };
  };
  const moves = (n) =>
    [1, -1].some((sign) => {
      const r = runTool(tool, inVals, new Map([[n.id, nudged(n, sign)]]));
      return !r || r.some((v, j) => !same(v, base[j], GEPS * 10));
    });
  return Object.values(tool.graph.nodes)
    .filter((n) => n.op === 'point' && moves(n))
    .map((n) => n.outs[0]);
}

// A tool's graph laid out on a sheet for editing: its inputs become givens at the inputs it was
// defined on. They keep the relations the tool needs (see inputRelations), so dragging them keeps
// those: a point on an input line or circle is laid out on it (where two meet, if it's on two), and
// an input circle centered at an input point is drawn about it, through a hidden point. Inputs go
// in an order where each comes after what it's laid out on; one caught in a loop is laid out on its
// own.
export function instantiateTool(t) {
  const g = newGraph();
  const src = t.graph;
  const frame = frameOf(t.sample);
  const names = graphNames(src);
  const val = (i) => t.sample[i];
  // The inputs input i is laid out on: the curves a point is on, or a circle's center.
  const needs = (i) => {
    if (t.ins[i].kind === 'point') return (t.ins[i].on || []).slice(0, 2);
    const center = t.ins.findIndex((x) => (x.center || []).includes(i));
    return center >= 0 ? [center] : [];
  };
  const kindsOf = (n) => n.outs.map((e) => src.elems[e].kind);
  const labelsOf = (n) => n.outs.map((e) => src.elems[e].label);
  const done = new Set();
  let seq = -1000;
  const add = (m, kinds, labels, internal) => {
    g.nodes[m.id] = m;
    m.outs.forEach((e, k) => {
      g.elems[e] = { id: e, node: m.id, kind: kinds[k], label: labels[k] };
      if (internal) g.elems[e].internal = true;
    });
  };
  const lay = (n) => {
    const i = n.idx;
    const on = needs(i).filter((j) => done.has(j));
    const m = {
      id: n.id,
      op: 'fixed',
      val: { ...val(i) },
      ins: [],
      outs: n.outs.slice(),
      given: true,
    };
    if (t.ins[i].kind === 'point' && on.length) {
      const c = val(on[0]);
      const p = val(i);
      const w = on.length > 1 ? isectAll(c, val(on[1])).findIndex((q) => same(q, p)) : -1;
      delete m.val;
      if (w >= 0) {
        Object.assign(m, { op: 'isect', ins: [t.inIds[on[0]], t.inIds[on[1]]], which: w });
      } else {
        Object.assign(m, { op: 'point', ins: [t.inIds[on[0]]] });
        if (c.kind === 'line') m.t = lineParam(c, p.x, p.y);
        else m.a = Math.atan2(p.y - c.cy, p.x - c.cx);
      }
    } else if (t.ins[i].kind === 'circle' && on.length) {
      const c = val(i);
      const through = {
        id: 'r' + n.id,
        op: 'fixed',
        val: pt(c.cx + c.r, c.cy),
        ins: [],
        outs: ['r' + n.id + 'e'],
        seq: seq++,
        given: true,
      };
      add(through, ['point'], [''], true);
      delete m.val;
      Object.assign(m, { op: 'circle', ins: [t.inIds[on[0]], through.outs[0]] });
    }
    m.seq = seq++;
    add(m, kindsOf(n), labelsOf(n));
    done.add(i);
  };
  for (let left = order(src).filter((n) => n.op === 'input'); left.length;) {
    const next = left.find((n) => needs(n.idx).every((j) => done.has(j))) || left[0];
    lay(next);
    left = left.filter((n) => n !== next);
  }
  for (const n of order(src)) {
    if (n.op !== 'input') add(placedNode(n, frame), kindsOf(n), labelsOf(n));
  }
  for (const e of [...t.inIds, ...t.outIds]) {
    if (!g.elems[e].label) g.elems[e].label = names.get(e);
  }
  g.seq = Math.floor(Math.max(0, ...Object.values(g.nodes).map((n) => n.seq))) + 1;
  return g;
}

// An exercise is a notebook diagram marked with givens, scaffold, goals and elaboration (see
// problems.js). It's sound when its goals follow from its givens, its scaffold and elaboration are
// built from its givens alone, and its scaffold isn't built from its goals, which it would give
// away. exerciseError gives the reason it isn't, or ''.
export const exerciseIds = (ex) => [...ex.givens, ...ex.scaffold, ...ex.goals, ...ex.elaboration];

export function exerciseError(g, ex) {
  if (!exerciseIds(ex).every((id) => g.elems[id])) return 'something it marks was deleted.';
  return (
    compileTool(g, ex.givens, ex.goals, '', EXERCISE_WORDS).error ||
    fromGivensError(g, ex.givens, ex.scaffold) ||
    scaffoldError(g, ex.scaffold, ex.goals) ||
    fromGivensError(g, ex.givens, ex.elaboration)
  );
}

export function fromGivensError(g, givens, ids) {
  const id = ids.find((id) => compileTool(g, givens, [id], '', EXERCISE_WORDS).error);
  return id ? `${nameOf(g, id)} isn't built from the givens alone.` : '';
}

export function scaffoldError(g, scaffold, goals) {
  const up = upstream(g, scaffold);
  const goal = goals.find((id) => up.has(g.elems[id].node));
  return goal
    ? `The scaffold is built from the goal ${nameOf(g, goal)}, which it would give away.`
    : '';
}
