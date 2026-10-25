// What the buttons and keys do. Every button on the page names its action (data-act, with data-id
// for what it acts on), and a click anywhere runs it through act(); keys run the same actions.
import { TOOLS, removeNodes } from '../engine/construction.js';
import {
  exercisePanel,
  importTool,
  leaveEdit,
  openEdit,
  removeExercise,
  removeTool,
  renameTool,
  saveDefined,
  saveExercise,
  startDefine,
} from './define.js';
import { DEF_PICKS, defStages, defStepError } from './definepanel.js';
import { $ } from './dom.js';
import { draw } from './draw.js';
import {
  requestDelete,
  select,
  setHidden,
  setLabel,
  setRowMode,
  setStepMode,
  setStyle,
} from './editing.js';
import { renderKit } from './kit.js';
import { downloadLesson } from './lessonfiles.js';
import { deleteLesson, exportLesson, openCard, resetLesson } from './library.js';
import {
  deleteDiagram,
  deleteNotebook,
  deleteSection,
  duplicateDiagram,
  newDiagram,
  newNotebook,
  newSection,
  renameDiagram,
  renameNotebook,
  renameSection,
} from './notebooks.js';
import { allTools, endTool, setTool } from './picking.js';
import { renderAll, renderView } from './render.js';
import { endReorder, reorder } from './reorder.js';
import {
  GOAL,
  commit,
  doc,
  editOuts,
  freshDoc,
  openSheet,
  redo,
  replaceDoc,
  sheet,
  undo,
} from './sheet.js';
import { lessonOf, notebookOf, saveUI, ui } from './state.js';
import { startWriting } from './text.js';
import { fitView } from './view.js';
import { askConfirm, dismiss, openForm, toast } from './widgets.js';

// Viewing actions leave an armed tool armed; everything else puts it down. Every action but
// answering the open confirmation closes it and any open name form. That's all that putting down a
// tool (tool-close), cancelling a form (form-cancel) and answering no (confirm-no) need.
const VIEW_ACTS = new Set(['tool-use', 'tool-more', 'fit', 'goal-toggle', 'nav-open', 'nav-close']);
// Actions that open a name form (or the tools to import), or ask to confirm (see CONFIRMED).
// prettier-ignore
const FORMS = new Set([
  'notebook-rename', 'notebook-export', 'diagram-rename', 'section-rename', 'tool-rename',
  'tool-import',
]);
// prettier-ignore
const CONFIRMS = new Set([
  'notebook-delete', 'diagram-delete', 'lesson-reset', 'lesson-delete', 'tool-remove',
  'exercise-remove',
]);

function act(action, id) {
  const ended = !VIEW_ACTS.has(action) && endTool();
  const closed = action !== 'confirm-yes' && dismiss();
  if (ended || closed) renderAll();
  if (FORMS.has(action)) openForm(action, id || null);
  else if (CONFIRMS.has(action)) askConfirm({ kind: action, id: id || null });
  else ACTIONS[action]?.(id);
}

const ACTIONS = {
  'sheet-open': (id) => openSheet(id),
  'card-open': (id) => openCard(id),
  'card-close': () => openSheet('home'),
  'nav-open': openNav,
  'nav-close': closeNav,
  next: () => {
    const items = sheet.lesson.items;
    openSheet(items[items.findIndex((x) => x.id === sheet.id) + 1].id);
  },

  'notebook-new': newNotebook,
  'notebook-import': () => $('#notebookFile').click(),
  'diagram-new': (id) => newDiagram(id),
  'diagram-duplicate': (id) => duplicateDiagram(id),
  'section-new': (id) => newSection(id),
  'section-delete': (id) => deleteSection(id),
  'lesson-download': (id) => downloadLesson(lessonOf(id)),
  'lesson-import': () => $('#lessonFile').click(),
  write: (key) => startWriting(key),

  'confirm-yes': () => {
    const c = ui.confirm;
    ui.confirm = null;
    CONFIRMED[c.kind](c);
  },

  'tool-use': (id) => setTool(id, true),
  'tool-more': (id) => {
    ui.expanded = ui.expanded === id ? null : id;
    renderKit();
  },
  'tool-edit': (id) => openEdit(id),
  'tool-import-pick': (id) => importTool(id),

  'sel-clear': () => select([]),
  'sel-color': (color) => setStyle(ui.sel, { color: color || null }),
  'sel-dash': (dash) => setStyle(ui.sel, { dash: dash === 'solid' ? null : dash }),
  'sel-weight': (weight) => setStyle(ui.sel, { weight: weight === 'regular' ? null : weight }),
  'sel-hide': () => setHidden(ui.sel, !ui.sel.every((e) => doc.elems[e].hidden)),
  'sel-del': () => requestDelete([...new Set(ui.sel.map((e) => doc.elems[e].node))], ui.sel, 'sel'),
  'row-show': (id) => setRowMode(id, 'show'),
  'row-hide': (id) => setRowMode(id, 'hide'),
  'row-detail': (id) => setRowMode(id, 'detail'),
  'row-del': (id) => requestDelete([id], doc.nodes[id].outs, id),
  'step-show': (id) => setStepMode(id, 'show'),
  'step-hide': (id) => setStepMode(id, 'hide'),
  'step-detail': (id) => setStepMode(id, 'detail'),

  'def-start': () => startDefine(),
  'def-cancel': () => {
    ui.def = null;
    renderAll();
  },
  'def-back': defBack,
  'def-next': defNext,
  'def-drop': defDrop,
  'def-save': () => (ui.def.exercise ? saveExercise() : saveDefined()),
  'exercise-mark': exercisePanel,
  'exercise-try': () => openSheet('try:' + sheet.id),
  'try-end': () => openSheet(sheet.diagramId),
  'solution-save': () =>
    startDefine({
      stage: 'name',
      ins: sheet.givens.slice(),
      outs: GOAL.ids.filter(Boolean),
      name: sheet.toolName,
    }),
  'edit-save': () => {
    const t = TOOLS.get(sheet.tool);
    startDefine({
      stage: 'name',
      ins: t.inIds.filter((e) => doc.elems[e]),
      outs: editOuts(),
      name: t.name,
      editing: t.id,
    });
  },
  'edit-cancel': leaveEdit,

  undo,
  redo,
  fit: () => {
    fitView();
    draw();
  },
  'goal-toggle': () => {
    ui.showGoal = !ui.showGoal;
    saveUI();
    renderView();
    draw();
  },
  'sheet-clear': () => {
    const fresh = freshDoc(sheet);
    if (JSON.stringify(fresh) === JSON.stringify(doc)) return;
    commit(() => replaceDoc(fresh));
    toast(
      sheet.kind === 'diagram'
        ? 'Reset. Undo brings your changes back.'
        : 'Cleared. Undo brings it back.',
    );
  },
};

// The steps of the panel for defining a tool or making an exercise.
function defBack() {
  const stages = defStages();
  ui.def.stage = stages[stages.indexOf(ui.def.stage) - 1];
  ui.def.error = '';
  renderAll();
}

function defNext() {
  const d = ui.def;
  const stages = defStages();
  d.error = defStepError(d);
  if (d.error) {
    renderKit();
    return;
  }
  d.stage = stages[stages.indexOf(d.stage) + 1];
  renderAll();
  if (d.stage === 'name') {
    const input = $('#defSec [data-def]');
    input.focus();
    input.select();
  }
}

function defDrop(id) {
  const d = ui.def;
  for (const k of Object.values(DEF_PICKS)) d[k] = d[k].filter((x) => x !== id);
  d.error = '';
  renderKit();
  draw();
}

// What answering yes to each question does.
const CONFIRMED = {
  'elements-delete': (c) => commit(() => removeNodes(doc, c.all)),
  'tool-remove': (c) => removeTool(c.id),
  'lesson-reset': (c) => resetLesson(lessonOf(c.id)),
  'lesson-delete': (c) => deleteLesson(c.id),
  'notebook-delete': (c) => deleteNotebook(c.id),
  'diagram-delete': (c) => deleteDiagram(c.id),
  'exercise-remove': removeExercise,
};

// What each name form, filled in, renames.
const SUBMITTED = {
  'notebook-rename': renameNotebook,
  'diagram-rename': renameDiagram,
  'section-rename': renameSection,
  'tool-rename': renameTool,
};

function openNav() {
  $('#nav').classList.add('open');
  $('#scrim').hidden = false;
  $('#navToggle').setAttribute('aria-expanded', 'true');
  $('#nav .is-current')?.focus();
}

export function closeNav() {
  $('#nav').classList.remove('open');
  $('#scrim').hidden = true;
  $('#navToggle').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-act]');
  if (button && !button.disabled) act(button.dataset.act, button.dataset.id);
});

// A name can't be left empty.
document.addEventListener('submit', (e) => {
  if (e.target.id === 'exportForm') {
    e.preventDefault();
    const b = notebookOf(e.target.dataset.id);
    const blurb = $('#lessonBlurb').value.trim();
    ui.form = null;
    exportLesson(b, blurb);
    return;
  }
  if (e.target.id !== 'nameForm') return;
  e.preventDefault();
  const input = $('#nameInput');
  const name = input.value.trim();
  const f = ui.form;
  if (!name) {
    input.focus();
    return;
  }
  ui.form = null;
  SUBMITTED[f.kind](f.id, name);
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.def && ui.def) ui.def[e.target.dataset.def] = e.target.value;
  if (e.target.id === 'lessonBlurb' && ui.form) ui.form.blurb = e.target.value;
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'selLabel') setLabel(ui.sel[0], e.target.value);
});

// Keys: Esc puts down a tool, closes the panel or form, or deselects; ctrl/cmd-Z and -Y undo and
// redo; Delete deletes what's selected; 1–9 arm the toolbox's tools. In a text field, Esc leaves it
// and Enter finishes it (ctrl/cmd-Enter, in the text).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && reorder) {
    endReorder(false);
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    fieldKey(e);
    return;
  }
  if (e.key === 'Escape' && dismiss()) {
    renderAll();
    return;
  }
  if (!doc) {
    if (e.key === 'Escape') closeNav();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    act(e.shiftKey ? 'redo' : 'undo');
  } else if (mod && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    act('redo');
  } else if (mod || e.altKey) {
    return;
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel.length) {
    e.preventDefault();
    act('sel-del');
  } else if (e.key === 'Escape') {
    if (ui.tool) {
      setTool(null);
    } else if (ui.def) {
      ui.def = null;
      renderAll();
    } else if (ui.sel.length) {
      select([]);
    }
    closeNav();
  } else if (/^[1-9]$/.test(e.key)) {
    const t = allTools()[+e.key - 1];
    if (t) setTool(t.id);
  }
});

function fieldKey(e) {
  const field = e.target;
  if (e.key === 'Escape') {
    if (field.id === 'nameInput') act('form-cancel');
    else field.blur();
  } else if (e.key === 'Enter' && field.tagName === 'INPUT') {
    if (field.dataset.def) act('def-save');
    else if (field.id === 'selLabel' || field.id === 'writeField') field.blur();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && field.id === 'writeField') {
    field.blur();
  }
}

// The construction log: pointing at a row highlights what it makes, and in another color what it
// takes; clicking a row selects what it makes, if that's on the sheet (a step inside a tool use may
// not be).
const logEl = $('#log');
logEl.addEventListener('pointerover', (e) => {
  const li = e.target.closest('li[data-hi]');
  const ids = li ? li.dataset.hi.split(' ') : null;
  const ins = li?.dataset.in ? li.dataset.in.split(' ') : null;
  if (JSON.stringify([ids, ins]) !== JSON.stringify([ui.logHi, ui.logIn])) {
    ui.logHi = ids;
    ui.logIn = ins;
    draw();
  }
});
logEl.addEventListener('pointerleave', () => {
  ui.logHi = ui.logIn = null;
  draw();
});
logEl.addEventListener('click', (e) => {
  if (e.target.closest('button, .confirm')) return;
  const li = e.target.closest('li[data-hi]');
  const ids = li ? li.dataset.hi.split(' ').filter((id) => doc.elems[id]) : [];
  if (ids.length) select(ids, e.shiftKey || e.metaKey || e.ctrlKey);
});
