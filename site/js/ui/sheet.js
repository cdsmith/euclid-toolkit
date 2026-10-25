// The sheet in view and its construction: opening sheets, keeping their work, undo and redo, and
// what follows from the construction (its values, where curves cross, whether the goal is found).
import {
  BASE_NAME,
  TOOLS,
  addNode,
  evaluate,
  newGraph,
  order,
  sub,
} from '../engine/construction.js';
import { isectAll, onDrawn, same } from '../engine/geometry.js';
import { ITEMS } from '../engine/lessons.js';
import {
  checkGoal,
  elaborationOf,
  exerciseProblem,
  noGoal,
  problemSheet,
  problemVals,
} from '../engine/problems.js';
import { exerciseError, flatten, instantiateTool } from '../engine/tools.js';
import { closeNav } from './actions.js';
import { drag } from './canvas.js';
import { DEF_PICKS } from './definepanel.js';
import { $ } from './dom.js';
import { draw } from './draw.js';
import { renderAll } from './render.js';
import { STATE, diagramOf, isSolved, persist, saveUI, ui } from './state.js';
import { WORK_KEY, lsGet, lsSet } from './storage.js';
import { fitView, measure } from './view.js';
import { toast } from './widgets.js';

// The sheet in view, by kind: the start page (home), a notebook's diagram (notebook), a lesson's
// problem or diagram (problem, diagram), or a tool being edited (tool). Every sheet but the start
// page belongs to a toolbox (box): its notebook's, its lesson's, or the tool's own.
const HOME = { kind: 'home', id: 'home' };

const diagramSheet = (b, p) => ({ kind: 'notebook', id: p.id, box: b.id });

export const toolSheet = (t) => ({ kind: 'tool', id: 'edit:' + t.id, tool: t.id, box: t.box });

// A notebook diagram's construction, as saved.
export const diagramDoc = (id) => (lsGet(WORK_KEY + id) || {}).doc || newGraph();

// Trying an exercise works it as a problem, with its notebook's toolbox, from a fresh start each
// time.
const trialSheet = (b, p) =>
  Object.assign(exerciseProblem(p, diagramDoc(p.id)), {
    kind: 'problem',
    id: 'try:' + p.id,
    diagramId: p.id,
    box: b.id,
    lesson: null,
    trial: true,
  });

// The sheet with this id: a tool being edited (edit:…), an exercise being tried (try:…), a notebook
// diagram, or a lesson's item; the start page if there's no such thing.
function sheetFor(id) {
  if (id.startsWith('edit:')) {
    const t = TOOLS.get(id.slice(5));
    return t ? toolSheet(t) : HOME;
  }
  if (id.startsWith('try:')) {
    const f = diagramOf(id.slice(4));
    return f && f.p.exercise ? trialSheet(f.b, f.p) : HOME;
  }
  const f = diagramOf(id);
  return f ? diagramSheet(f.b, f.p) : ITEMS.find((p) => p.id === id) || HOME;
}

// The sheet, its construction (doc), and what follows from that (see refresh): the values of its
// elements by id (VALS), its nodes and elements in order (ORDER, ELIST), where shown curves cross
// (CANDS, candidates for new points), and its goal (GOAL, see checkGoal). Undo and redo keep
// snapshots of doc.
export let sheet = HOME;
export let doc = null;
export let VALS = new Map();
export let ORDER = [];
export let ELIST = [];
export let CANDS = [];
export let GOAL = noGoal();
export let undoStack = [];
export let redoStack = [];

// While editing a tool: its outputs, as far as they're still on the sheet.
export const editOuts = () => TOOLS.get(sheet.tool).outIds.filter((id) => doc.elems[id]);

export const isGiven = (e) => !!doc.nodes[e.node].given;

export const shown = (e) => !e.internal && !e.hidden;

// What an element is on the sheet, for how it's drawn: given, an arbitrary point, an intersection,
// a tool's output, or drawn with the straightedge or compass.
export function roleOf(e) {
  const n = doc.nodes[e.node];
  if (n.given) return 'given';
  if (n.op === 'point') return 'arb';
  if (n.op === 'isect') return 'isect';
  return n.op === 'tool' ? 'out' : 'draw';
}

// Works out everything that follows from the construction, after it changes. A problem solved by
// the change is celebrated, unless celebrate is false (as when a sheet is opened).
export function refresh(celebrate = true) {
  ORDER = order(doc);
  ELIST = [];
  for (const n of ORDER) for (const e of n.outs) ELIST.push(doc.elems[e]);
  VALS = evaluate(doc);
  computeInside();
  if (sheet.kind === 'notebook') checkExercise();
  CANDS = computeCands();
  const was = GOAL.solved;
  GOAL = checkGoal(sheet.kind === 'problem' ? sheet : null, doc, VALS);
  if (GOAL.solved) recordSolve(celebrate && !was);
}

// A tool use shown in detail (see row-vis) shows the tool's own steps, placed where it's used: as
// rows under it, and faintly on the canvas. They're its steps in the flattened construction (see
// flatten), so their ids start with the use's node id. Each step can be shown or hidden, and a step
// that uses a tool opened in turn, to show its own steps under it, for as long as the sheet is open
// (ui.steps): n5.n3 is step n3 of the tool used at n5, and n5.n3.n2 is step n2 of the tool used at
// that step. Steps that aren't outputs are named X₁, ℓ₁, ω₁…, skipping names on the sheet.
// use node id -> { steps, depth (step id -> how many tools deep), vals, names }
export let INSIDE = new Map();

export function computeInside() {
  INSIDE = new Map();
  const uses = ORDER.filter((n) => n.detail && !n.outs.every((e) => doc.elems[e].hidden));
  if (!uses.length) return;
  // levels[k]: the construction with the tool uses k deep replaced by their steps
  const levels = [doc];
  const level = (k) => {
    while (levels.length <= k) {
      const g = levels[levels.length - 1];
      levels.push(flatten(g, g === doc ? VALS : evaluate(g)));
    }
    return levels[k];
  };
  for (const use of uses) {
    const steps = [];
    const depth = new Map();
    const walk = (id, d) => {
      for (const m of order(level(d))) {
        if (!m.id.startsWith(id + '.') || m.id.split('.').length !== d + 1) continue;
        steps.push(m);
        depth.set(m.id, d);
        if (m.op === 'tool' && ui.steps.open.has(m.id)) walk(m.id, d + 1);
      }
    };
    walk(use.id, 1);
    INSIDE.set(use.id, { steps, depth });
  }
  // The deepest level has everything any step makes.
  const last = levels[levels.length - 1];
  const vals = evaluate(last);
  const used = new Set(
    ELIST.filter((e) => !e.internal)
      .map((e) => e.label)
      .filter(Boolean),
  );
  for (const inside of INSIDE.values()) {
    const names = new Map();
    const count = { point: 0, line: 0, circle: 0 };
    for (const e of inside.steps.flatMap((n) => n.outs)) {
      // a tool's outputs are on the sheet, and are also made by its steps
      if (doc.elems[e] || names.has(e)) continue;
      const kind = last.elems[e].kind;
      let name = '';
      while (!name || used.has(name)) name = BASE_NAME[kind] + sub(++count[kind]);
      names.set(e, name);
    }
    Object.assign(inside, { vals, names });
  }
}

// An exercise diagram notes whether it's sound after every change, so its row in the notebook can
// say.
function checkExercise() {
  const ex = diagramOf(sheet.id).p.exercise;
  if (!ex) return;
  const err = exerciseError(doc, ex);
  if (err === (ex.error || '')) return;
  if (err) ex.error = err;
  else delete ex.error;
  persist();
}

// A problem solved is kept as solved (not one being tried from a notebook), and, just solved, the
// SOLVED stamp animates in, its elaboration fades in, and a toast says so.
function recordSolve(celebrate) {
  if (!sheet.trial && !isSolved(sheet)) {
    STATE.solved[sheet.id] = true;
    persist();
  }
  if (celebrate) {
    ui.stampAnim = true;
    ui.revealAt = performance.now();
    toast('Solved.');
  }
}

// Where curves cross, for picking. A lesson's diagram can't be drawn on, so there's nothing to
// pick.
function computeCands() {
  if (sheet.kind === 'diagram') return [];
  const curves = ELIST.filter((e) => shown(e) && e.kind !== 'point' && VALS.get(e.id));
  const points = ELIST.filter((e) => !e.internal && e.kind === 'point')
    .map((e) => VALS.get(e.id))
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      const a = VALS.get(curves[i].id);
      const b = VALS.get(curves[j].id);
      isectAll(a, b).forEach((p, which) => {
        // only where both are drawn (segments end), and not where there's a point already
        if (!isFinite(p.x) || !isFinite(p.y) || !onDrawn(a, p) || !onDrawn(b, p)) return;
        if (points.some((q) => same(p, q)) || out.some((c) => same(c.p, p))) return;
        out.push({ p, a: curves[i].id, b: curves[j].id, which });
      });
    }
  }
  return out;
}

// A sheet's construction as it starts out: a blank diagram, a problem's setup, a lesson's diagram,
// or a tool laid out for editing.
export function freshDoc(s) {
  switch (s.kind) {
    case 'problem':
      return problemSheet(s);
    case 'diagram':
      return structuredClone(s.diagram);
    case 'tool':
      return instantiateTool(TOOLS.get(s.tool));
    default:
      return newGraph();
  }
}

// A lesson's diagram, and an exercise being tried, start fresh every time.
const keeps = (s) => s.kind !== 'diagram' && !s.trial;

function loadWork(s) {
  const saved = keeps(s) && lsGet(WORK_KEY + s.id);
  return saved ? saved.doc : freshDoc(s);
}

// Saves the construction on the sheet, if it's one that's kept.
export function saveWork() {
  if (keeps(sheet)) lsSet(WORK_KEY + sheet.id, { doc });
}

// Opens a sheet, keeping the work on the one you leave unless that work is gone (discard).
export function openSheet(id, { discard = false } = {}) {
  if (doc && !discard) saveWork();
  sheet = sheetFor(id);
  Object.assign(ui, {
    tool: null,
    pending: [],
    sel: [],
    hover: null,
    logHi: null,
    logIn: null,
    def: null,
    expanded: null,
    form: null,
    confirm: null,
    folds: new Set(),
    stampAnim: false,
    writing: null,
    steps: { hide: new Set(), open: new Set() },
  });
  undoStack = [];
  redoStack = [];
  GOAL = noGoal();
  doc = sheet.kind === 'home' ? null : loadWork(sheet);
  if (doc) refresh(false);
  saveUI();
  closeNav();
  renderAll();
  if (doc) {
    measure();
    fitView();
    draw();
  }
  const cur = $('#nav .is-current');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}

const snapshot = () => JSON.stringify(doc);

// After the construction changes: what follows from it, what's selected or picked that's gone, and
// the page.
export function afterChange() {
  refresh();
  const has = (id) => !!doc.elems[id];
  ui.sel = ui.sel.filter(has);
  if (ui.def) for (const k of Object.values(DEF_PICKS)) ui.def[k] = ui.def[k].filter(has);
  ui.confirm = null;
  saveWork();
  renderAll();
}

export function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 300) undoStack.shift();
  redoStack.length = 0;
}

// Makes a change to the construction (fn), which can be undone.
export function commit(fn) {
  pushUndo();
  fn();
  afterChange();
}

// Undo and redo wait until a drag is over.
export function undo() {
  if (drag || !undoStack.length) return;
  redoStack.push(snapshot());
  doc = JSON.parse(undoStack.pop());
  afterChange();
}

export function redo() {
  if (drag || !redoStack.length) return;
  undoStack.push(snapshot());
  doc = JSON.parse(redoStack.pop());
  afterChange();
}

// Adds a step to the construction on the sheet.
export const mint = (node, kinds, labels) => addNode(doc, node, kinds, labels);

// Puts a whole new construction on the sheet (clearing it, say), inside commit.
export function replaceDoc(d) {
  doc = d;
}

// While a point is dragged, what follows from where things are, short of a full refresh (see
// dragTo): what's shown of tool uses, where curves cross, and where the goals are.
export function refreshDragged() {
  computeInside();
  CANDS = computeCands();
  if (GOAL.targets) {
    const pv = problemVals(sheet, doc);
    GOAL.targets = sheet.goals.map((id) => pv.get(id));
    if (GOAL.solved) GOAL.after = elaborationOf(sheet, pv);
  }
}

// Labels for new points: A to Z, then A₁ to Z₁, and so on, skipping those on the sheet.
export function labeler() {
  const used = new Set(ELIST.filter((e) => !e.internal && e.kind === 'point').map((e) => e.label));
  return () => {
    for (let round = 0; round < 50; round++) {
      for (let c = 65; c < 91; c++) {
        const label = String.fromCharCode(c) + (round ? sub(round) : '');
        if (!used.has(label)) {
          used.add(label);
          return label;
        }
      }
    }
    return '?';
  };
}
