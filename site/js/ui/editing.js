// Changing what's on the sheet from the selection panel and the construction log: selecting,
// styling, labeling, showing and hiding, and deleting.
import { deletionPlan, removeNodes } from '../engine/construction.js';
import { $ } from './dom.js';
import { draw } from './draw.js';
import { renderKit } from './kit.js';
import { nameHTML, renderLog } from './log.js';
import { endTool } from './picking.js';
import { renderAll, renderView } from './render.js';
import { selWhat } from './selection.js';
import { commit, computeInside, doc, pushUndo, refresh, saveWork } from './sheet.js';
import { ui } from './state.js';
import { askConfirm, confirmBox, dismiss, toast } from './widgets.js';

// Selects these elements (additive: adds or removes them from the selection).
export function select(ids, additive) {
  const ended = endTool();
  const closed = dismiss();
  if (additive) {
    for (const id of ids) {
      const i = ui.sel.indexOf(id);
      if (i >= 0) ui.sel.splice(i, 1);
      else ui.sel.push(id);
    }
  } else ui.sel = ids.slice();
  if (ended || closed) renderAll();
  else {
    renderKit();
    draw();
  }
}

export function setStyle(ids, patch) {
  commit(() => {
    for (const id of ids) {
      const e = doc.elems[id];
      const st = Object.assign({}, e.style, patch);
      for (const k of Object.keys(st)) if (st[k] == null) delete st[k];
      if (Object.keys(st).length) e.style = st;
      else delete e.style;
    }
  });
}

// A label is committed when its field loses focus, often because you clicked another control in the
// selection panel. So the panel itself isn't rebuilt, which would swallow that click.
export function setLabel(id, text) {
  text = text.trim();
  if (text === doc.elems[id].label) return;
  pushUndo();
  doc.elems[id].label = text;
  refresh();
  saveWork();
  $('#selSec .what').innerHTML = selWhat(ui.sel);
  renderLog();
  renderView();
  draw();
}

// A construction row is shown, hidden, or (a tool use) shown with how it's built.
export function setRowMode(id, mode) {
  const n = doc.nodes[id];
  const es = n.outs.map((e) => doc.elems[e]);
  if (mode === (es.every((e) => e.hidden) ? 'hide' : n.detail ? 'detail' : 'show')) return;
  commit(() => {
    es.forEach((e) => {
      if (mode === 'hide') e.hidden = true;
      else delete e.hidden;
    });
    if (mode === 'detail') n.detail = true;
    else delete n.detail;
  });
}

// Shows, hides or opens a step inside a tool use. It's only how the sheet looks, so it isn't kept
// or undone.
export function setStepMode(id, mode) {
  const { hide, open } = ui.steps;
  hide.delete(id);
  open.delete(id);
  if (mode === 'hide') hide.add(id);
  else if (mode === 'detail') open.add(id);
  computeInside();
  renderLog();
  draw();
}

export function setHidden(ids, hide) {
  commit(() => {
    for (const id of ids) {
      const e = doc.elems[id];
      if (hide) e.hidden = true;
      else delete e.hidden;
    }
  });
}

// Deleting asks first only when more goes than what you picked. The question appears where you
// asked to delete: in the selection panel ('sel') or on a construction row (its node's id).
export function requestDelete(nodeIds, chosen, at) {
  const plan = deletionPlan(doc, nodeIds);
  if (!plan.roots.length) {
    toast("Given objects can't be deleted.");
    return;
  }
  const pick = new Set(chosen);
  const extra = [];
  for (const id of plan.all) {
    const n = doc.nodes[id];
    if (n.aux && !plan.roots.includes(id)) continue;
    for (const e of n.outs) if (!pick.has(e) && !doc.elems[e].internal) extra.push(e);
  }
  if (extra.length) askConfirm({ kind: 'elements-delete', id: at, all: [...plan.all], extra });
  else commit(() => removeNodes(doc, plan.all));
}

// Says what else deleting would delete (the first eight, and how many more).
export function deleteConfirmHTML() {
  const names = ui.confirm.extra.map(nameHTML);
  const more = names.length > 8 ? ` and ${names.length - 8} more` : '';
  return confirmBox(`Deleting this also deletes ${names.slice(0, 8).join(', ')}${more}.`);
}
