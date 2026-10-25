// A notebook diagram's name, subtitle and text are written in place, one at a time: ui.writing is
// { key, draft } while one is ('name', 'subtitle' or 'text'). Each has its own spot in the title
// (#tbName, #tbSub, #tbText), and only that spot is redrawn (and the notebook's list, for a name).
// Also here: which folds in the title are open is kept while the sheet is (ui.folds, by place in
// the title), so redrawing the title doesn't close them.
import { $, esc, html } from './dom.js';
import { textHTML } from './markdown.js';
import { renderNav } from './nav.js';
import { sheet } from './sheet.js';
import { diagramOf, persist, ui } from './state.js';

const foldsHere = () => [...$('#titleblock').querySelectorAll('details.fold')];

export function restoreFolds() {
  foldsHere().forEach((d, i) => {
    if (ui.folds.has(i)) d.open = true;
  });
}

$('#titleblock').addEventListener(
  'toggle',
  (e) => {
    if (!e.target.matches('details.fold')) return;
    const i = foldsHere().indexOf(e.target);
    if (e.target.open) ui.folds.add(i);
    else ui.folds.delete(i);
  },
  true,
);

const writing = (key) => ui.writing?.key === key;

export function diagramNameHTML(p) {
  if (writing('name')) {
    return html`
      <input
        id="writeField" class="tb-nameedit" aria-label="Diagram name" maxlength="40"
        autocomplete="off" value="${esc(ui.writing.draft)}">`;
  }
  return html`
    <h1>
      <button class="tb-namebtn" data-act="write" data-id="name" title="Rename this diagram">
        ${esc(p.name)}
      </button>
    </h1>`;
}

export function subtitleHTML(p) {
  if (writing('subtitle')) {
    return html`
      <input
        id="writeField" class="tb-subedit" aria-label="Subtitle" placeholder="Subtitle"
        maxlength="60" autocomplete="off" value="${esc(ui.writing.draft)}">`;
  }
  const has = !!p.subtitle;
  const title = has ? 'Edit the subtitle' : 'Add a subtitle';
  return html`
    <button
      class="tb-sub tb-subbtn${has ? '' : ' empty'}" data-act="write" data-id="subtitle"
      title="${title}">${esc(p.subtitle || 'Add subtitle')}</button>`;
}

export function titleTextHTML(p) {
  if (writing('text')) {
    return html`
      <textarea
        id="writeField" class="tb-edit" aria-label="Text"
        placeholder="Markdown, with $…$ for math">${esc(ui.writing.draft)}</textarea>`;
  }
  if (!p.text)
    return '<button class="tb-textbtn" data-act="write" data-id="text">Add text</button>';
  return html`
    <div class="tb-text md">${textHTML(p.text)}</div>
    <button class="tb-textbtn" data-act="write" data-id="text">Edit text</button>`;
}

const SPOTS = {
  name: ['#tbName', diagramNameHTML],
  subtitle: ['#tbSub', subtitleHTML],
  text: ['#tbText', titleTextHTML],
};

function fitTextArea(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

export function startWriting(key) {
  const { p } = diagramOf(sheet.id);
  const [spot, spotHTML] = SPOTS[key];
  ui.writing = { key, draft: p[key] || '' };
  $(spot).innerHTML = spotHTML(p);
  const field = $('#writeField');
  if (field.tagName === 'TEXTAREA') fitTextArea(field);
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

// Writing ends when the field loses focus; left empty, the subtitle or text goes, and the name
// stays. If a press took the focus, the field stays in place until the press is over: closing it
// can change the title's height, which would move a button out from under the click.
let pressing = false;
window.addEventListener('pointerdown', () => (pressing = true), true);
window.addEventListener('pointerup', () => (pressing = false), true);
window.addEventListener('pointercancel', () => (pressing = false), true);

function finishWriting() {
  const { key, draft } = ui.writing;
  const { p } = diagramOf(sheet.id);
  const value = key === 'text' ? draft.replace(/\s+$/, '') : draft.trim();
  const [spot, spotHTML] = SPOTS[key];
  ui.writing = null;
  if (value !== (p[key] || '') && (value || key !== 'name')) {
    if (value) p[key] = value;
    else delete p[key];
    persist();
  }
  const show = () => {
    if (!writing(key) && sheet.kind === 'notebook' && $(spot)) {
      $(spot).innerHTML = spotHTML(diagramOf(sheet.id).p);
      restoreFolds();
    }
    if (key === 'name') renderNav();
  };
  if (pressing) window.addEventListener('pointerup', () => setTimeout(show), { once: true });
  else show();
}

$('#titleblock').addEventListener('input', (e) => {
  if (e.target.id !== 'writeField') return;
  ui.writing.draft = e.target.value;
  if (e.target.tagName === 'TEXTAREA') fitTextArea(e.target);
});

$('#titleblock').addEventListener('focusout', (e) => {
  if (e.target.id === 'writeField') finishWriting();
});
