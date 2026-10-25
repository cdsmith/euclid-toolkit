// Using tools: arming one, picking its inputs on the canvas, and using it once they're all picked;
// and clicks on the canvas otherwise (selecting, or picking for a tool being defined).
import { addNode, nameOf, runTool } from '../engine/construction.js';
import {
  curveDist,
  isectAll,
  onCirclePt,
  onLinePt,
  placeOn,
  pt,
  same,
  sameDrawn,
} from '../engine/geometry.js';
import { brokenRelations } from '../engine/tools.js';
import { DEF_PICKS, defRole, defStages } from './definepanel.js';
import { draw } from './draw.js';
import { select } from './editing.js';
import { hitCand, hitCurve, hitPick, hitPoint } from './hit.js';
import { renderKit } from './kit.js';
import { renderAll, renderPrompt } from './render.js';
import { ELIST, VALS, commit, doc, labeler, mint, sheet } from './sheet.js';
import { toolById, toolbox, ui, usesTool } from './state.js';
import { toWorld, view } from './view.js';
import { dismiss, toast } from './widgets.js';

// The tools you can use on this sheet. A lesson's diagram can only be dragged. While a tool is
// being edited, neither it nor a tool that uses it can be used in it.
export function allTools() {
  if (sheet.kind === 'diagram') return [];
  if (sheet.kind === 'tool') return toolbox(sheet.box).filter((t) => !usesTool(t, sheet.tool));
  return toolbox(sheet.box);
}

export const curTool = () => ui.tool && toolById(ui.tool);

// What a tool (built in or saved) makes from these inputs, or null.
export function applyTool(t, inputs) {
  if (!t.builtin) return runTool(t, inputs);
  const v = t.make(inputs);
  return v ? [v] : null;
}

// A tool stays armed for repeated use until you choose another, press Esc, or do anything other
// than viewing.
export function endTool() {
  if (!ui.tool) return false;
  ui.tool = null;
  ui.pending = [];
  ui.hover = null;
  return true;
}

// Arms a tool (or, toggling, puts down the one armed). An armed tool and a selection never coexist.
export function setTool(id, toggle) {
  ui.def = null;
  ui.tool = toggle && ui.tool === id ? null : id;
  ui.pending = [];
  ui.hover = null;
  if (ui.tool) {
    ui.sel = [];
    dismiss();
  }
  renderAll();
}

// A new point at an intersection is the one other than a point already at the other intersection,
// if there is one; otherwise it's recorded by which of the two it is. made: [id, value] of points
// added in the same step.
function isectNode(cd, made = []) {
  const all = isectAll(VALS.get(cd.a), VALS.get(cd.b));
  const other = all.length === 2 ? all[1 - cd.which] : null;
  const points = ELIST.filter((e) => !e.internal && e.kind === 'point').map((e) => [
    e.id,
    VALS.get(e.id),
  ]);
  const there = other && [...points, ...made].find(([, v]) => same(v, other));
  return there
    ? { op: 'isect', ins: [cd.a, cd.b, there[0]] }
    : { op: 'isect', ins: [cd.a, cd.b], which: cd.which };
}

// A new arbitrary point where you clicked: on a line or circle if the click is on one, otherwise
// free. onto: curves a new point should go on, if the click is close enough to one, before any
// other.
function pointNode(sx, sy, tol, onto = []) {
  const [wx, wy] = toWorld(sx, sy);
  const near = onto.find((id) => curveDist(VALS.get(id), wx, wy) * view.s < tol);
  const cu = near ? doc.elems[near] : hitCurve(sx, sy, tol * 0.75);
  if (!cu) return { op: 'point', ins: [], x: wx, y: wy };
  const c = VALS.get(cu.id);
  return c.kind === 'line'
    ? { op: 'point', ins: [cu.id], t: placeOn(c, wx, wy) }
    : { op: 'point', ins: [cu.id], a: Math.atan2(wy - c.cy, wx - c.cx) };
}

function pointValue(node) {
  if (!node.ins.length) return pt(node.x, node.y);
  const c = VALS.get(node.ins[0]);
  return c.kind === 'line' ? onLinePt(c, node.t) : onCirclePt(c, node.a);
}

// The inputs picked for the armed tool are kept as picks: { id, value } for an element that exists,
// or, for a point that doesn't exist yet, { cand, value } (an intersection) or { node, value } (a
// new point). Those points are made only when the tool is used, unlabeled, in the same step;
// putting the tool down drops them.
function pickPoint(sx, sy, tol, onto = []) {
  const o = hitPoint(sx, sy, tol);
  if (o) return { id: o.id, value: VALS.get(o.id) };
  const p = hitPick(sx, sy, tol);
  if (p) return p;
  const cd = hitCand(sx, sy, tol);
  if (cd) return { cand: cd, value: cd.p };
  const node = pointNode(sx, sy, tol, onto);
  return { node, value: pointValue(node) };
}

// The step that makes a picked point that doesn't exist yet. made: as for isectNode.
const pickNode = (p, made) => ({ ...(p.cand ? isectNode(p.cand, made) : p.node), aux: true });

// Why pick k for tool t doesn't keep a relation the tool needs with an input picked before it, or
// ''. The picks are tried on a copy of the construction, with the points that don't exist yet made
// there.
function pickError(t, picks, k) {
  if (!t.ins.some((x) => x.on || x.center)) return '';
  const g = structuredClone(doc);
  const made = [];
  const ids = picks.map((p) => {
    if (p.id) return p.id;
    const id = addNode(g, pickNode(p, made), ['point'], ['']).outs[0];
    made.push([id, p.value]);
    return id;
  });
  const bad = brokenRelations(g, t, ids, (i, j) => Math.max(i, j) === k)[0];
  if (!bad) return '';
  const [rel, i, j, now] = bad;
  const name = (q) => (picks[q].id ? nameOf(doc, picks[q].id) : 'the point you picked');
  if (i === k) {
    const where = rel === 'on' ? `on ${name(j)}` : `the center of ${name(j)}`;
    return now
      ? `That point is ${where} only as it's placed. Pick one built there.`
      : `That point isn't ${where}.`;
  }
  const what = t.ins[j].kind;
  const how = rel === 'on' ? `goes through ${name(i)}` : `is centered at ${name(i)}`;
  if (now) return `That ${what} ${how} only as things are placed. Pick one built that way.`;
  const doesnt = rel === 'on' ? `go through ${name(i)}` : `have ${name(i)} as its center`;
  return `That ${what} doesn't ${doesnt}.`;
}

// Makes the picked points that don't exist yet, and returns the ids of all the picks.
function makePicks(picks) {
  const made = [];
  return picks.map((p) => {
    if (p.id) return p.id;
    if (!p.made) {
      p.made = mint(pickNode(p, made), ['point'], ['']).outs[0];
      made.push([p.made, p.value]);
    }
    return p.made;
  });
}

// A click on the canvas (not the end of a drag). additive: shift, ctrl or cmd was held.
export function onClick(sx, sy, tol, additive) {
  if (sheet.kind === 'diagram') return;
  if (ui.def) {
    if (ui.def.stage === 'name') {
      toast('Go back a step to change the inputs or outputs.');
      return;
    }
    const o = hitPoint(sx, sy, tol) || hitCurve(sx, sy, tol * 0.8);
    if (o) toggleDef(o.id);
    return;
  }
  const tool = curTool();
  if (!tool) {
    const o = hitPoint(sx, sy, tol) || hitCurve(sx, sy, tol * 0.8);
    if (o || !additive) select(o ? [o.id] : [], additive);
    return;
  }
  if (tool.id === 'point') {
    addPoint(sx, sy, tol);
    return;
  }
  const k = ui.pending.length;
  const slot = tool.ins[k];
  let pick = null;
  if (slot.kind === 'point') {
    const onto = (slot.on || []).filter((j) => j < k).map((j) => ui.pending[j].id);
    pick = pickPoint(sx, sy, tol, onto);
  } else {
    const cu = hitCurve(sx, sy, tol, slot.kind);
    if (cu) pick = { id: cu.id, value: VALS.get(cu.id) };
  }
  if (!pick) {
    toast(`Pick a ${slot.kind} for ${slot.label}.`);
    return;
  }
  const why = pickError(tool, [...ui.pending, pick], k);
  if (why) {
    toast(why);
    return;
  }
  ui.pending.push(pick);
  if (ui.pending.length < tool.ins.length) {
    renderPrompt();
    draw();
    return;
  }
  useTool(tool);
}

// The Point tool: a new point where you clicked, unless there's one there already.
function addPoint(sx, sy, tol) {
  const o = hitPoint(sx, sy, tol);
  if (o) {
    toast(`${o.label || 'A point'} is already there.`);
    return;
  }
  const cd = hitCand(sx, sy, tol);
  commit(() => mint(cd ? isectNode(cd) : pointNode(sx, sy, tol), ['point'], [labeler()()]));
}

// Uses the armed tool on what's been picked, if it can be.
function useTool(tool) {
  const picks = ui.pending;
  ui.pending = [];
  const made = applyTool(
    tool,
    picks.map((p) => p.value),
  );
  const fail = (msg) => {
    toast(msg);
    renderPrompt();
    draw();
  };
  if (tool.builtin) {
    if (!made) return fail('Pick two different points.');
    const v = made[0];
    if (ELIST.some((e) => !e.internal && e.kind === v.kind && sameDrawn(VALS.get(e.id), v))) {
      return fail(`That ${v.seg ? 'segment' : v.kind} is already drawn.`);
    }
    const kinds = tool.outs.map((o) => o.kind);
    commit(() => mint({ op: tool.id, ins: makePicks(picks) }, kinds, ['']));
    return;
  }
  if (!made || made.some((v) => !v)) {
    return fail(
      `${tool.name} doesn't work on those inputs: some of its intersections don't exist there.`,
    );
  }
  commit(() => {
    const label = labeler();
    const kinds = tool.outs.map((o) => o.kind);
    const labels = kinds.map((kind) => (kind === 'point' ? label() : ''));
    mint({ op: 'tool', tool: tool.id, ins: makePicks(picks) }, kinds, labels);
  });
}

// Picks an object for the step of the definition panel that's open, or drops it if it's picked.
function toggleDef(id) {
  const d = ui.def;
  const picks = d[DEF_PICKS[d.stage]];
  const i = picks.indexOf(id);
  const other = defStages().find(
    (st) => st !== d.stage && DEF_PICKS[st] && d[DEF_PICKS[st]].includes(id),
  );
  if (i >= 0) {
    picks.splice(i, 1);
  } else if (other) {
    toast(`${nameOf(doc, id)} is already ${defRole(other)}.`);
    return;
  } else {
    picks.push(id);
  }
  d.error = '';
  renderKit();
  renderPrompt();
  draw();
}
