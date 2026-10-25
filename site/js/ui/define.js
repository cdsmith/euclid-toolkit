// Defining and editing tools, and making exercises: the panel's steps end here, in saving a tool or
// an exercise; and tools moved between toolboxes (import, remove, copy).
import { TOOLS, newId } from '../engine/construction.js';
import { compileTool, exerciseError } from '../engine/tools.js';
import { defWords } from './definepanel.js';
import { $ } from './dom.js';
import { renderKit } from './kit.js';
import { endTool } from './picking.js';
import { renderAll } from './render.js';
import { doc, openSheet, sheet, toolSheet } from './sheet.js';
import { STATE, boxName, boxTools, diagramOf, ownToolIds, persist, toolById, ui } from './state.js';
import { WORK_KEY, lsDel } from './storage.js';
import { importable } from './toollist.js';
import { openForm, toast } from './widgets.js';

// Defining a tool and using one never overlap: starting to define puts the armed tool down.
export function startDefine(preset) {
  endTool();
  ui.sel = [];
  const fresh = { stage: 'in', ins: [], scaffold: [], outs: [], after: [], name: '', error: '' };
  ui.def = { ...fresh, tool: null, ...preset };
  if (ui.def.stage === 'name' && !compileDef()) ui.def.stage = 'out';
  renderAll();
  // on a phone, the panel is below the sheet
  if (matchMedia('(max-width:760px)').matches) {
    $('#defSec').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Compiles the tool being defined, keeping it (to show its signature) or the reason it can't be
// made.
export function compileDef() {
  const r = compileTool(doc, ui.def.ins, ui.def.outs, ui.def.name, defWords());
  ui.def.tool = r.tool || null;
  ui.def.error = r.error || '';
  return !!r.tool;
}

// What a tool takes and makes, and the relations it needs: a tool can be changed in place only if
// these stay the same.
const signature = (t) =>
  JSON.stringify([
    t.ins.map((x) => [x.kind, x.on || [], x.center || []]),
    t.outs.map((x) => x.kind),
  ]);

function addTool(t) {
  STATE.tools.push(t);
  TOOLS.set(t.id, t);
  ownToolIds(t.box).push(t.id);
  persist();
}

// Marking a diagram as an exercise, or changing one. The title is the diagram's name, and the tool
// it earns is named after it unless named otherwise.
const NO_EXERCISE = { givens: [], scaffold: [], goals: [], elaboration: [], toolName: '' };

export function exercisePanel() {
  const { p } = diagramOf(sheet.id);
  const ex = p.exercise || NO_EXERCISE;
  const has = (id) => !!doc.elems[id];
  startDefine({
    exercise: true,
    editing: !!p.exercise,
    ins: ex.givens.filter(has),
    scaffold: ex.scaffold.filter(has),
    outs: ex.goals.filter(has),
    after: ex.elaboration.filter(has),
    toolName: ex.toolName,
  });
}

export function saveExercise() {
  const d = ui.def;
  const { p } = diagramOf(sheet.id);
  const ex = {
    givens: d.ins.slice(),
    scaffold: d.scaffold.slice(),
    goals: d.outs.slice(),
    elaboration: d.after.slice(),
    toolName: d.toolName.trim() || p.name,
  };
  d.error = exerciseError(doc, ex);
  if (d.error) {
    renderKit();
    return;
  }
  p.exercise = ex;
  ui.def = null;
  persist();
  renderAll();
  toast(d.editing ? `Saved “${p.name}”.` : `“${p.name}” is an exercise.`);
}

export function removeExercise() {
  delete diagramOf(sheet.id).p.exercise;
  persist();
  renderAll();
}

// Saving changes to a tool updates it everywhere it's used, unless its kinds of inputs or outputs
// changed: then it's saved as a new tool.
export function saveDefined() {
  const d = ui.def;
  const r = compileTool(doc, d.ins, d.outs, d.name);
  if (r.error) {
    d.error = r.error;
    renderKit();
    return;
  }
  if (!d.editing) {
    r.tool.box = sheet.box;
    addTool(r.tool);
    ui.def = null;
    renderAll();
    toast(`Saved “${r.tool.name}” to the ${boxName(r.tool.box)} toolbox.`);
    return;
  }
  const old = TOOLS.get(d.editing);
  if (signature(r.tool) === signature(old)) {
    const { name, ins, outs, graph, inIds, outIds, sample } = r.tool;
    Object.assign(old, { name, ins, outs, graph, inIds, outIds, sample });
    persist();
    toast(`Updated “${old.name}”. Constructions that use it follow the new version.`);
  } else {
    r.tool.box = old.box;
    addTool(r.tool);
    toast(`The inputs or outputs changed, so this was saved as a new tool, “${r.tool.name}”.`);
  }
  leaveEdit();
}

export function leaveEdit() {
  lsDel(WORK_KEY + sheet.id);
  const back = ui.returnTo;
  ui.returnTo = null;
  openSheet(back, { discard: true });
}

export function openEdit(id) {
  if (sheet.kind !== 'tool') ui.returnTo = sheet.id;
  openSheet(toolSheet(TOOLS.get(id)).id);
}

export function renameTool(id, name) {
  TOOLS.get(id).name = name;
  persist();
  renderAll();
}

// A tool's construction, for telling whether two tools are built the same way. The tools it uses go
// by how they're built too, since copies of a tool in different toolboxes have different ids.
export function buildKey(t) {
  if (t.builtin) return t.id;
  return JSON.stringify([t.ins, t.outs, t.inIds, t.outIds, t.graph], (k, v) =>
    k === 'tool' && TOOLS.has(v) ? buildKey(TOOLS.get(v)) : v,
  );
}

// The id of tool t in toolbox box: t itself if it's there, or one built the same way that's there,
// or a copy put there, with copies of the tools it uses, which aren't shown in the toolbox.
function copyTool(t, box) {
  if (t.box === box) return t.id;
  const key = buildKey(t);
  const have = boxTools(box).find((u) => buildKey(u) === key);
  if (have) return have.id;
  const c = { ...structuredClone(t), id: newId('t'), box };
  for (const n of Object.values(c.graph.nodes)) {
    if (n.op === 'tool') n.tool = copyTool(TOOLS.get(n.tool), box);
  }
  STATE.tools.push(c);
  TOOLS.set(c.id, c);
  return c.id;
}

// A tool is imported into the toolbox as a copy (see copyTool), and shown there. The list stays
// open while there's more to import.
export function importTool(id) {
  const t = toolById(id);
  const tid = t.builtin ? t.id : copyTool(t, sheet.box);
  const ids = ownToolIds(sheet.box);
  if (!ids.includes(tid)) ids.push(tid);
  persist();
  toast(`Imported “${t.name}”.`);
  if (importable(sheet.box).length) openForm('tool-import');
  else renderAll();
}

// A removed tool leaves the toolbox, but constructions that use it keep working.
export function removeTool(id) {
  const t = toolById(id);
  const ids = ownToolIds(sheet.box);
  ids.splice(ids.indexOf(id), 1);
  if (!t.builtin) lsDel(WORK_KEY + toolSheet(t).id);
  persist();
  ui.expanded = null;
  renderAll();
  toast(`Removed “${t.name}”.`);
}
