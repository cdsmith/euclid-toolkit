// Notebooks, and their diagrams and section headings: making, renaming, duplicating and deleting
// them.
import { newId } from '../engine/construction.js';
import { BUILTIN } from './builtins.js';
import { renderAll } from './render.js';
import { openSheet, saveWork, sheet } from './sheet.js';
import {
  STATE,
  diagramOf,
  diagramsIn,
  dropTools,
  entryOf,
  nextName,
  notebookOf,
  persist,
  ui,
} from './state.js';
import { WORK_KEY, lsDel, lsGet, lsSet } from './storage.js';
import { toast } from './widgets.js';

// A new notebook, with one diagram, and the built-in tools.
export function newNotebook() {
  const b = {
    id: newId('nb'),
    name: nextName('Notebook', STATE.notebooks),
    diagrams: [{ id: newId('dg'), name: 'Diagram 1' }],
  };
  STATE.notebooks.push(b);
  STATE.toolboxes[b.id] = BUILTIN.map((t) => t.id);
  persist();
  openSheet(b.diagrams[0].id);
}

export function renameNotebook(id, name) {
  notebookOf(id).name = name;
  persist();
  renderAll();
}

export function deleteNotebook(id) {
  const b = notebookOf(id);
  dropTools(b.id);
  b.diagrams.forEach((p) => lsDel(WORK_KEY + p.id));
  STATE.notebooks = STATE.notebooks.filter((x) => x !== b);
  persist();
  ui.returnTo = null;
  openSheet('home', { discard: true });
  toast(`Deleted “${b.name}”.`);
}

export function newDiagram(notebookId) {
  const b = notebookOf(notebookId);
  const p = { id: newId('dg'), name: nextName('Diagram', diagramsIn(b)) };
  b.diagrams.push(p);
  persist();
  openSheet(p.id);
}

// The copy goes right after the original, and opens.
export function duplicateDiagram(id) {
  const { b, p } = diagramOf(id);
  const copy = { ...structuredClone(p), id: newId('dg'), name: p.name + ' (copy)' };
  if (sheet.id === id) saveWork();
  const work = lsGet(WORK_KEY + id);
  if (work) lsSet(WORK_KEY + copy.id, work);
  b.diagrams.splice(b.diagrams.indexOf(p) + 1, 0, copy);
  persist();
  openSheet(copy.id);
}

export function renameDiagram(id, name) {
  diagramOf(id).p.name = name;
  persist();
  renderAll();
}

// New sections go at the end, to be dragged into place.
export function newSection(notebookId) {
  const b = notebookOf(notebookId);
  const name = nextName(
    'Section',
    b.diagrams.filter((p) => p.section),
  );
  b.diagrams.push({ id: newId('sc'), name, section: true });
  persist();
  renderAll();
}

export function renameSection(id, name) {
  entryOf(id).p.name = name;
  persist();
  renderAll();
}

export function deleteSection(id) {
  const { b, p } = entryOf(id);
  b.diagrams.splice(b.diagrams.indexOf(p), 1);
  persist();
  renderAll();
}

// A notebook always has a diagram; to remove its last one, delete the notebook. Deleting the
// diagram you're on moves you to the next one.
export function deleteDiagram(id) {
  const { b, p } = diagramOf(id);
  const diagrams = diagramsIn(b);
  const i = diagrams.indexOf(p);
  b.diagrams.splice(b.diagrams.indexOf(p), 1);
  lsDel(WORK_KEY + id);
  persist();
  if (sheet.id === id) openSheet((diagrams[i + 1] || diagrams[i - 1]).id, { discard: true });
  else renderAll();
  toast(`Deleted “${p.name}”.`);
}
