// The title block above the sheet: the problem's number, its title and text, and what you can do
// next (or, for a notebook diagram, its name and text, written in place; see text.js).
import { TOOLS } from '../engine/construction.js';
import { problemsOf } from '../engine/lessons.js';
import { $, esc, html, pad2 } from './dom.js';
import { textHTML } from './markdown.js';
import { GOAL, sheet } from './sheet.js';
import { diagramOf, isSolved, ui } from './state.js';
import { diagramNameHTML, restoreFolds, subtitleHTML, titleTextHTML } from './text.js';
import { confirmBox, confirmOpen } from './widgets.js';

export function renderTitle() {
  renderTitleBlock();
  restoreFolds();
}

// The block has three cells: a number (or glyph) on the left, the title and text, and actions.
const titleBlock = (no, main, actions) => html`
  <div class="tb-cell tb-no">${no}</div>
  <div class="tb-cell tb-main">${main}</div>
  <div class="tb-cell tb-act">${actions}</div>`;

const label = (lab, glyph) => html`
  <span class="tb-lab">${lab}</span><span class="tb-num tb-glyph">${glyph}</span>`;

const nextButton = (cls = 'btn') => `<button class="${cls}" data-act="next">Next</button>`;

function renderTitleBlock() {
  const render = {
    tool: toolTitle,
    notebook: notebookTitle,
    diagram: diagramTitle,
    problem: problemTitle,
  };
  $('#titleblock').innerHTML = render[sheet.kind]();
}

function toolTitle() {
  const main = html`
    <div class="tb-title">
      <h1>${esc(TOOLS.get(sheet.tool).name)}</h1><span class="tb-sub">editing</span>
    </div>
    <p class="tb-text">
      Its inputs are marked in 1, in 2… and its outputs out 1, out 2…. Change how the tool is built,
      then save. Saving updates every place it's used.
    </p>`;
  const actions = html`
    <div class="btns">
      <button class="btn acc" data-act="edit-save">Save changes</button>
      <button class="btn" data-act="edit-cancel">Cancel</button>
    </div>`;
  return titleBlock(label('Tool', '◆'), main, actions);
}

// A notebook diagram's name, subtitle and text can be edited in place. An exercise shows its text
// as it will be read, and whether it's sound.
function notebookTitle() {
  const { p } = diagramOf(sheet.id);
  const ex = p.exercise;
  const off = ui.def ? ' disabled' : '';
  const heading = html`
    <div class="tb-title">
      <span id="tbName">${diagramNameHTML(p)}</span><span id="tbSub">${subtitleHTML(p)}</span>
    </div>
    <div id="tbText">${titleTextHTML(p)}</div>`;
  if (!ex) {
    const actions = html`
      <div class="btns">
        <button class="btn" data-act="exercise-mark"${off}>Make exercise</button>
      </div>`;
    const no = '<span class="tb-lab">Notebook</span><span class="tb-num">◇</span>';
    return titleBlock(no, heading, actions);
  }
  const error = ex.error ? `<p class="tb-err" role="alert">Needs fixing: ${esc(ex.error)}</p>` : '';
  const tryOff = ex.error ? ' disabled' : '';
  const stop =
    'Stop this diagram being an exercise? Its givens and goals go; its construction, subtitle ' +
    'and text stay.';
  const actions = confirmOpen('exercise-remove')
    ? confirmBox(stop, 'Stop')
    : html`
      <div class="btns">
        <button class="btn acc" data-act="exercise-try"${tryOff}>Try it</button>
        <button class="btn" data-act="exercise-mark"${off}>Edit</button>
        <button class="btn ghost" data-act="exercise-remove"${off}>Remove</button>
      </div>`;
  return titleBlock(label('Exercise', '◎'), heading + error, actions);
}

// A lesson's item goes on to the next one; an exercise being tried goes back to its diagram
// instead.
function nextItem() {
  if (sheet.trial) return null;
  const items = sheet.lesson.items;
  return items[items.findIndex((x) => x.id === sheet.id) + 1];
}

function diagramTitle() {
  const text = sheet.text ? `<div class="tb-text md">${textHTML(sheet.text)}</div>` : '';
  const main = html`
    <div class="tb-title">
      <h1>${esc(sheet.title)}</h1>
      <span class="tb-sub">${esc(sheet.subtitle || sheet.lesson.title)}</span>
    </div>
    ${text}`;
  const actions = nextItem() ? `<div class="btns">${nextButton()}</div>` : '';
  return titleBlock(label('Diagram', '◇'), main, actions);
}

function problemTitle() {
  const next = nextItem();
  const back = '<button class="btn" data-act="try-end">Back to the diagram</button>';
  let actions;
  if (GOAL.solved) {
    const buttons = sheet.trial
      ? back
      : '<button class="btn acc" data-act="solution-save">Save as tool</button>' +
        (next ? nextButton() : '');
    actions = html`
      <span class="stamp ${ui.stampAnim ? 'anim' : ''}">SOLVED</span>
      <div class="btns">${buttons}</div>`;
    ui.stampAnim = false;
  } else {
    const before = isSolved(sheet) ? 'Solved before. ' : '';
    const found = GOAL.total > 1 ? `${GOAL.found} of ${GOAL.total} found.` : 'Not found yet.';
    const buttons = sheet.trial ? back : next ? nextButton('btn ghost') : '';
    actions = html`
      <span class="tb-status">${before}${found}</span>
      <div class="btns">${buttons}</div>`;
  }
  let no;
  if (sheet.trial) {
    no = label('Trying', '◎');
  } else {
    const problems = problemsOf(sheet.lesson);
    const i = problems.findIndex((x) => x.id === sheet.id);
    no = html`
      <span class="tb-lab">Problem</span><span class="tb-num">${pad2(i + 1)}</span>
      <span class="tb-of">of ${problems.length}</span>`;
  }
  const subtitle = sheet.subtitle ? `<span class="tb-sub">${esc(sheet.subtitle)}</span>` : '';
  const text = sheet.text ? `<div class="tb-text md">${textHTML(sheet.text)}</div>` : '';
  const main = html`
    <div class="tb-title"><h1>${esc(sheet.title)}</h1>${subtitle}</div>
    ${text}`;
  return titleBlock(no, main, actions);
}
