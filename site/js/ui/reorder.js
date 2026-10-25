// Diagrams, section headings and tools are moved by dragging: with a mouse, press anywhere on one
// and move it; on a touch screen, drag its grip. A line shows where it will land. Esc cancels.
import { renderAll } from './render.js';
import { sheet } from './sheet.js';
import { STATE, entryOf, persist, toolIds } from './state.js';

// Moves a diagram or tool to just before another one, or to the end.
function moveItem(kind, id, beforeId) {
  const place = (ids) => {
    const rest = ids.filter((x) => x !== id);
    rest.splice(beforeId ? rest.indexOf(beforeId) : rest.length, 0, id);
    return rest;
  };
  if (kind === 'diagram') {
    const { b } = entryOf(id);
    const byId = new Map(b.diagrams.map((p) => [p.id, p]));
    b.diagrams = place(b.diagrams.map((p) => p.id)).map((x) => byId.get(x));
  } else {
    STATE.toolboxes[sheet.box] = place(toolIds(sheet.box));
  }
  persist();
  renderAll();
}

// The row being dragged, and whether the click that ends the drag is to be ignored.
export let reorder = null;
let swallowClick = false;

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-drag]');
  if (e.button > 0 || !el || e.target.closest('.row-acts, .tmore, .tdetail, form')) return;
  if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;
  reorder = {
    el,
    kind: el.dataset.drag,
    id: el.dataset.id,
    y: e.clientY,
    on: false,
    before: undefined,
  };
});

document.addEventListener('pointermove', (e) => {
  const d = reorder;
  if (!d || (!d.on && Math.abs(e.clientY - d.y) < 5)) return;
  if (!d.on) {
    d.on = true;
    d.el.classList.add('is-dragging');
  }
  const others = [
    ...d.el.parentElement.querySelectorAll(`:scope > [data-drag="${d.kind}"]`),
  ].filter((x) => x !== d.el);
  const next = others.find((x) => {
    const r = x.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  });
  others.forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  if (next) next.classList.add('drop-before');
  else if (others.length) others[others.length - 1].classList.add('drop-after');
  d.before = next ? next.dataset.id : null;
});

export function endReorder(apply) {
  const d = reorder;
  reorder = null;
  if (!d || !d.on) return;
  swallowClick = true;
  setTimeout(() => {
    swallowClick = false;
  });
  if (apply && d.before !== undefined) moveItem(d.kind, d.id, d.before);
  else renderAll();
}

document.addEventListener('pointerup', () => endReorder(true));

document.addEventListener('pointercancel', () => endReorder(false));

// The click that ends a drag isn't a click on what was dragged.
document.addEventListener(
  'click',
  (e) => {
    if (swallowClick) {
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true,
);
