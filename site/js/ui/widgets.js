// Small pieces of the page used all over: the toast, name forms and confirmations, and words.
import { $, esc, html } from './dom.js';
import { PENCIL } from './icons.js';
import { renderAll } from './render.js';
import { ui } from './state.js';

// A message that shows for a moment at the top of the sheet.
let toastTimer = null;

export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

// prettier-ignore
const ROMAN = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

export function roman(n) {
  let r = '';
  for (const [value, numeral] of ROMAN) {
    while (n >= value) {
      r += numeral;
      n -= value;
    }
  }
  return r;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// At most one form (a name to fill in, or the tools to import) and one confirmation are open at a
// time, wherever they appear. Any other action closes them.
export function openForm(kind, id = null) {
  ui.form = { kind, id };
  ui.confirm = null;
  renderAll();
  const input = $('#nameInput');
  if (input) {
    input.focus();
    input.select();
  }
}

export function askConfirm(c) {
  ui.confirm = c;
  ui.form = null;
  renderAll();
  $('[data-act=confirm-no]')?.focus();
}

export function dismiss() {
  if (!ui.form && !ui.confirm) return false;
  ui.form = ui.confirm = null;
  return true;
}

export const formOpen = (kind, id = null) => ui.form?.kind === kind && ui.form.id === id;

export const confirmOpen = (kind, id = null) => ui.confirm?.kind === kind && ui.confirm.id === id;

export const nameForm = ({ value, label, max = 40 }) => html`
  <form class="name-form" id="nameForm">
    <input
      id="nameInput" value="${esc(value)}" maxlength="${max}" autocomplete="off"
      aria-label="${label}">
    <div class="btns">
      <button class="btn ink sm" type="submit">Save</button>
      <button class="btn ghost sm" type="button" data-act="form-cancel">Cancel</button>
    </div>
  </form>`;

export const confirmBox = (text, verb = 'Delete') => html`
  <div class="confirm" role="alert">
    <p>${text}</p>
    <div class="btns">
      <button class="btn sm" data-act="confirm-no">Keep</button>
      <button class="btn sm danger" data-act="confirm-yes">${verb}</button>
    </div>
  </div>`;

export const pencil = (action, id, what) => html`
  <button
    class="icon-btn inline" data-act="${action}" data-id="${id}"
    title="Rename this ${what}" aria-label="Rename this ${what}">${PENCIL}</button>`;
