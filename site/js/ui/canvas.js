// Pointer input on the canvas: a press is a click (see onClick), or, moved, drags a point or pans
// the view; two fingers pinch to zoom, and so does the wheel.
import { consumers, downstream, evalNode } from '../engine/construction.js';
import { isPt, onCirclePt, onLinePt, placeOn, pt } from '../engine/geometry.js';
import { draw } from './draw.js';
import { computeHover, draggable, hitPoint } from './hit.js';
import { renderKit } from './kit.js';
import { curTool, endTool, onClick } from './picking.js';
import { renderAll, renderPrompt } from './render.js';
import { ORDER, VALS, afterChange, doc, pushUndo, refreshDragged, shown } from './sheet.js';
import { ui } from './state.js';
import { H, W, cv, toWorld, view, zoomAt } from './view.js';
import { dismiss } from './widgets.js';

// The pointers down on the canvas, a press that may become a click or a drag, a two-finger pinch,
// and a point being dragged.
const pointers = new Map();
let press = null;
let pinch = null;
export let drag = null;

// Where an event is on the canvas, in CSS pixels.
const local = (e) => {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

export function initCanvas() {
  cv.addEventListener('pointerdown', onPointerDown);
  cv.addEventListener('pointermove', onPointerMove);
  cv.addEventListener('pointerup', (e) => finishPointer(e, false));
  cv.addEventListener('pointercancel', (e) => finishPointer(e, true));
  cv.addEventListener('pointerleave', () => {
    if (press) return;
    ui.hover = null;
    ui.mouse = null;
    draw();
  });
  cv.addEventListener('wheel', onWheel, { passive: false });
}

function onWheel(e) {
  e.preventDefault();
  const [sx, sy] = local(e);
  zoomAt(sx, sy, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
}

function onPointerDown(e) {
  if (e.button > 0) return;
  if (dismiss()) renderAll();
  cv.setPointerCapture(e.pointerId);
  const [sx, sy] = local(e);
  pointers.set(e.pointerId, [sx, sy]);
  if (pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    pinch = {
      d: Math.hypot(p[0] - q[0], p[1] - q[1]) || 1,
      mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
      s: view.s,
      cx: view.cx,
      cy: view.cy,
    };
    if (drag) endDrag();
    press = null;
    return;
  }
  // Pressing on a movable point and moving drags it, putting down any armed tool. A press without
  // movement is a click.
  const touch = e.pointerType === 'touch';
  const tol = touch ? 22 : 12;
  const h = hitPoint(sx, sy, tol);
  press = {
    sx,
    sy,
    moved: false,
    el: h && draggable(h) ? h : null,
    v0: { cx: view.cx, cy: view.cy },
    tol,
    thresh: touch ? 10 : 5,
  };
}

function onPointerMove(e) {
  const [sx, sy] = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [sx, sy]);
  if (pinch && pointers.size === 2) {
    pinchTo(...pointers.values());
    return;
  }
  if (press) {
    if (!press.moved && Math.hypot(sx - press.sx, sy - press.sy) > press.thresh) {
      press.moved = true;
      if (press.el) startDrag(press.el);
    }
    if (!press.moved) return;
    if (drag) {
      dragTo(sx, sy);
    } else {
      view.cx = press.v0.cx - (sx - press.sx) / view.s;
      view.cy = press.v0.cy - (sy - press.sy) / view.s;
      draw();
    }
    return;
  }
  ui.mouse = toWorld(sx, sy);
  ui.hover = computeHover(sx, sy, e.pointerType === 'touch' ? 22 : 12);
  let cursor = 'crosshair';
  if (!ui.def && !curTool()) cursor = !ui.hover ? 'default' : ui.hover.drag ? 'grab' : 'pointer';
  cv.style.cursor = cursor;
  draw();
}

// Zooms with two fingers, keeping the point between them where it was when they went down.
function pinchTo(p, q) {
  const d = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const wx = (pinch.mid[0] - W / 2) / pinch.s + pinch.cx;
  const wy = (pinch.mid[1] - H / 2) / pinch.s + pinch.cy;
  view.s = Math.min(60, Math.max(0.05, (pinch.s * d) / pinch.d));
  view.cx = wx - (mid[0] - W / 2) / view.s;
  view.cy = wy - (mid[1] - H / 2) / view.s;
  draw();
}

function finishPointer(e, cancelled) {
  pointers.delete(e.pointerId);
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    press = null;
    return;
  }
  if (!press) return;
  const p = press;
  press = null;
  if (p.moved) {
    if (drag) endDrag();
  } else if (!cancelled) {
    const [sx, sy] = local(e);
    onClick(sx, sy, p.tol, e.shiftKey || e.metaKey || e.ctrlKey);
  }
}

// Dragging recomputes only the nodes built on the one being moved. A hidden free point comes along,
// moved by as much as the dragged point is, when all it's used for is lines and circles built from
// just the two of them (the point a given circle about O goes through, say): those then keep their
// size and direction, the least they can change.
function followers(node) {
  const x = node.outs[0];
  const cons = consumers(doc);
  const free = (h) => (h.op === 'fixed' ? isPt(h.val) : h.op === 'point' && !h.ins.length);
  const drawnFrom = (m, e) =>
    ['line', 'segment', 'circle'].includes(m.op) && m.ins.includes(x) && m.ins.includes(e);
  return Object.values(doc.nodes).filter((h) => {
    const e = doc.elems[h.outs[0]];
    if (h === node || !free(h) || shown(e)) return false;
    const uses = (cons.get(e.id) || []).map((id) => doc.nodes[id]);
    return uses.length > 0 && uses.every((m) => drawnFrom(m, e.id));
  });
}

const freeAt = (h) => (h.op === 'fixed' ? h.val : pt(h.x, h.y));

function startDrag(e) {
  if (endTool()) {
    renderKit();
    renderPrompt();
  }
  pushUndo();
  const node = doc.nodes[e.node];
  const follow = followers(node);
  const down = downstream(doc, [node.id, ...follow.map((h) => h.id)]);
  drag = {
    node,
    from: VALS.get(e.id),
    follow: follow.map((h) => [h, freeAt(h)]),
    down: ORDER.filter((n) => down.has(n.id)),
  };
}

// Moves the dragged point to (sx, sy): a free point there, a point on a line or circle as near as
// it can be on it; and its followers by as much.
function dragTo(sx, sy) {
  const n = drag.node;
  const [wx, wy] = toWorld(sx, sy);
  const c = n.ins.length ? VALS.get(n.ins[0]) : null;
  let p;
  if (n.op === 'fixed' || !n.ins.length) {
    if (n.op === 'fixed') n.val = pt(wx, wy);
    else Object.assign(n, { x: wx, y: wy });
    p = freeAt(n);
  } else if (c?.kind === 'line') {
    n.t = placeOn(c, wx, wy);
    p = onLinePt(c, n.t);
  } else if (c) {
    n.a = Math.atan2(wy - c.cy, wx - c.cx);
    p = onCirclePt(c, n.a);
  } else {
    p = drag.from;
  }
  for (const [h, h0] of drag.follow) {
    const q = pt(h0.x + p.x - drag.from.x, h0.y + p.y - drag.from.y);
    if (h.op === 'fixed') h.val = q;
    else Object.assign(h, { x: q.x, y: q.y });
  }
  for (const m of drag.down) evalNode(m, VALS, {});
  refreshDragged();
  draw();
}

function endDrag() {
  drag = null;
  afterChange();
}
