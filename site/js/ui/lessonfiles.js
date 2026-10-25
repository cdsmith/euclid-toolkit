// Lessons as files: downloading one to give someone, adding one from a file, and opening a lesson
// file as a notebook to work on. A file is checked all the way through before anything is added.
import { TOOLS, evaluate, newId, runTool, upstream } from '../engine/construction.js';
import { APP_LESSONS, LESSONS } from '../engine/lessons.js';
import { checkGoal, problemSheet } from '../engine/problems.js';
import { exerciseIds } from '../engine/tools.js';
import { BUILTIN, BUILTIN_BY } from './builtins.js';
import { $ } from './dom.js';
import { openCard, putLesson } from './library.js';
import { openSheet, sheet } from './sheet.js';
import { STATE, diagramsIn, indexTools, persist } from './state.js';
import { WORK_KEY, lsSet } from './storage.js';
import { toast } from './widgets.js';

// A lesson as a file to give someone.
export function downloadLesson(L) {
  const filename = (L.title.replace(/[^\w '-]+/g, '').trim() || 'Lesson') + '.json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(L)], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const NOT_A_LESSON = "That file isn't a lesson.";
const strings = (x) => Array.isArray(x) && x.every((v) => typeof v === 'string');

// Why some data can't be opened as a lesson, or ''. It's checked all the way through, problems
// worked and tools run, so a bad file can't break anything.
function lessonError(L) {
  try {
    if (!lessonShaped(L)) return NOT_A_LESSON;
    if (APP_LESSONS.some((M) => M.id === L.id)) return 'That lesson comes with the app already.';
    // Its ids can't be ones something else here goes by.
    const others = LESSONS.filter((M) => M.id !== L.id);
    const ours = STATE.notebooks.flatMap((b) => [b.id, ...b.diagrams.map((q) => q.id)]);
    if (ours.includes(L.id)) return NOT_A_LESSON;
    if (!toolsSound(L, others)) return NOT_A_LESSON;
    return itemsError(L, others, ours);
  } catch {
    return NOT_A_LESSON;
  }
}

function lessonShaped(L) {
  return (
    !!L &&
    typeof L.id === 'string' &&
    typeof L.title === 'string' &&
    typeof L.blurb === 'string' &&
    strings(L.tiers) &&
    strings(L.toolbox) &&
    Array.isArray(L.tools) &&
    Array.isArray(L.items) &&
    L.items.some((it) => it.kind === 'problem')
  );
}

// Whether a lesson's tools are sound: well formed, with ids nothing else has, each using only the
// lesson's tools that come before it, and each running on its sample inputs (with the lesson's
// tools in reach); and whether its toolbox holds only built-in tools and its own.
function toolsSound(L, others) {
  const taken = new Set([
    ...BUILTIN.map((t) => t.id),
    ...STATE.tools.map((t) => t.id),
    ...others.flatMap((M) => M.tools.map((t) => t.id)),
  ]);
  const before = new Set();
  for (const t of L.tools) {
    const shaped =
      typeof t.id === 'string' &&
      !taken.has(t.id) &&
      !before.has(t.id) &&
      t.box === L.id &&
      typeof t.name === 'string' &&
      strings(t.inIds) &&
      strings(t.outIds) &&
      Array.isArray(t.ins) &&
      Array.isArray(t.outs);
    if (!shaped || !t.ins.every((x, i) => x && relationsOk(t, x, i))) return false;
    const uses = Object.values(t.graph.nodes).filter((n) => n.op === 'tool');
    if (!t.graph.rel || uses.some((n) => !before.has(n.tool))) return false;
    before.add(t.id);
  }
  L.tools.forEach((t) => TOOLS.set(t.id, t));
  try {
    const fails = (t) => {
      const r = runTool(t, t.sample);
      return !r || r.some((v) => !v);
    };
    if (L.tools.some(fails)) return false;
  } finally {
    indexTools();
  }
  return L.toolbox.every((id) => BUILTIN_BY.has(id) || L.tools.some((t) => t.id === id));
}

// A relation is from an input point to another input: a line or circle it's on, or a circle it's
// the center of.
function relationsOk(t, x, i) {
  const ok = (rel) =>
    x[rel] === undefined ||
    (Array.isArray(x[rel]) &&
      x.kind === 'point' &&
      x[rel].every(
        (j) =>
          Number.isInteger(j) &&
          j !== i &&
          t.ins[j] &&
          (rel === 'on' ? t.ins[j].kind !== 'point' : t.ins[j].kind === 'circle'),
      ));
  return ok('on') && ok('center');
}

// Why a lesson's items aren't sound, or '': each must be well formed, with an id nothing else has,
// a diagram with no tool uses, and, for a problem, goals that exist where its setup puts them.
function itemsError(L, others, ours) {
  const taken = new Set(others.flatMap((M) => M.items.map((it) => it.id)));
  const ids = new Set();
  for (const it of L.items) {
    const shaped =
      typeof it.id === 'string' &&
      !ids.has(it.id) &&
      !ours.includes(it.id) &&
      !/^(edit|try):/.test(it.id) &&
      typeof it.title === 'string' &&
      it.tier >= 0 &&
      it.tier < L.tiers.length;
    if (!shaped) return NOT_A_LESSON;
    if (taken.has(it.id)) return 'A lesson you have already uses the same problems.';
    const dg = it.diagram;
    if (Object.values(dg.nodes).some((n) => n.op === 'tool')) return NOT_A_LESSON;
    if (typeof it.subtitle !== 'string' || typeof it.text !== 'string') return NOT_A_LESSON;
    if (it.kind === 'problem') {
      const marks = [it.givens, it.scaffold, it.goals, it.elaboration];
      if (typeof it.toolName !== 'string' || !marks.every(strings) || !it.goals.length) {
        return NOT_A_LESSON;
      }
      if (!exerciseIds(it).every((id) => dg.elems[id])) return NOT_A_LESSON;
      const g = problemSheet(it);
      if (!checkGoal(it, g, evaluate(g)).targets) return NOT_A_LESSON;
    } else if (it.kind === 'diagram') {
      evaluate(dg);
    } else {
      return NOT_A_LESSON;
    }
    ids.add(it.id);
  }
  return '';
}

async function readJSON(file) {
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function importLesson(file) {
  const L = await readJSON(file);
  const err = lessonError(L);
  if (err) {
    toast(err);
    return;
  }
  const here = sheet.box === L.id;
  putLesson(L);
  openCard(L.id, { discard: here });
  toast(`Added the lesson “${L.title}”.`);
}

// A lesson file opened as a notebook, to work on: its sections, its problems as exercises (each
// with the solution the lesson has for it), its other diagrams, and its tools, all under new ids,
// so the lesson itself is left as it is and exporting the notebook makes a new one. It's checked as
// a lesson first, under those ids, so a bad file changes nothing. What a lesson keeps out of sight
// (the setup behind a problem's givens, what a diagram hides) comes in hidden, where you can show
// it; tools its toolbox doesn't show stay out of sight too.
async function importNotebook(file) {
  const M = renamed(await readJSON(file));
  const err = lessonError(M);
  if (err) {
    toast(err === 'That lesson comes with the app already.' ? NOT_A_LESSON : err);
    return;
  }
  const box = newId('nb');
  const b = { id: box, name: M.title, blurb: M.blurb, diagrams: [] };
  M.items.forEach((it, k) => {
    // a heading where each tier starts (the first one only if it's named)
    if (k ? it.tier !== M.items[k - 1].tier : M.tiers[it.tier]) {
      b.diagrams.push({ id: newId('sc'), name: M.tiers[it.tier] || 'Section', section: true });
    }
    const g = structuredClone(it.diagram);
    const setup = it.kind === 'problem' ? upstream(g, it.givens) : new Set();
    const shown = (e) => it.givens.includes(e.id) || it.scaffold.includes(e.id);
    for (const e of Object.values(g.elems)) {
      if (e.internal || (setup.has(e.node) && !shown(e))) e.hidden = true;
      delete e.internal;
    }
    lsSet(WORK_KEY + it.id, { doc: g });
    const p = { id: it.id, name: it.title };
    if (it.subtitle) p.subtitle = it.subtitle;
    if (it.text) p.text = it.text;
    if (it.kind === 'problem') {
      const { givens, scaffold, goals, elaboration, toolName } = it;
      p.exercise = { givens, scaffold, goals, elaboration, toolName };
    }
    b.diagrams.push(p);
  });
  M.tools.forEach((t) => {
    t.box = box;
    STATE.tools.push(t);
  });
  STATE.toolboxes[box] = M.toolbox;
  STATE.notebooks.push(b);
  indexTools();
  persist();
  openSheet(diagramsIn(b)[0].id);
  toast(`Made the notebook “${b.name}” from the lesson.`);
}

// A lesson with new ids for itself, its tools and its items; null if it can't be (not a lesson).
function renamed(L) {
  try {
    const toolIds = new Map(L.tools.map((t) => [t.id, newId('t')]));
    const rename = (id) => toolIds.get(id) || id;
    const lid = newId('ls');
    const tools = L.tools.map((t) => {
      const c = { ...structuredClone(t), id: rename(t.id), box: lid };
      for (const n of Object.values(c.graph.nodes)) {
        if (n.op === 'tool') n.tool = rename(n.tool);
      }
      return c;
    });
    return {
      ...structuredClone(L),
      id: lid,
      tools,
      toolbox: L.toolbox.map(rename),
      items: L.items.map((it) => ({ ...structuredClone(it), id: newId('dg') })),
    };
  } catch {
    return null;
  }
}

$('#lessonFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importLesson(f);
});

$('#notebookFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importNotebook(f);
});
