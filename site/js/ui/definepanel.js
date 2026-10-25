// The panel for defining a tool, or for marking a diagram as an exercise (ui.def.exercise): the
// same steps, picking givens for inputs and goals for outputs, and ending in the name of the tool
// it earns; an exercise also picks its scaffold, after its givens, and its elaboration, after its
// goals. Each step's picks are in ui.def[DEF_PICKS[step]].
import { nameOf } from '../engine/construction.js';
import { EXERCISE_WORDS, TOOL_WORDS, fromGivensError, scaffoldError } from '../engine/tools.js';
import { compileDef } from './define.js';
import { relSentences, sigHTML } from './describe.js';
import { $, esc, html } from './dom.js';
import { doc, sheet } from './sheet.js';
import { diagramOf, ui } from './state.js';

export const defWords = () => (ui.def.exercise ? EXERCISE_WORDS : TOOL_WORDS);

export const DEF_PICKS = { in: 'ins', scaffold: 'scaffold', out: 'outs', after: 'after' };

export const defStages = () =>
  ui.def.exercise ? ['in', 'scaffold', 'out', 'after', 'name'] : ['in', 'out', 'name'];

// What an object picked in a step is, in words: "an input", "scaffold".
export function defRole(stage) {
  const words = defWords();
  return { in: words.anIn, scaffold: 'scaffold', out: words.anOut, after: 'elaboration' }[stage];
}

// Why the step being left can't be: '' if it can.
export function defStepError(d) {
  if (d.stage === 'in') return d.ins.length ? '' : `Pick at least one ${defWords().in}.`;
  if (d.stage === 'scaffold') return fromGivensError(doc, d.ins, d.scaffold);
  if (d.stage === 'out') return compileDef() ? scaffoldError(doc, d.scaffold, d.outs) : d.error;
  if (d.stage === 'after') return fromGivensError(doc, d.ins, d.after);
  return '';
}

// What's been picked in a step, as chips, numbered (but not scaffold or elaboration, which have no
// order), each with a button to drop it.
function chips(ids, cls, numbered = true) {
  if (!ids.length) return '<span class="note">Nothing picked yet.</span>';
  return ids
    .map((id, i) => {
      const name = esc(nameOf(doc, id));
      return html`
        <span class="chip ${cls}">
          ${numbered ? `<b>${i + 1}</b>` : ''}${name}<button
            data-act="def-drop" data-id="${id}" aria-label="Remove ${name}">×</button>
        </span>`;
    })
    .join('');
}

// What each step asks for, above its chips.
function stepBody(d) {
  const ex = d.exercise;
  switch (d.stage) {
    case 'in': {
      const ask = ex
        ? 'Click the givens, in the order the tool it earns will take them.'
        : "Click the objects the tool will take as inputs, in the order you'll pick them when " +
          'using it.';
      return `<p>${ask}</p><div class="chips">${chips(d.ins, '')}</div>`;
    }
    case 'scaffold':
      return html`
        <p>
          Optional. Click construction built from the givens, done for the student to build on.
        </p>
        <div class="chips">${chips(d.scaffold, '', false)}</div>`;
    case 'out': {
      const ask = ex
        ? 'Click what the student is to construct.'
        : 'Click the objects the tool should produce.';
      return `<p>${ask}</p><div class="chips">${chips(d.outs, 'out')}</div>`;
    }
    case 'after':
      return html`
        <p>Optional. Click construction to show once the goals are found.</p>
        <div class="chips">${chips(d.after, 'out', false)}</div>`;
  }
  if (ex) {
    const placeholder = esc(diagramOf(sheet.id).p.name);
    return html`
      <div class="def-fields">
        <label class="flab" for="def-toolName">Tool it earns</label><input
          id="def-toolName" data-def="toolName" value="${esc(d.toolName)}"
          placeholder="${placeholder}" maxlength="60" autocomplete="off">
      </div>`;
  }
  const name = (i) => `<span class="m">${esc(d.tool.ins[i].label)}</span>`;
  const relations = relSentences(d.tool, name).map((x) => `<p class="note rel">${x}</p>`);
  return html`
    <label class="note" for="toolName">Tool name</label><input
      id="toolName" data-def="name" value="${esc(d.name)}" maxlength="48" autocomplete="off">
    <div class="sig">${sigHTML(d.tool)}</div>${relations.join('')}`;
}

// While a tool is being edited, every step says what saving does.
const EDITING_NOTE = html`
  <p class="note">
    With the same kinds of inputs and outputs, every use of the tool follows the change. Otherwise
    it's saved as a new tool.
  </p>`;

export function renderDef() {
  const sec = $('#defSec');
  const d = ui.def;
  if (!d) {
    sec.hidden = true;
    sec.innerHTML = '';
    return;
  }
  sec.hidden = false;
  const ex = d.exercise;
  const stages = defStages();
  const at = stages.indexOf(d.stage);
  const steps = stages.map(
    (s, i) => `<span class="${i === at ? 'on' : i < at ? 'done' : ''}"></span>`,
  );
  const stepName = {
    in: ex ? 'Givens' : 'Inputs',
    scaffold: 'Scaffold',
    out: ex ? 'Goals' : 'Outputs',
    after: 'Elaboration',
    name: ex ? 'Tool' : 'Name',
  };
  let title;
  let save;
  if (ex) {
    title = d.editing ? 'Edit exercise' : 'Make an exercise';
    save = 'Save exercise';
  } else {
    title = d.editing ? 'Save tool changes' : 'Define a tool';
    save = d.editing ? 'Save changes' : 'Save tool';
  }
  const error = d.error ? `<p class="err" role="alert">${esc(d.error)}</p>` : '';
  const back = d.stage !== 'in' ? '<button class="btn" data-act="def-back">Back</button>' : '';
  const forward =
    d.stage === 'name'
      ? `<button class="btn ink" data-act="def-save">${save}</button>`
      : '<button class="btn ink" data-act="def-next">Next</button>';
  sec.innerHTML = html`
    <div class="def">
      <h2>${title}</h2>
      <div class="def-steps" aria-hidden="true">${steps.join('')}</div>
      <p class="def-step">
        <b>${stepName[d.stage]}</b><span>${at + 1} of ${stages.length}</span>
      </p>
      ${stepBody(d)}${d.editing && !ex ? EDITING_NOTE : ''}${error}
      <div class="btns">
        <button class="btn ghost" data-act="def-cancel">Cancel</button>${back}${forward}
      </div>
    </div>`;
}
