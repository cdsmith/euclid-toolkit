// What's at a place on the canvas (screen coordinates sx, sy, within tol pixels): the nearest shown
// point, picked point, candidate intersection or curve, and what the pointer is over.
import { curveDist, isPt } from '../engine/geometry.js';
import { curTool } from './picking.js';
import { CANDS, ELIST, VALS, doc, sheet, shown } from './sheet.js';
import { ui } from './state.js';
import { toScreen, toWorld, view } from './view.js';

// The nearest of some things within tol of (sx, sy), by their distance on screen.
function nearest(things, distance, tol) {
  let best = null;
  let bd = tol;
  for (const thing of things) {
    const d = distance(thing);
    if (d < bd) {
      bd = d;
      best = thing;
    }
  }
  return best;
}

const screenDist = (sx, sy, p) => {
  const [x, y] = toScreen(p.x, p.y);
  return Math.hypot(x - sx, y - sy);
};

export function hitPoint(sx, sy, tol) {
  const points = ELIST.filter((e) => shown(e) && e.kind === 'point' && VALS.get(e.id));
  return nearest(points, (e) => screenDist(sx, sy, VALS.get(e.id)), tol);
}

// A picked point that doesn't exist yet.
export function hitPick(sx, sy, tol) {
  const picks = ui.pending.filter((p) => !p.id && p.value.kind === 'point');
  return nearest(picks, (p) => screenDist(sx, sy, p.value), tol);
}

export function hitCand(sx, sy, tol) {
  return nearest(CANDS, (cd) => screenDist(sx, sy, cd.p), tol);
}

// The nearest shown line or circle (of this kind, if given).
export function hitCurve(sx, sy, tol, kind) {
  const [wx, wy] = toWorld(sx, sy);
  const curves = ELIST.filter(
    (e) => shown(e) && e.kind !== 'point' && (!kind || e.kind === kind) && VALS.get(e.id),
  );
  return nearest(curves, (e) => curveDist(VALS.get(e.id), wx, wy) * view.s, tol);
}

// Free points can be dragged, and points on a line or circle, along it.
export function draggable(e) {
  if (!shown(e)) return false;
  const n = doc.nodes[e.node];
  return n.op === 'point' || (n.op === 'fixed' && isPt(n.val));
}

// What the pointer is over, as what to highlight: { obj } (an element, and whether it can be
// dragged), { pick } (a picked point not made yet) or { cand } (a candidate intersection). What
// counts depends on what's going on: defining a tool, dragging a lesson's diagram, picking for the
// armed tool, or nothing in particular.
export function computeHover(sx, sy, tol) {
  if (ui.def) {
    if (ui.def.stage === 'name') return null;
    const o = hitPoint(sx, sy, tol) || hitCurve(sx, sy, tol * 0.8);
    return o ? { obj: o.id } : null;
  }
  if (sheet.kind === 'diagram') {
    const o = hitPoint(sx, sy, tol);
    return o && draggable(o) ? { obj: o.id, drag: true } : null;
  }
  const tool = curTool();
  if (!tool) {
    const o = hitPoint(sx, sy, tol);
    if (o) return { obj: o.id, drag: draggable(o) };
    const cu = hitCurve(sx, sy, tol * 0.8);
    return cu ? { obj: cu.id } : null;
  }
  const slot = tool.ins[ui.pending.length];
  if (tool.id !== 'point' && slot.kind !== 'point') {
    const cu = hitCurve(sx, sy, tol, slot.kind);
    return cu ? { obj: cu.id } : null;
  }
  const o = hitPoint(sx, sy, tol);
  if (o) return { obj: o.id };
  const pick = hitPick(sx, sy, tol);
  if (pick) return { pick };
  const cand = hitCand(sx, sy, tol);
  if (cand) return { cand };
  const cu = hitCurve(sx, sy, tol * 0.75);
  return cu ? { obj: cu.id } : null;
}
