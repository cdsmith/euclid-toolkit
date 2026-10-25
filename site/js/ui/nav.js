// The nav lists every notebook and lesson as a card. The one holding the current sheet is open: it
// lists its diagrams or problems, and ends with its own controls.
import { LESSONS, problemsOf } from '../engine/lessons.js';
import { $, esc, html, pad2 } from './dom.js';
import { COPY, GRIP, PENCIL, TRASH } from './icons.js';
import { exportCheck } from './library.js';
import { sheet } from './sheet.js';
import { STATE, diagramsIn, isSolved, lessonOf, toolIds, toolbox, ui } from './state.js';
import { confirmBox, confirmOpen, formOpen, nameForm, pencil, plural, roman } from './widgets.js';

export function renderNav() {
  const open = sheet.box;
  let summary = '';
  const notebooks = STATE.notebooks.map((b) => {
    const diagrams = plural(diagramsIn(b).length, 'diagram');
    const meta = diagrams + ' · ' + plural(toolIds(b.id).length, 'tool');
    if (b.id !== open) return closedCard(b.id, b.name, '', meta);
    summary = `${esc(b.name)}: ${diagrams}`;
    return notebookCard(b, meta);
  });
  const lessons = LESSONS.map((L) => {
    const problems = problemsOf(L);
    const solved = problems.filter(isSolved).length;
    const n = problems.length;
    if (L.id !== open) {
      const meta = solved ? `${solved} of ${n} solved` : plural(n, 'problem');
      return closedCard(L.id, L.title, L.blurb, meta);
    }
    summary = `${esc(L.title)}: <b>${solved}</b>/${n} solved`;
    return lessonCard(L, solved);
  });
  $('#nav').innerHTML = html`
    <section class="nav-sec">
      <h2>Notebooks</h2>
      <div class="cards">
        ${notebooks.join('')}
        <button class="card-add" data-act="notebook-new">New notebook</button>
        <button
          class="card-add" data-act="notebook-import"
          title="Open a lesson file as a notebook, to work on">Import a notebook</button>
      </div>
    </section>
    <section class="nav-sec">
      <h2>Lessons</h2>
      <div class="cards">
        ${lessons.join('')}
        <button class="card-add" data-act="lesson-import">Import a lesson</button>
      </div>
    </section>`;
  $('#headSum').innerHTML = summary;
}

const closedCard = (id, name, blurb, meta) => html`
  <button class="card" data-act="card-open" data-id="${id}">
    <span class="card-name">${esc(name)}</span>
    ${blurb ? `<span class="card-blurb">${esc(blurb)}</span>` : ''}
    <span class="card-meta">${meta}</span>
  </button>`;

const cardHead = (name, meta) => html`
  <div class="card-head">
    <div><h3 class="card-name">${name}</h3><p class="card-meta">${meta}</p></div>
    <button class="btn ghost" data-act="card-close" title="Close and go to the start page">
      Close
    </button>
  </div>`;

const iconButton = (act, id, label, icon, title = label) => html`
  <button
    class="icon-btn" data-act="${act}" data-id="${id}" title="${title}"
    aria-label="${label}">${icon}</button>`;

function notebookCard(b, meta) {
  const head = formOpen('notebook-rename', b.id)
    ? nameForm({ value: b.name, label: 'Notebook name' })
    : cardHead(esc(b.name) + pencil('notebook-rename', b.id, 'notebook'), meta);
  const rows = b.diagrams.map((p) => (p.section ? sectionRow(p) : diagramRow(b, p)));
  const made = !!lessonOf(b.lessonId);
  let foot;
  if (confirmOpen('notebook-delete', b.id)) {
    foot = confirmBox(
      `Delete “${esc(b.name)}”, with its diagrams and tools? This can't be undone.`,
    );
  } else if (formOpen('notebook-export', b.id)) {
    foot = exportForm(b);
  } else {
    foot = html`
      <div class="btns">
        <button class="btn sm" data-act="notebook-export" data-id="${b.id}">
          ${made ? 'Update lesson' : 'Export as lesson'}
        </button>
        <button class="btn ghost sm" data-act="notebook-delete" data-id="${b.id}">Delete</button>
      </div>`;
  }
  return html`
    <div class="card is-open">
      ${head}
      <ol class="items diagrams">${rows.join('')}</ol>
      <div class="row-adds">
        <button class="row-add" data-act="diagram-new" data-id="${b.id}">New diagram</button>
        <button class="row-add" data-act="section-new" data-id="${b.id}">New section</button>
      </div>
      <div class="card-foot">${foot}</div>
    </div>`;
}

// A diagram's row renames it in place, duplicates it, and deletes it (but not a notebook's only
// diagram: delete the notebook).
function diagramRow(b, p) {
  if (formOpen('diagram-rename', p.id)) {
    return `<li class="diagram-row">${nameForm({ value: p.name, label: 'Diagram name' })}</li>`;
  }
  const current = p.id === sheet.id || p.id === sheet.diagramId ? ' is-current' : '';
  const ex = p.exercise;
  let mark = '';
  if (ex?.error) {
    mark = `<span class="ex-mark bad" title="Exercise, needs fixing: ${esc(ex.error)}">!</span>`;
  } else if (ex) {
    mark = '<span class="ex-mark" title="Exercise">◎</span>';
  }
  const del =
    diagramsIn(b).length > 1
      ? iconButton('diagram-delete', p.id, 'Delete this diagram', TRASH)
      : '';
  const confirm = confirmOpen('diagram-delete', p.id)
    ? confirmBox(`Delete “${esc(p.name)}” and its construction? This can't be undone.`)
    : '';
  return html`
    <li class="diagram-row" data-drag="diagram" data-id="${p.id}">
      ${GRIP}
      <button class="item diagram${current}" data-act="sheet-open" data-id="${p.id}">
        <span class="nm">${esc(p.name)}</span>${mark}
      </button>
      <span class="row-acts">
        ${iconButton('diagram-rename', p.id, 'Rename this diagram', PENCIL)}
        ${iconButton('diagram-duplicate', p.id, 'Duplicate this diagram', COPY)}
        ${del}
      </span>
      ${confirm}
    </li>`;
}

// A section heading's row renames it in place and deletes it, leaving its diagrams to the section
// above.
function sectionRow(s) {
  if (formOpen('section-rename', s.id)) {
    const form = nameForm({ value: s.name, label: 'Section name' });
    return `<li class="diagram-row section-row">${form}</li>`;
  }
  const del = 'Delete this heading';
  return html`
    <li class="diagram-row section-row" data-drag="diagram" data-id="${s.id}">
      ${GRIP}<span class="sec-name">${esc(s.name)}</span>
      <span class="row-acts">
        ${iconButton('section-rename', s.id, 'Rename this section', PENCIL)}
        ${iconButton('section-delete', s.id, del, TRASH, `${del}; its diagrams stay`)}
      </span>
    </li>`;
}

// Exporting a notebook as a lesson asks for a description, and says what will go in it or what's in
// the way.
function exportForm(b) {
  const { diagrams, exercises, issues } = exportCheck(b);
  const made = !!lessonOf(b.lessonId);
  const blurb = ui.form.blurb !== undefined ? ui.form.blurb : b.blurb || '';
  const others = diagrams.length - exercises.length;
  const contents =
    `${plural(exercises.length, 'problem')}, ${plural(others, 'other diagram')} and ` +
    `${plural(toolbox(b.id).length, 'tool')}`;
  const errors = issues.length
    ? `<div class="err" role="alert">${issues.map((x) => `<p>${x}</p>`).join('')}</div>`
    : '';
  return html`
    <form class="export-form" id="exportForm" data-id="${b.id}">
      <p class="note">
        ${made ? 'Updates' : 'Makes'} the lesson “${esc(b.name)}”, with ${contents}.
      </p>
      <label class="flab" for="lessonBlurb">Description</label>
      <textarea
        id="lessonBlurb" rows="3" maxlength="300"
        placeholder="What the lesson is about">${esc(blurb)}</textarea>
      ${errors}
      <div class="btns">
        <button class="btn ink sm" type="submit"${issues.length ? ' disabled' : ''}>
          ${made ? 'Update lesson' : 'Export'}
        </button>
        <button class="btn ghost sm" type="button" data-act="form-cancel">Cancel</button>
      </div>
    </form>`;
}

// A lesson's problems are numbered; its diagrams are marked ◇.
function lessonCard(L, solved) {
  const problems = problemsOf(L);
  let named = 0;
  const tiers = L.tiers.map((tier, ti) => {
    const heading = tier ? `<h4><span class="roman">${roman(++named)}</span>${esc(tier)}</h4>` : '';
    const items = L.items.filter((it) => it.tier === ti).map((it) => lessonItem(it, problems));
    return `<div class="tier">${heading}<ol class="items">${items.join('')}</ol></div>`;
  });
  let foot;
  if (confirmOpen('lesson-reset', L.id)) {
    foot = confirmBox(
      `Delete the tools, progress and saved constructions for ${esc(L.title)}? ` +
        `This can't be undone.`,
    );
  } else if (confirmOpen('lesson-delete', L.id)) {
    foot = confirmBox(
      `Delete the lesson ${esc(L.title)}, with your progress and constructions in it? ` +
        `This can't be undone.`,
    );
  } else {
    const del = STATE.lessons.includes(L)
      ? `<button class="btn ghost sm" data-act="lesson-delete" data-id="${L.id}">Delete</button>`
      : '';
    foot = html`
      <div class="btns">
        <button class="btn ghost sm" data-act="lesson-reset" data-id="${L.id}">Reset</button>
        <button class="btn ghost sm" data-act="lesson-download" data-id="${L.id}">Download</button>
        ${del}
      </div>`;
  }
  return html`
    <div class="card is-open">
      ${cardHead(esc(L.title), `<b>${solved}</b> of ${problems.length} solved`)}
      ${tiers.join('')}
      <div class="card-foot">${foot}</div>
    </div>`;
}

function lessonItem(it, problems) {
  const problem = it.kind === 'problem';
  const done = problem && isSolved(it);
  const cls =
    (problem ? '' : ' is-diagram') +
    (it.id === sheet.id ? ' is-current' : '') +
    (done ? ' is-solved' : '');
  return html`
    <li>
      <button class="item${cls}" data-act="sheet-open" data-id="${it.id}">
        <span class="no">${problem ? pad2(problems.indexOf(it) + 1) : '◇'}</span>
        <span class="nm">${esc(it.title)}</span>
        <span class="st">${done ? '<span aria-label="solved">✓</span>' : ''}</span>
      </button>
    </li>`;
}
