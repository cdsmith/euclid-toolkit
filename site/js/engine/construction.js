// Constructions: graphs of steps, evaluated to the points, lines and circles they make; tools,
// which are constructions run on inputs; and the names of what's in them.
//
// A construction is a graph. Elements (points, lines, circles) are made by construction nodes; each
// node lists the elements it takes (ins) and the elements it makes (outs). Node kinds:
//   fixed   a tool's input while the tool is being edited (val)
//   input   a tool's input, inside the tool's own graph (idx)
//   point   an arbitrary point: free (x, y), or on the line (t) or circle (a) that is its one input
//   line, circle   straightedge and compass
//   segment the line through its two inputs, drawn only between them
//   isect   where two curves meet: with a third input X, the intersection other than X;
//           otherwise the one at index which (see otherIsect)
//   tool    a use of a saved tool, which may itself use other tools of its toolbox
// What a construction draws depends only on where its free points are: dragging moves them and
// nothing else. A tool's own graph is marked rel: its free points are stored relative to a frame
// built from the tool's inputs (u, v), and angles on circles relative to that frame. Elements
// carry: kind, label, and optionally key (a problem's name for a given), internal (never shown: the
// setup behind a problem's givens, say), hidden (hidden by you), style. Nodes may carry given (part
// of a sheet's setup, which you can't delete: a problem's givens and what they're built from, or
// the inputs of a tool being edited), aux (a point made only to serve as some tool's input), or
// detail (a tool use whose insides are shown). Every node is made after the elements it takes, so
// seq, the order they were made in, is a dependency order; a tool's inputs have negative seq.
import {
  dist,
  frameOf,
  fromFrame,
  isPt,
  isectAll,
  mkCircle,
  mkLine,
  onCirclePt,
  onLinePt,
  otherIsect,
  pt,
} from './geometry.js';

// Every tool there is, by id: built-in tools aside, those you've made and those lessons come with.
export const TOOLS = new Map();

// A new id, unique in this browser: tools, notebooks, diagrams and lessons made here are named this
// way.
export const newId = (prefix) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Random numbers from a seed, the same every time (mulberry32): for nudging points by chance, the
// same way each time.
export function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An empty construction; rel for a tool's own graph.
export const newGraph = (rel) =>
  rel ? { rel: true, nodes: {}, elems: {}, seq: 0 } : { nodes: {}, elems: {}, seq: 0 };

// Adds a node to a construction, with the elements it makes.
export function addNode(g, node, kinds, labels = []) {
  const s = ++g.seq;
  const id = 'n' + s;
  Object.assign(node, {
    id,
    seq: s,
    outs: kinds.map((k, i) => 'e' + s + (kinds.length > 1 ? '.' + i : '')),
  });
  g.nodes[id] = node;
  node.outs.forEach((e, i) => {
    g.elems[e] = { id: e, node: id, kind: kinds[i], label: labels[i] || '' };
  });
  return node;
}

const ORDER_CACHE = new WeakMap();

// Nodes in dependency order. A tool's graph never changes once saved, so its order is kept.
export function order(g) {
  if (ORDER_CACHE.has(g)) return ORDER_CACHE.get(g);
  const out = Object.values(g.nodes).sort((a, b) => a.seq - b.seq);
  if (g.rel) ORDER_CACHE.set(g, out);
  return out;
}

// Evaluates one step, setting the values of what it makes in vals (null for what doesn't exist:
// curves that don't meet, a circle with no radius). ctx: the inputs and frame of a tool's graph.
export function evalNode(n, vals, ctx) {
  const val = (id) => vals.get(id) || null;
  const set = (v) => vals.set(n.outs[0], v || null);
  switch (n.op) {
    case 'input':
      set(ctx.inputs[n.idx]);
      break;
    case 'fixed':
      set(n.val);
      break;
    case 'point': {
      if (!n.ins.length) {
        set(ctx.frame ? fromFrame(ctx.frame, n.u, n.v) : pt(n.x, n.y));
        break;
      }
      const c = val(n.ins[0]);
      if (c && c.kind === 'line') set(onLinePt(c, n.t));
      else if (c && c.kind === 'circle') set(onCirclePt(c, n.a + (ctx.frame ? ctx.frame.ang : 0)));
      else set(null);
      break;
    }
    case 'line':
    case 'segment': {
      const a = val(n.ins[0]);
      const b = val(n.ins[1]);
      set(isPt(a) && isPt(b) && dist(a, b) > 1e-9 ? mkLine(a, b, n.op === 'segment') : null);
      break;
    }
    case 'circle': {
      const c = val(n.ins[0]);
      const p = val(n.ins[1]);
      set(isPt(c) && isPt(p) && dist(c, p) > 1e-9 ? mkCircle(c, dist(c, p)) : null);
      break;
    }
    case 'isect':
      set(
        n.ins.length > 2
          ? otherIsect(val(n.ins[0]), val(n.ins[1]), val(n.ins[2]))
          : isectAll(val(n.ins[0]), val(n.ins[1]))[n.which],
      );
      break;
    case 'tool': {
      const r = runTool(TOOLS.get(n.tool), n.ins.map(val));
      n.outs.forEach((e, i) => vals.set(e, r ? r[i] : null));
      break;
    }
  }
}

// The values of everything a construction makes, by element id. opts: inputs (the values of a
// tool's inputs, for a tool's own graph), nodeOver (Map node id -> replacement node)
export function evaluate(g, opts = {}) {
  const vals = new Map();
  const ctx = Object.assign({}, opts, { frame: g.rel ? frameOf(opts.inputs) : null });
  for (const n of order(g)) evalNode((opts.nodeOver && opts.nodeOver.get(n.id)) || n, vals, ctx);
  return vals;
}

// A tool's outputs don't depend on where its arbitrary points are (see compileTool), but where
// they're put can make a step fail: a circle centered at an input point through an arbitrary point
// on a line has no radius when the input point is that point. So a tool that fails with its
// arbitrary points where they were made is tried with them moved, to a few other places fixed by
// the tool alone, so its outputs are still a function of its inputs.
const PLACEMENTS = new WeakMap();

function placements(tool) {
  if (!PLACEMENTS.has(tool)) {
    const free = Object.values(tool.graph.nodes).filter((n) => n.op === 'point');
    const moved = (n, k) => {
      if (!n.ins.length) return { ...n, u: n.u + 0.31 * k, v: n.v - 0.23 * k };
      if (n.t !== undefined) return { ...n, t: n.t + 0.29 * k };
      return { ...n, a: n.a + 0.7 * k };
    };
    const out = [null];
    if (free.length) {
      for (const k of [1, 2, 3]) out.push(new Map(free.map((n) => [n.id, moved(n, k)])));
    }
    PLACEMENTS.set(tool, out);
  }
  return PLACEMENTS.get(tool);
}

// Moving them can only help where the first step to fail is built on one of them; otherwise it
// isn't tried, so a tool that can't work on its inputs is run just once. A tool used inside it
// tries its own arbitrary points, so a failed use of one isn't retried here: retrying at every
// level of tools inside tools would multiply the work.
const ON_ARBITRARY = new WeakMap();

function onArbitrary(tool) {
  if (!ON_ARBITRARY.has(tool)) {
    const arbitrary = Object.values(tool.graph.nodes).filter((n) => n.op === 'point');
    ON_ARBITRARY.set(
      tool,
      downstream(
        tool.graph,
        arbitrary.map((n) => n.id),
      ),
    );
  }
  return ON_ARBITRARY.get(tool);
}

// Runs a tool on its inputs: the values of its outputs (null for one that doesn't exist there), or
// null if the inputs aren't of the kinds it takes. nodeOver places the arbitrary points itself (see
// compileTool), so it's run as it is.
export function runTool(tool, inputs, nodeOver) {
  if (!tool || inputs.length !== tool.ins.length) return null;
  if (!inputs.every((v, i) => v && v.kind === tool.ins[i].kind)) return null;
  let outs = null;
  for (const over of nodeOver ? [nodeOver] : placements(tool)) {
    const vals = evaluate(tool.graph, { inputs, nodeOver: over });
    outs = tool.outIds.map((id) => vals.get(id) || null);
    if (outs.every(Boolean)) break;
    const failed = order(tool.graph).filter(
      (n) => n.outs.some((e) => !vals.get(e)) && n.ins.every((e) => vals.get(e)),
    );
    if (!failed.some((n) => n.op !== 'tool' && onArbitrary(tool).has(n.id))) break;
  }
  return outs;
}

// What a tool makes inside, from the inputs picked so far (inputs[i] missing for those not picked
// yet): the values of the elements they settle, by element id. An arbitrary point placed relative
// to the inputs (free, or on a circle) is settled only once they're all picked, and so is
// everything built on it. With all of them, the arbitrary points are where runTool puts them.
export function toolInsides(tool, inputs) {
  const g = tool.graph;
  const all = tool.ins.every((_, i) => inputs[i]);
  const ctx = { inputs, frame: g.rel && all ? frameOf(inputs) : null };
  let vals;
  for (const over of all ? placements(tool) : [null]) {
    const known = new Set();
    vals = new Map();
    for (const n of order(g)) {
      const placed = n.op === 'point' && (!n.ins.length || g.elems[n.ins[0]].kind === 'circle');
      if (n.op === 'input' ? !inputs[n.idx] : (placed && !all) || !n.ins.every((e) => known.has(e)))
        continue;
      evalNode((over && over.get(n.id)) || n, vals, ctx);
      n.outs.forEach((e) => known.add(e));
    }
    if (tool.outIds.every((id) => vals.get(id))) break;
  }
  return vals;
}

// For each element, the nodes that take it.
export function consumers(g) {
  const m = new Map();
  for (const n of Object.values(g.nodes)) {
    for (const e of n.ins) {
      if (!m.has(e)) m.set(e, []);
      m.get(e).push(n.id);
    }
  }
  return m;
}

// These nodes plus every node built on them, directly or not.
export function downstream(g, nodeIds) {
  const cons = consumers(g);
  const seen = new Set(nodeIds);
  const q = [...nodeIds];
  while (q.length) {
    const n = g.nodes[q.pop()];
    for (const c of n.outs.flatMap((e) => cons.get(e) || [])) {
      if (!seen.has(c)) {
        seen.add(c);
        q.push(c);
      }
    }
  }
  return seen;
}

// The nodes these elements are built from, directly or not, and theirs.
export function upstream(g, elemIds) {
  const seen = new Set();
  const visit = (e) => {
    const n = g.nodes[g.elems[e].node];
    if (!seen.has(n.id)) {
      seen.add(n.id);
      n.ins.forEach(visit);
    }
  };
  elemIds.forEach(visit);
  return seen;
}

// Deleting nodes deletes everything built on them, plus points that were made only to serve as
// their inputs (unlabeled, unstyled, and used by nothing else).
export function deletionPlan(g, nodeIds) {
  const roots = nodeIds.filter((id) => !g.nodes[id].given);
  const all = downstream(g, roots);
  const cons = consumers(g);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of Object.values(g.nodes)) {
      if (!n.aux || all.has(n.id)) continue;
      if (n.outs.some((e) => g.elems[e].label || g.elems[e].style)) continue;
      const users = n.outs.flatMap((e) => cons.get(e) || []);
      if (users.length && users.every((u) => all.has(u))) {
        all.add(n.id);
        grew = true;
      }
    }
  }
  return { roots, all };
}

export function removeNodes(g, ids) {
  for (const id of ids) {
    const n = g.nodes[id];
    n.outs.forEach((e) => delete g.elems[e]);
    delete g.nodes[id];
  }
}

// A number as subscript digits: 12 -> ₁₂.
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n) => [...String(n)].map((d) => SUBS[+d]).join('');

// An element's name in running text: its label, or what it is ("a point on line AB").
export function nameOf(g, id) {
  const e = g.elems[id];
  const n = g.nodes[e.node];
  if (e.label) return e.label;
  if (e.internal) return 'a hidden ' + e.kind;
  if (n.op === 'tool') return 'the ' + e.kind + ' from ' + TOOLS.get(n.tool).name;
  if (n.op === 'isect') return 'an intersection';
  if (n.op === 'point') return n.ins.length ? 'a point on ' + nameOf(g, n.ins[0]) : 'a free point';
  const lab = (i) => g.elems[n.ins[i]].label;
  if (n.op === 'line') return lab(0) && lab(1) ? 'line ' + lab(0) + lab(1) : 'a line';
  if (n.op === 'segment') return lab(0) && lab(1) ? 'segment ' + lab(0) + lab(1) : 'a segment';
  if (n.op === 'circle')
    return lab(0) ? 'circle ' + lab(0) + (lab(1) ? '–' + lab(1) : '') : 'a circle';
  return 'a ' + e.kind;
}

// Names for every element of a tool's graph: its labels, or X₁, ℓ₁, ω₁… in dependency order.
export const BASE_NAME = { point: 'X', line: 'ℓ', circle: 'ω' };

export function graphNames(g) {
  const names = new Map();
  const count = { point: 0, line: 0, circle: 0 };
  const used = new Set(
    Object.values(g.elems)
      .map((e) => e.label)
      .filter(Boolean),
  );
  for (const n of order(g)) {
    for (const id of n.outs) {
      const e = g.elems[id];
      let name = e.label;
      while (!name || (!e.label && used.has(name))) name = BASE_NAME[e.kind] + sub(++count[e.kind]);
      names.set(id, name);
    }
  }
  return names;
}
