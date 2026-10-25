// Lessons and notebooks as wholes: opening one, resetting or deleting a lesson, and exporting a
// notebook as a lesson.
import { TOOLS, newId } from '../engine/construction.js';
import { indexLessons, problemsOf } from '../engine/lessons.js';
import { diagramItem, exerciseProblem } from '../engine/problems.js';
import { exerciseError } from '../engine/tools.js';
import { esc } from './dom.js';
import { renderAll } from './render.js';
import { diagramDoc, doc, openSheet, sheet } from './sheet.js';
import {
  STATE,
  diagramsIn,
  dropTools,
  indexTools,
  isSolved,
  lessonOf,
  notebookOf,
  persist,
  toolbox,
  ui,
} from './state.js';
import { WORK_KEY, lsDel } from './storage.js';
import { toast } from './widgets.js';

// Opening a lesson or notebook returns to the item or diagram you were last on there; a lesson you
// haven't been in opens on its first item that isn't a solved problem.
export function openCard(id, opts) {
  const L = lessonOf(id);
  const b = notebookOf(id);
  const last = ui.lastSheet[id];
  if (L) {
    const it =
      L.items.find((x) => x.id === last) ||
      L.items.find((x) => x.kind !== 'problem' || !isSolved(x)) ||
      L.items[0];
    openSheet(it.id, opts);
  } else if (b) {
    openSheet((diagramsIn(b).find((p) => p.id === last) || diagramsIn(b)[0]).id, opts);
  } else {
    openSheet('home', opts);
  }
}

// The controls for a lesson or notebook are on its card, which is open only while you're working in
// it. So resetting or deleting always leaves the sheet you're on.
export function resetLesson(L) {
  dropTools(L.id);
  problemsOf(L).forEach((p) => {
    lsDel(WORK_KEY + p.id);
    delete STATE.solved[p.id];
  });
  persist();
  ui.returnTo = null;
  openSheet(L.items[0].id, { discard: true });
  toast(`Reset ${L.title}.`);
}

// A notebook can be exported as a lesson once it has exercises and all of them are sound. What's in
// the way, if anything, is listed in issues.
export function exportCheck(b) {
  const diagrams = diagramsIn(b).map((p) => ({ p, g: p.id === sheet.id ? doc : diagramDoc(p.id) }));
  const exercises = diagrams.filter((d) => d.p.exercise);
  const issues = exercises
    .map(({ p, g }) => {
      const err = exerciseError(g, p.exercise);
      return err ? `${esc(p.name)} needs fixing: ${esc(err)}` : '';
    })
    .filter(Boolean);
  if (!exercises.length) {
    issues.push('No diagram is an exercise yet. Use Make exercise on a diagram first.');
  }
  return { diagrams, exercises, issues };
}

// A notebook as a lesson. Its diagrams are the lesson's items, in order, each under the section
// heading above it: its exercises as problems, the rest as diagrams. Sections with no diagrams are
// left out, and diagrams above the first heading go in an unnamed one. An item's id is its
// diagram's under the lesson's, so it stays the same each time the lesson is updated. The toolbox
// is the notebook's, with copies of the tools made in it saved in the lesson, along with copies of
// the tools they use, which the lesson's toolbox doesn't show unless the notebook's does. A tool
// comes after the tools it uses.
function notebookLesson(b, blurb, diagrams) {
  const id = b.lessonId || newId('ls');
  const groups = [{ name: '', diagrams: [] }];
  const work = new Map(diagrams.map((d) => [d.p, d.g]));
  for (const p of b.diagrams) {
    if (p.section) groups.push({ name: p.name, diagrams: [] });
    else groups[groups.length - 1].diagrams.push(p);
  }
  const used = groups.filter((gr) => gr.diagrams.length);
  const tools = [];
  const copies = new Map();
  const copy = (t) => {
    if (!copies.has(t.id)) {
      const { name, ins, outs, graph, inIds, outIds, sample } = structuredClone(t);
      for (const n of Object.values(graph.nodes)) {
        if (n.op === 'tool') n.tool = copy(TOOLS.get(n.tool));
      }
      copies.set(t.id, id + '.' + t.id);
      tools.push({ id: id + '.' + t.id, name, box: id, ins, outs, graph, inIds, outIds, sample });
    }
    return copies.get(t.id);
  };
  const kit = toolbox(b.id).map((t) => (t.builtin ? t.id : copy(t)));
  const item = (p, tier) => {
    const made = p.exercise ? exerciseProblem(p, work.get(p)) : diagramItem(p, work.get(p));
    return { ...made, id: id + '.' + p.id, tier };
  };
  const items = used.flatMap((gr, tier) => gr.diagrams.map((p) => item(p, tier)));
  return { id, title: b.name, blurb, tiers: used.map((gr) => gr.name), toolbox: kit, tools, items };
}

export function exportLesson(b, blurb) {
  const { diagrams, issues } = exportCheck(b);
  if (issues.length) {
    renderAll();
    return;
  }
  const made = !!lessonOf(b.lessonId);
  const L = notebookLesson(b, blurb, diagrams);
  Object.assign(b, { lessonId: L.id, blurb });
  putLesson(L);
  renderAll();
  toast(`${made ? 'Updated' : 'Made'} the lesson “${L.title}”, under Lessons.`);
}

// Adds a lesson, or replaces the one with its id. Your work on a problem that changed, or went,
// goes too. Its text isn't part of your work, so changing it changes nothing you've done.
export function putLesson(L) {
  const i = STATE.lessons.findIndex((x) => x.id === L.id);
  const old = STATE.lessons[i];
  const key = (p) =>
    p.kind === 'problem' &&
    JSON.stringify([p.diagram.nodes, p.diagram.elems, p.givens, p.scaffold, p.goals]);
  if (old) {
    for (const p of problemsOf(old)) {
      const q = L.items.find((x) => x.id === p.id);
      if (!q || key(q) !== key(p)) {
        lsDel(WORK_KEY + p.id);
        delete STATE.solved[p.id];
      }
    }
    STATE.lessons[i] = L;
  } else {
    STATE.lessons.push(L);
  }
  indexLessons(STATE.lessons);
  indexTools();
  persist();
}

// A lesson you've added goes, with your tools, progress and work in it.
export function deleteLesson(id) {
  const L = lessonOf(id);
  dropTools(id);
  problemsOf(L).forEach((p) => {
    lsDel(WORK_KEY + p.id);
    delete STATE.solved[p.id];
  });
  STATE.lessons = STATE.lessons.filter((x) => x !== L);
  indexLessons(STATE.lessons);
  indexTools();
  persist();
  ui.returnTo = null;
  openSheet('home', { discard: true });
  toast(`Deleted the lesson “${L.title}”.`);
}
