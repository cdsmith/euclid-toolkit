// The toolbox: a card for each tool you can use on this sheet (with its recipe, opened), and
// buttons to define a tool or import one.
import { LESSONS } from '../engine/lessons.js';
import { BUILTIN } from './builtins.js';
import { buildKey } from './define.js';
import { recipeHTML, sigHTML } from './describe.js';
import { $, esc, html } from './dom.js';
import { GRIP } from './icons.js';
import { allTools } from './picking.js';
import { sheet } from './sheet.js';
import { STATE, boxName, fixedTool, lessonOf, toolById, toolbox, ui } from './state.js';
import { confirmBox, confirmOpen, formOpen, nameForm } from './widgets.js';

// What can be imported, by where it comes from. A notebook can import the built-in tools it doesn't
// have and the tools of every other notebook and lesson; a lesson, only the tools it starts with
// that you've removed.
export function importable(box) {
  const L = lessonOf(box);
  const here = toolbox(box);
  const keys = new Set(here.filter((t) => !t.builtin).map(buildKey));
  const fresh = (t) => (t.builtin ? !here.includes(t) : !keys.has(buildKey(t)));
  const made = (b) => toolbox(b).filter((t) => !t.builtin && fresh(t));
  let groups;
  if (L) {
    groups = [
      { name: 'Starting tools', tools: L.toolbox.map(toolById).filter((t) => t && fresh(t)) },
    ];
  } else {
    groups = [
      { name: 'Built in', tools: BUILTIN.filter(fresh) },
      ...STATE.notebooks
        .filter((b) => b.id !== box)
        .map((b) => ({ name: b.name, tools: made(b.id) })),
      ...LESSONS.map((M) => ({ name: M.title, tools: made(M.id) })),
    ];
  }
  return groups.filter((g) => g.tools.length);
}

function importList(groups) {
  const item = (t) => html`
    <button class="tool-add import-item" data-act="tool-import-pick" data-id="${t.id}">
      <span>${esc(t.name)}</span><span class="isig">${sigHTML(t)}</span>
    </button>`;
  const list = groups.length
    ? groups
        .map(
          (g) =>
            `<div class="import-group"><h4>${esc(g.name)}</h4>${g.tools.map(item).join('')}</div>`,
        )
        .join('')
    : '<p class="note">There’s nothing left to import.</p>';
  return html`
    <div class="import">
      <h3>Import a tool</h3>
      ${list}
      <div class="btns"><button class="btn ghost sm" data-act="form-cancel">Done</button></div>
    </div>`;
}

// A tool's card: its name, shortcut key and signature, and a button that opens its recipe, with
// what can be done to it (tools that come with the toolbox can be removed but not changed).
function toolCard(t, i) {
  const active = ui.tool === t.id;
  const open = ui.expanded === t.id;
  const key = i < 9 ? String(i + 1) : '';
  let detail = '';
  if (open) {
    let acts;
    if (formOpen('tool-rename', t.id)) {
      acts = nameForm({ value: t.name, label: 'Tool name', max: 48 });
    } else if (confirmOpen('tool-remove', t.id)) {
      const again = fixedTool(t) ? ', and you can import it again' : '';
      const ask = `Remove “${esc(t.name)}” from this toolbox?`;
      acts = confirmBox(`${ask} Constructions that use it keep working${again}.`, 'Remove');
    } else {
      const change = fixedTool(t)
        ? ''
        : html`
            <button class="btn sm" data-act="tool-edit" data-id="${t.id}">Edit</button>
            <button class="btn sm" data-act="tool-rename" data-id="${t.id}">Rename</button>`;
      acts = html`
        <div class="btns">
          ${change}<button class="btn sm ghost" data-act="tool-remove" data-id="${t.id}">
            Remove
          </button>
        </div>`;
    }
    detail = `<div class="tdetail"><ol class="recipe">${recipeHTML(t)}</ol>${acts}</div>`;
  }
  const shortcut = key ? ` title="Shortcut: ${key}"` : '';
  const keyCap = key ? `<span class="tkey"><kbd>${key}</kbd></span>` : '';
  const chevron = open ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4';
  return html`
    <div class="tcard ${active ? 'is-active' : ''}" data-drag="tool" data-id="${t.id}">
      <div class="tcard-row">
        ${GRIP}
        <button
          class="tcard-main" data-act="tool-use" data-id="${t.id}"
          aria-pressed="${active}"${shortcut}>
          <span class="tname">${esc(t.name)}</span>${keyCap}<span class="tsig">${sigHTML(t)}</span>
        </button>
        <button
          class="tmore" data-act="tool-more" data-id="${t.id}" aria-expanded="${open}"
          aria-label="Recipe and options for ${esc(t.name)}">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="${chevron}" fill="none" stroke="currentColor" stroke-width="1.6"/>
          </svg>
        </button>
      </div>
      ${detail}
    </div>`;
}

export function renderTools() {
  const off = ui.def ? ' disabled' : '';
  let adds;
  if (formOpen('tool-import')) {
    adds = importList(importable(sheet.box));
  } else {
    adds = `<button class="tool-add" data-act="def-start"${off}>Define a tool</button>`;
    if (!lessonOf(sheet.box) || importable(sheet.box).length) {
      adds += `<button class="tool-add" data-act="tool-import"${off}>Import a tool</button>`;
    }
  }
  $('#tools').innerHTML = allTools().map(toolCard).join('') + adds;
  $('#boxName').textContent = boxName(sheet.box) + ' toolbox';
}
