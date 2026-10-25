// The selection panel: what's selected, and its label, color, line style, and whether it's shown.
import { nameOf } from '../engine/construction.js';
import { $, esc, html } from './dom.js';
import { deleteConfirmHTML } from './editing.js';
import { doc, isGiven } from './sheet.js';
import { ui } from './state.js';
import { PALETTE } from './view.js';
import { confirmOpen } from './widgets.js';

// What's selected, in words.
export function selWhat(ids) {
  if (ids.length > 1) return `${ids.length} objects`;
  const e = doc.elems[ids[0]];
  return `<span class="m">${esc(nameOf(doc, e.id))}</span>${e.hidden ? ' (hidden)' : ''}`;
}

const segButton = (action, value, on, label, icon) => html`
  <button
    data-act="${action}" data-id="${value}" aria-pressed="${on}" aria-label="${label}"
    title="${label}">${icon}</button>`;

const DASH_ARRAY = { dashed: ' stroke-dasharray="6 4"', dotted: ' stroke-dasharray="0.1 4.5"' };

const lineIcon = (dash, width) => html`
  <svg viewBox="0 0 28 10" aria-hidden="true">
    <path
      d="M2 5H26" stroke="currentColor" stroke-width="${width}"
      stroke-linecap="${dash === 'dotted' ? 'round' : 'butt'}"${DASH_ARRAY[dash] || ''}/>
  </svg>`;

const field = (label, body) => `<div class="field"><span class="flab">${label}</span>${body}</div>`;

export function renderSel() {
  const sec = $('#selSec');
  const ids = ui.sel;
  if (!ids.length) {
    sec.hidden = true;
    sec.innerHTML = '';
    return;
  }
  sec.hidden = false;
  const els = ids.map((id) => doc.elems[id]);
  // A style all of them share, or undefined (null for none).
  const common = (k) => {
    const v = els.map((e) => e.style?.[k] || null);
    return v.every((x) => x === v[0]) ? v[0] : undefined;
  };
  const color = common('color');
  const dash = common('dash');
  const weight = common('weight');
  const one = ids.length === 1 ? els[0] : null;
  const allHidden = els.every((e) => e.hidden);
  const givenOnly = els.every(isGiven);

  const label = one
    ? html`
        <div class="field">
          <label class="flab" for="selLabel">Label</label>
          <input
            id="selLabel" value="${esc(one.label)}" placeholder="none" maxlength="16"
            autocomplete="off">
        </div>`
    : '';
  const swatches = PALETTE.map(
    ([k, name]) => html`
      <button
        class="sw" style="background:var(--c-${k})" data-act="sel-color" data-id="${k}"
        aria-pressed="${color === k}" aria-label="${name}" title="${name}"></button>`,
  );
  const auto = html`
    <button class="btn sw-auto" data-act="sel-color" data-id="" aria-pressed="${color === null}">
      Default
    </button>`;
  let lines = '';
  if (els.some((e) => e.kind !== 'point')) {
    const dashes =
      segButton('sel-dash', 'solid', dash === null, 'Solid', lineIcon('', 2)) +
      segButton('sel-dash', 'dashed', dash === 'dashed', 'Dashed', lineIcon('dashed', 2)) +
      segButton('sel-dash', 'dotted', dash === 'dotted', 'Dotted', lineIcon('dotted', 2.6));
    const weights =
      segButton('sel-weight', 'thin', weight === 'thin', 'Thin', lineIcon('', 1)) +
      segButton('sel-weight', 'regular', weight === null, 'Regular', lineIcon('', 2)) +
      segButton('sel-weight', 'bold', weight === 'bold', 'Bold', lineIcon('', 3.6));
    lines =
      field('Line', `<div class="seg">${dashes}</div>`) +
      field('Weight', `<div class="seg">${weights}</div>`);
  }
  const noDelete = givenOnly ? ' disabled title="Given objects can\'t be deleted"' : '';
  const confirm = confirmOpen('elements-delete', 'sel') ? deleteConfirmHTML() : '';
  sec.innerHTML = html`
    <div class="sel">
      <div class="sec-head">
        <h2>Selected</h2><button class="btn ghost" data-act="sel-clear">Deselect</button>
      </div>
      <p class="what">${selWhat(ids)}</p>
      ${label}
      ${field('Color', `<div class="swatches">${swatches.join('')}${auto}</div>`)}
      ${lines}
      <div class="btns">
        <button class="btn" data-act="sel-hide">${allHidden ? 'Show' : 'Hide'}</button>
        <button class="btn ghost" data-act="sel-del"${noDelete}>Delete</button>
      </div>
      ${confirm}
    </div>`;
}
