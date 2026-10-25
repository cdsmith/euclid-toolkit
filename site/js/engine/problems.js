// Problems: the sheet a problem is worked on, where its goals are, whether they've been found, and
// problems and diagrams made from a notebook's diagrams.
//
// A problem's diagram is a construction like any other, with some of its elements marked: givens,
// which the tool its solution earns takes; scaffold, construction built from the givens and done
// for you, to build on; goals, what you construct, which the tool makes; and elaboration,
// construction shown once the goals are found. What the givens and scaffold are built from is the
// problem's setup: they're shown, and the rest of it is hidden (the two points that fix a given
// line, say). What leads from the givens to the goals is a solution, which says where the goals
// are; the rest of the diagram builds the elaboration. A problem is worked on a sheet holding a
// copy of just its setup, with the same ids, so the diagram can be evaluated with a sheet's setup
// in place of its own.
import { evaluate, mulberry, newGraph, upstream } from './construction.js';
import { same } from './geometry.js';
import { exerciseIds, flatten } from './tools.js';

// The sheet a problem is worked on: a copy of just its setup, the givens and scaffold shown.
export function problemSheet(problem) {
  const dg = problem.diagram;
  const g = newGraph();
  const shownIds = [...problem.givens, ...problem.scaffold];
  for (const id of upstream(dg, shownIds)) {
    const n = { ...structuredClone(dg.nodes[id]), given: true };
    g.nodes[id] = n;
    for (const e of n.outs) {
      g.elems[e] = structuredClone(dg.elems[e]);
      if (!shownIds.includes(e)) g.elems[e].internal = true;
    }
  }
  g.seq = dg.seq;
  return g;
}

// A problem's diagram with the setup as it stands on sheet g, some of its free points moved
// (nudge): where its goals are, and its elaboration ({ e, v }: element and value).
export function problemVals(problem, g, nudge = new Map()) {
  const over = new Map();
  for (const n of Object.values(g.nodes)) {
    if (n.given) over.set(n.id, nudge.get(n.id) || n);
  }
  return evaluate(problem.diagram, { nodeOver: over });
}

// Where a problem's goals are, with its setup as on sheet g (some of its free points moved).
export const goalTargets = (problem, g, nudge) => {
  const vals = problemVals(problem, g, nudge);
  return problem.goals.map((id) => vals.get(id));
};

// What of a problem's elaboration exists where its diagram has these values.
export const elaborationOf = (problem, vals) =>
  problem.elaboration
    .map((id) => ({ e: problem.diagram.elems[id], v: vals.get(id) }))
    .filter((x) => x.v);

// What a lesson keeps of a notebook diagram: its construction flattened, so it needs no tools, cut
// down to what the elements ids are built from. Elements keep their labels and styles.
function lessonDiagram(g, ids) {
  const fg = flatten(g, evaluate(g), true);
  const dg = newGraph();
  for (const id of upstream(fg, ids)) {
    const n = structuredClone(fg.nodes[id]);
    delete n.aux;
    delete n.detail;
    dg.nodes[id] = n;
    for (const e of n.outs) {
      const el = fg.elems[e];
      dg.elems[e] = { id: e, node: id, kind: el.kind, label: el.label };
      if (el.style) dg.elems[e].style = structuredClone(el.style);
    }
  }
  dg.seq = fg.seq;
  return dg;
}

// An exercise diagram (p, with construction g) as the problem it makes, the diagram's subtitle and
// text as its own.
export function exerciseProblem(p, g) {
  const ex = p.exercise;
  return {
    kind: 'problem',
    id: p.id,
    title: p.name,
    subtitle: p.subtitle || '',
    text: p.text || '',
    toolName: ex.toolName,
    diagram: lessonDiagram(g, exerciseIds(ex)),
    givens: ex.givens.slice(),
    scaffold: ex.scaffold.slice(),
    goals: ex.goals.slice(),
    elaboration: ex.elaboration.slice(),
  };
}

// Any other notebook diagram as a lesson's diagram, with its subtitle and text, there to look at
// and drag: all of it, with what was hidden, and the steps inside tool uses, kept out of sight.
export function diagramItem(p, g) {
  const dg = lessonDiagram(g, Object.keys(g.elems));
  for (const e of Object.values(dg.elems)) {
    if (!g.elems[e.id] || g.elems[e.id].hidden) e.internal = true;
  }
  return {
    kind: 'diagram',
    id: p.id,
    title: p.name,
    subtitle: p.subtitle || '',
    text: p.text || '',
    diagram: dg,
  };
}

// The goal of a sheet that has none, or whose goals don't exist as things are.
export const noGoal = () => ({
  solved: false,
  ids: [],
  found: 0,
  total: 0,
  targets: null,
  after: [],
});

// A goal counts as found only if the same element still matches it after the free points under the
// givens are nudged, so a point dropped by eye on the right spot doesn't pass. The nudges are
// slight (a tenth of a unit, where drawings are hundreds across), so a construction that works
// close to where it would stop working isn't pushed past it.
export function checkGoal(problem, g, vals) {
  if (!problem) return noGoal();
  const rnd = mulberry(91731);
  const free = Object.values(g.nodes).filter((n) => n.given && n.op === 'point' && !n.ins.length);
  const d = () => (rnd() * 2 - 1) * 0.1;
  const nudges = [new Map()];
  for (let k = 0; k < 3; k++) {
    nudges.push(new Map(free.map((n) => [n.id, { ...n, x: n.x + d(), y: n.y + d() }])));
  }
  const configs = nudges.map((nudge, i) => (i ? evaluate(g, { nodeOver: nudge }) : vals));
  const pv = problemVals(problem, g);
  const goals = nudges.map((nudge, i) =>
    i ? goalTargets(problem, g, nudge) : problem.goals.map((id) => pv.get(id)),
  );
  if (goals.some((targets) => targets.some((t) => !t))) return noGoal();
  const cands = Object.values(g.elems).filter((e) => !e.internal && !g.nodes[e.node].given);
  const ids = [];
  for (let j = 0; j < goals[0].length; j++) {
    const hit = cands.find(
      (e) => !ids.includes(e.id) && configs.every((v, ci) => same(v.get(e.id), goals[ci][j])),
    );
    ids.push(hit ? hit.id : null);
  }
  const found = ids.filter(Boolean).length;
  const solved = found === ids.length;
  return {
    solved,
    ids,
    found,
    total: ids.length,
    targets: goals[0],
    after: solved ? elaborationOf(problem, pv) : [],
  };
}
