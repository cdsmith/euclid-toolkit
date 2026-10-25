// The construction log: a row for each step of the construction on the sheet, in dependency order,
// and under a tool use shown in detail, the tool's own steps.
import { TOOLS, nameOf } from '../engine/construction.js';
import { stepHTML } from './describe.js';
import { $, esc, html } from './dom.js';
import { deleteConfirmHTML } from './editing.js';
import { EYE, EYE_DETAIL, EYE_OFF, TRASH } from './icons.js';
import { INSIDE, ORDER, doc } from './sheet.js';
import { ui } from './state.js';
import { confirmOpen } from './widgets.js';

// A name in running text: labels as math, descriptions ("a free point") as plain words.
export function nameHTML(id) {
  const name = esc(nameOf(doc, id));
  return doc.elems[id].label ? `<span class="m">${name}</span>` : name;
}

// A step of the construction, in words: what was used, on what, making what.
function rowText(n) {
  const named = nameHTML;
  const described = (id) => esc(nameOf(doc, id));
  const use = (name, args, outs) =>
    `<span class="tool">${esc(name)}</span>(${args.join(', ')}) → ${outs}`;
  const o = n.outs[0];
  switch (n.op) {
    case 'point':
      if (n.aux) return n.ins.length ? `Point on ${described(n.ins[0])}` : 'Free point';
      return use('Point', [], n.ins.length ? `${named(o)} on ${described(n.ins[0])}` : named(o));
    case 'isect': {
      const other = n.ins[2] ? `, other than ${named(n.ins[2])}` : '';
      const where = `where ${described(n.ins[0])} meets ${described(n.ins[1])}${other}`;
      return n.aux ? 'W' + where.slice(1) : use('Point', [], `${named(o)} ${where}`);
    }
    case 'line':
      return use('Line', n.ins.map(named), 'line');
    case 'segment':
      return use('Segment', n.ins.map(named), 'segment');
    case 'circle':
      return use('Circle', n.ins.map(named), 'circle');
    case 'tool': {
      const outs = n.outs.map((e) =>
        doc.elems[e].kind === 'point' ? named(e) : doc.elems[e].kind,
      );
      return use(TOOLS.get(n.tool).name, n.ins.map(named), outs.join(', '));
    }
  }
}

// A row is shown, hidden, or (a tool use) shown in detail, by three buttons, the last kept as a gap
// on other rows so the buttons line up. act is row or step.
function visButtons(act, n, mode) {
  const vis = (m, label, icon) => html`
    <button
      class="icon-btn" data-act="${act}-${m}" data-id="${n.id}" aria-pressed="${mode === m}"
      aria-label="${label}" title="${label}">${icon}</button>`;
  const tool = n.op === 'tool';
  const detail = tool ? vis('detail', "Show how it's built", EYE_DETAIL) : '';
  return html`
    <span class="vis" role="group" aria-label="Show or hide">
      ${vis('show', 'Show', EYE)}${vis('hide', 'Hide', EYE_OFF)}${detail}
    </span>
    ${tool ? '' : '<span class="vis-gap"></span>'}`;
}

// A tool use's steps, under its row. Its inputs and outputs go by their names on the sheet. A step
// has the same Show, Hide and (for a tool) detail buttons as a row, lined up with them, and no
// Delete.
export const stepMode = (id) =>
  ui.steps.hide.has(id) ? 'hide' : ui.steps.open.has(id) ? 'detail' : 'show';

function insideRows({ steps, depth, names }) {
  const name = (id) =>
    doc.elems[id] ? nameHTML(id) : `<span class="m">${esc(names.get(id))}</span>`;
  return steps
    .map((n) => {
      const mode = stepMode(n.id);
      return html`
        <li
          class="inside${mode === 'hide' ? ' is-hidden' : ''}" data-hi="${n.outs.join(' ')}"
          data-in="${n.ins.join(' ')}" style="--d:${depth.get(n.id) - 1}">
          <span class="n"></span><span class="txt">${stepHTML(n, name)}</span>
          <span class="row-acts">${visButtons('step', n, mode)}<span class="del-gap"></span></span>
        </li>`;
    })
    .join('');
}

export function renderLog() {
  let num = 0;
  const rows = ORDER.filter((n) => !n.given).map((n) => {
    const hidden = n.outs.every((e) => doc.elems[e].hidden);
    const selected = n.outs.some((e) => ui.sel.includes(e));
    const inside = INSIDE.get(n.id);
    const mode = hidden ? 'hide' : inside ? 'detail' : 'show';
    const cls = (n.aux ? 'sub' : '') + (selected ? ' is-sel' : '') + (hidden ? ' is-hidden' : '');
    const confirm = confirmOpen('elements-delete', n.id) ? deleteConfirmHTML() : '';
    const row = html`
      <li class="${cls}" data-hi="${n.outs.join(' ')}" data-in="${n.ins.join(' ')}">
        <span class="n">${n.aux ? '' : ++num}</span><span class="txt">${rowText(n)}</span>
        <span class="row-acts">
          ${visButtons('row', n, mode)}<button
            class="icon-btn del" data-act="row-del" data-id="${n.id}" aria-label="Delete"
            title="Delete">${TRASH}</button>
        </span>
        ${confirm}
      </li>`;
    return row + (inside ? insideRows(inside) : '');
  });
  $('#log').innerHTML = rows.length
    ? rows.join('')
    : '<li class="sub empty-row"><span></span><span class="txt">Nothing drawn yet.</span></li>';
}
