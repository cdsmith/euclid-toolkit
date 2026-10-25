// What's kept in this browser (STATE): notebooks, the lessons you've added, your tools and
// toolboxes, and solved problems; and how the page is (ui): what's armed, selected, open.
import { TOOLS } from '../engine/construction.js';
import { LESSONS, indexLessons } from '../engine/lessons.js';
import { BUILTIN_BY } from './builtins.js';
import { sheet, toolSheet } from './sheet.js';
import { STATE_KEY, UI_KEY, WORK_KEY, lsDel, lsGet, lsSet } from './storage.js';

// tools holds the tools you've made, each saved in one toolbox (its box); toolboxes lists, per
// lesson or notebook, the tools in its toolbox, in order. A tool you made that its toolbox doesn't
// list was removed. lessons holds the lessons you've made from notebooks or been given.
export const STATE = { tools: [], solved: {}, notebooks: [], toolboxes: {}, lessons: [] };

export const persist = () => lsSet(STATE_KEY, STATE);

// A notebook is a list of diagrams sharing one toolbox; the notebook's id is its toolbox's id. A
// diagram is { id, name, subtitle?, text?, exercise? }, its subtitle and text shown with its name
// (see startWriting). Section headings go in the same list ({ id, name, section: true }), and a
// diagram belongs to the section above it.
export const notebookOf = (id) => STATE.notebooks.find((b) => b.id === id) || null;

export const diagramsIn = (b) => b.diagrams.filter((p) => !p.section);

// A diagram or section heading, and its notebook.
export function entryOf(id) {
  for (const b of STATE.notebooks) {
    const p = b.diagrams.find((q) => q.id === id);
    if (p) return { b, p };
  }
  return null;
}

export function diagramOf(id) {
  const f = entryOf(id);
  return f && !f.p.section ? f : null;
}

// New notebooks and diagrams are named "Notebook N" and "Diagram N", with an N none of the others
// has.
export function nextName(base, others) {
  const names = new Set(others.map((x) => x.name));
  let n = others.length + 1;
  while (names.has(base + ' ' + n)) n++;
  return base + ' ' + n;
}

export const lessonOf = (id) => LESSONS.find((L) => L.id === id) || null;

export const isSolved = (problem) => !!STATE.solved[problem.id];

// A lesson's toolbox starts out as the tools the lesson gives you; a notebook's is made with it.
export const toolIds = (box) =>
  STATE.toolboxes[box] || (lessonOf(box) ? lessonOf(box).toolbox : []);

// The list to change, when changing a toolbox.
export const ownToolIds = (box) =>
  STATE.toolboxes[box] || (STATE.toolboxes[box] = toolIds(box).slice());

export const toolById = (id) => BUILTIN_BY.get(id) || TOOLS.get(id);

// A tool a lesson gave a toolbox can go from it when the lesson changes.
export const toolbox = (box) => toolIds(box).map(toolById).filter(Boolean);

// Tools that come with a toolbox, built in or given by its lesson, can be removed from it but not
// changed.
export const fixedTool = (t) => t.builtin || LESSONS.some((L) => L.tools.includes(t));

// Every tool in a toolbox, shown or not: those made or copied into it, and a lesson's own. The
// tools a tool uses are always in its own toolbox, though they needn't be shown there.
export const boxTools = (box) => [
  ...STATE.tools.filter((t) => t.box === box),
  ...(lessonOf(box) ? lessonOf(box).tools : []),
];

// Whether tool t is the tool with this id, or uses it, directly or not.
export function usesTool(t, id) {
  if (t.builtin) return false;
  if (t.id === id) return true;
  const uses = Object.values(t.graph.nodes).filter((n) => n.op === 'tool' && TOOLS.has(n.tool));
  return uses.some((n) => usesTool(TOOLS.get(n.tool), id));
}

// TOOLS (by id) holds your tools and every lesson's.
export function indexTools() {
  TOOLS.clear();
  [...STATE.tools, ...LESSONS.flatMap((L) => L.tools)].forEach((t) => TOOLS.set(t.id, t));
}

// Deletes a toolbox's tools, with any unsaved work on them.
export function dropTools(box) {
  STATE.tools.filter((t) => t.box === box).forEach((t) => lsDel(WORK_KEY + toolSheet(t).id));
  STATE.tools = STATE.tools.filter((t) => t.box !== box);
  delete STATE.toolboxes[box];
  delete ui.lastSheet[box];
  indexTools();
}

export const ui = {
  // the armed tool, and the inputs picked for it so far
  tool: null,
  pending: [],
  // what's selected, what's under the pointer, and where the pointer is on the sheet
  sel: [],
  hover: null,
  mouse: null,
  // what the row pointed at in the construction log makes, and takes
  logHi: null,
  logIn: null,
  // the define-a-tool panel
  def: null,
  // the tool whose recipe is open
  expanded: null,
  // the open name form and confirmation (see openForm, askConfirm)
  form: null,
  confirm: null,
  // whether the goal is shown
  showGoal: true,
  // which folds in the title are open (see restoreFolds)
  folds: new Set(),
  // whether the SOLVED stamp is to animate in, and when the elaboration began to fade in
  stampAnim: false,
  revealAt: 0,
  // a notebook diagram's name, subtitle or text, while it's being written (see startWriting)
  writing: null,
  // steps inside tool uses that are hidden, or opened (by step id)
  steps: { hide: new Set(), open: new Set() },
  // while editing a tool, the sheet to go back to
  returnTo: null,
  // per lesson or notebook, the sheet you were last on
  lastSheet: {},
};

// What's saved in this browser, once the lessons that come with the app are loaded.
export function loadState() {
  Object.assign(STATE, lsGet(STATE_KEY));
  indexLessons(STATE.lessons);
  indexTools();
  Object.assign(ui, lsGet(UI_KEY));
}

// Keeps whether the goal is shown, and the sheet you're on in its lesson or notebook.
export function saveUI() {
  if (sheet.box && sheet.kind !== 'tool' && !sheet.trial) ui.lastSheet[sheet.box] = sheet.id;
  lsSet(UI_KEY, { showGoal: ui.showGoal, lastSheet: ui.lastSheet });
}

// A toolbox's name: its lesson's or notebook's.
export function boxName(box) {
  const L = lessonOf(box);
  return L ? L.title : notebookOf(box).name;
}
