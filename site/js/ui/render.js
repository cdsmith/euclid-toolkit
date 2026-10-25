// Drawing the page from the state: the nav, title block, toolkit, prompt and view buttons, or the
// start page.
import { defWords } from './definepanel.js';
import { relWords } from './describe.js';
import { $, esc, html } from './dom.js';
import { draw } from './draw.js';
import { renderHome } from './home.js';
import { renderKit } from './kit.js';
import { renderNav } from './nav.js';
import { curTool } from './picking.js';
import { redoStack, sheet, undoStack } from './sheet.js';
import { ui } from './state.js';
import { renderTitle } from './titleblock.js';

// The prompt over the sheet: what to click next, while a tool is armed or one is being defined.
const DEF_ASKS = {
  in: (words) => `click its ${words.in}s, in order.`,
  scaffold: () => 'click its scaffold, if any.',
  out: (words) => `click its ${words.out}s.`,
  after: () => 'click its elaboration, if any.',
};

export function renderPrompt() {
  const el = $('#prompt');
  const t = curTool();
  $('#stage').classList.toggle('armed', !!t);
  el.classList.toggle('armed', !!t);
  let h = '';
  if (ui.def) {
    const d = ui.def;
    const ask = DEF_ASKS[d.stage]
      ? DEF_ASKS[d.stage](defWords())
      : d.exercise
        ? 'name the tool it earns and save.'
        : 'name it and save.';
    h = `<b>${d.exercise ? 'Make an exercise' : 'Define a tool'}:</b> ${ask}`;
  } else if (t) {
    let what;
    if (!t.ins.length) {
      what = 'Click anywhere, on a line or circle, or at an intersection.';
    } else {
      const k = ui.pending.length;
      const slot = t.ins[k];
      const needs = t.builtin ? [] : relWords(t, k);
      const pick = slot.ask || `${slot.kind} <span class="m">${esc(slot.label)}</span>`;
      const also = needs.length ? ', ' + needs.join(' and ') : '';
      what = `Pick ${pick}${also} (${k + 1} of ${t.ins.length}).`;
    }
    h = html`
      <span class="pt-name">${esc(t.name)}</span><span class="pt-text">${what}</span>
      <button
        class="pt-x" data-act="tool-close" aria-label="Put down ${esc(t.name)}"
        title="Put down (Esc)">×</button>`;
  }
  el.innerHTML = h;
  el.hidden = !h;
}

export function renderView() {
  const problem = sheet.kind === 'problem';
  $('#bUndo').disabled = !undoStack.length;
  $('#bRedo').disabled = !redoStack.length;
  $('#bGoal').setAttribute('aria-pressed', String(ui.showGoal));
  $('#bGoal').hidden = !problem;
  $('#legend').hidden = sheet.kind === 'notebook' || sheet.kind === 'diagram';
  $('#legendGoal').hidden = !problem;
  const look = sheet.kind === 'diagram';
  const clear = $('#bClear');
  clear.textContent = look ? 'Reset' : 'Clear';
  clear.title = look ? 'Put everything back where it was' : 'Clear your construction';
}

export function renderAll() {
  const home = sheet.kind === 'home';
  $('#app').classList.toggle('is-home', home);
  $('#home').hidden = !home;
  renderNav();
  if (home) {
    renderHome();
    return;
  }
  renderTitle();
  renderKit();
  renderPrompt();
  renderView();
  draw();
}
