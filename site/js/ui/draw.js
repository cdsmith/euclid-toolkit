// Drawing the sheet: the grid, the goal, the construction and its labels, the insides of tool uses
// shown in detail, the preview of the armed tool, points to pick, and badges saying what's what.
// Each layer is drawn over the ones before, in the order draw() calls them.
import { TOOLS, order, toolInsides } from '../engine/construction.js';
import { TAU, isPt, onCirclePt, onLinePt, placeOn, pt } from '../engine/geometry.js';
import { defWords } from './definepanel.js';
import { stepMode } from './log.js';
import { applyTool, curTool } from './picking.js';
import {
  CANDS,
  ELIST,
  GOAL,
  INSIDE,
  VALS,
  doc,
  editOuts,
  isGiven,
  roleOf,
  sheet,
} from './sheet.js';
import { diagramOf, ui } from './state.js';
import { COL, DASH, H, W, WEIGHT, ctx, dpr, goalCanvas, toScreen, toWorld, view } from './view.js';

const LABEL_FONT = 'italic 16px "STIX Two Text", "Times New Roman", serif';

export function draw() {
  if (!W || !H) return;
  const c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = COL.paper;
  c.fillRect(0, 0, W, H);
  drawGrid(c);
  if (!doc) return;
  const matched = new Set(GOAL.ids.filter(Boolean));
  if (ui.showGoal && GOAL.targets && !GOAL.solved) drawGoal(c);
  drawCurves(c, matched);
  if (GOAL.after.length) drawElaboration(c);
  drawInsides(c);
  const tool = curTool();
  if (tool && tool.ins.length && ui.mouse) drawPreview(c, tool);
  drawCurveLabels(c);
  drawCandidates(c);
  drawPoints(c, matched);
  drawPicks(c);
  drawBadges(c, tool);
}

// A line's ends on screen: a segment's own, or a line's far enough off screen either way.
function lineEnds(v) {
  if (v.seg) return [toScreen(v.x1, v.y1), toScreen(v.x2, v.y2)];
  const dx = v.x2 - v.x1;
  const dy = v.y2 - v.y1;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const t = (view.cx - v.x1) * ux + (view.cy - v.y1) * uy;
  const fx = v.x1 + t * ux;
  const fy = v.y1 + t * uy;
  const R = Math.hypot(W, H) / view.s + 10;
  return [toScreen(fx - ux * R, fy - uy * R), toScreen(fx + ux * R, fy + uy * R)];
}

// The stretch of a line that's on screen (for labels and badges), or null.
function lineOnScreen(v) {
  const [a, b] = lineEnds(v);
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // Liang–Barsky clipping, to the canvas less a margin
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  const m = 6;
  const inside =
    clip(-dx, a[0] - m) && clip(dx, W - m - a[0]) && clip(-dy, a[1] - m) && clip(dy, H - m - a[1]);
  if (!inside) return null;
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

// A point part of the way along a line's stretch on screen.
const alongLine = (seg, f) => [
  seg[0][0] + (seg[1][0] - seg[0][0]) * f,
  seg[0][1] + (seg[1][1] - seg[0][1]) * f,
];

function strokeCurve(c, v) {
  c.beginPath();
  if (v.kind === 'line') {
    const [a, b] = lineEnds(v);
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
  } else {
    const [x, y] = toScreen(v.cx, v.cy);
    const r = v.r * view.s;
    if (r > 2e5) return;
    c.arc(x, y, r, 0, TAU);
  }
  c.stroke();
}

function dot(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

// Text with a band of paper color around it, so it reads over lines.
function outlinedText(c, text, x, y) {
  c.lineWidth = 4;
  c.strokeStyle = COL.paper;
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
}

// Where a line's or circle's label goes: near the end of a line's stretch on screen, or up and to
// the right on a circle. Null if it's off screen.
function curveLabelAt(v) {
  if (v.kind === 'line') {
    const seg = lineOnScreen(v);
    if (!seg) return null;
    const [x, y] = alongLine(seg, 0.9);
    return [x, y - 10];
  }
  const [x, y] = toScreen(v.cx + v.r * Math.cos(-0.8), v.cy + v.r * Math.sin(-0.8));
  return [x + 6, y - 6];
}

// Grid lines a round number of units apart, about 24 pixels or more, with every fifth darker.
function drawGrid(c) {
  const raw = 24 / view.s;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m < 2 ? 2 : m < 5 ? 5 : 10) * p;
  const [x0, y0] = toWorld(0, 0);
  const [x1, y1] = toWorld(W, H);
  const minor = new Path2D();
  const major = new Path2D();
  for (let i = Math.floor(x0 / step); i <= Math.ceil(x1 / step); i++) {
    const sx = Math.round(toScreen(i * step, 0)[0]) + 0.5;
    const path = i % 5 === 0 ? major : minor;
    path.moveTo(sx, 0);
    path.lineTo(sx, H);
  }
  for (let i = Math.floor(y0 / step); i <= Math.ceil(y1 / step); i++) {
    const sy = Math.round(toScreen(0, i * step)[1]) + 0.5;
    const path = i % 5 === 0 ? major : minor;
    path.moveTo(0, sy);
    path.lineTo(W, sy);
  }
  c.lineWidth = 1;
  c.strokeStyle = COL.grid;
  c.stroke(minor);
  c.strokeStyle = COL['grid-major'];
  c.stroke(major);
}

// The goal: a soft blur around each goal, a place to aim for rather than something drawn. The
// goals are drawn on a canvas of their own (with a margin, so they don't fade at the sheet's
// edges), which goes down off to the side, so only its blurred shadow lands here.
function drawGoal(c) {
  const m = 40;
  const gc = goalCanvas;
  const g = gc.getContext('2d');
  gc.width = Math.ceil((W + 2 * m) * dpr);
  gc.height = Math.ceil((H + 2 * m) * dpr);
  g.setTransform(dpr, 0, 0, dpr, m * dpr, m * dpr);
  g.strokeStyle = g.fillStyle = COL.goal;
  g.lineWidth = 18;
  for (const t of GOAL.targets.filter(Boolean)) {
    if (t.kind === 'point') dot(g, ...toScreen(t.x, t.y), 18);
    else strokeCurve(g, t);
  }
  const off = gc.width + 100;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.shadowOffsetX = off;
  c.shadowColor = COL.goal;
  c.shadowBlur = 16 * dpr;
  c.globalAlpha = 0.3;
  c.drawImage(gc, -off - m * dpr, -m * dpr);
  c.restore();
}

// The halo around what's selected, pointed at, or picked.
function haloFor(id) {
  if (ui.sel.includes(id)) return COL['sel-in'];
  if (ui.logHi?.includes(id)) return COL.hover;
  if (ui.logIn?.includes(id)) return COL['sel-in'];
  if (ui.def) {
    if (ui.def.ins.includes(id) || ui.def.scaffold.includes(id)) return COL['sel-in'];
    if (ui.def.outs.includes(id) || ui.def.after.includes(id)) return COL['sel-out'];
  }
  if (ui.pending.some((p) => p.id === id)) return COL['sel-in'];
  if (ui.hover?.obj === id) return COL.hover;
  return null;
}

// Hidden elements are drawn faintly while selected or pointed at in the list.
const drawable = (e) =>
  !e.internal &&
  (!e.hidden || ui.sel.includes(e.id) || [ui.logHi, ui.logIn].some((l) => l?.includes(e.id)));

// Lines and circles: in their own color, or green where they match a goal, black if given and
// blue if constructed.
function drawCurves(c, matched) {
  for (const e of ELIST) {
    if (e.kind === 'point' || !drawable(e)) continue;
    const v = VALS.get(e.id);
    if (!v) continue;
    c.save();
    if (e.hidden) c.globalAlpha = 0.35;
    const halo = haloFor(e.id);
    if (halo) {
      c.strokeStyle = halo;
      c.lineWidth = 8;
      strokeCurve(c, v);
    }
    const ok = matched.has(e.id);
    const st = e.style || {};
    const given = roleOf(e) === 'given';
    let color = given ? COL.ink : COL.blue;
    if (ok) color = COL.ok;
    if (st.color) color = COL['c-' + st.color];
    c.strokeStyle = color;
    c.lineWidth = (ok ? 2.4 : given ? 1.6 : 1.4) * (WEIGHT[st.weight] || 1);
    c.setLineDash(DASH[st.dash] || []);
    c.lineCap = st.dash === 'dotted' ? 'round' : 'butt';
    strokeCurve(c, v);
    c.restore();
  }
}

// A solved problem's elaboration, fading in when it's just been solved: in its own style, green
// unless colored.
let revealFrame = 0;
function drawElaboration(c) {
  const alpha = Math.min(1, (performance.now() - ui.revealAt) / 700);
  if (alpha < 1 && !revealFrame) {
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      draw();
    });
  }
  c.save();
  c.globalAlpha = alpha;
  c.font = LABEL_FONT;
  for (const { e, v } of GOAL.after) {
    const st = e.style || {};
    c.strokeStyle = c.fillStyle = st.color ? COL['c-' + st.color] : COL.ok;
    if (v.kind === 'point') {
      dot(c, ...toScreen(v.x, v.y), 3.9);
    } else {
      c.lineWidth = 1.6 * (WEIGHT[st.weight] || 1);
      c.setLineDash(DASH[st.dash] || []);
      strokeCurve(c, v);
      c.setLineDash([]);
    }
    if (!e.label) continue;
    let at;
    if (v.kind === 'point') {
      const [x, y] = toScreen(v.x, v.y);
      at = [x + 7, y - 7];
    } else {
      at = curveLabelAt(v);
      if (!at) continue;
    }
    outlinedText(c, e.label, ...at);
  }
  c.restore();
}

// The insides of tool uses shown in detail, faint and dashed (points filled, unlike the rings of
// candidate intersections), but not what's made only by hidden steps.
function drawInsides(c) {
  for (const { steps, vals } of INSIDE.values()) {
    const shown = new Set(steps.filter((n) => stepMode(n.id) !== 'hide').flatMap((n) => n.outs));
    for (const e of shown) {
      const v = vals.get(e);
      if (doc.elems[e] || !v) continue;
      let halo = null;
      if (ui.logHi?.includes(e)) halo = COL.hover;
      else if (ui.logIn?.includes(e)) halo = COL['sel-in'];
      c.save();
      c.strokeStyle = COL['ink-3'];
      c.lineWidth = 1.1;
      if (v.kind === 'point') {
        const [x, y] = toScreen(v.x, v.y);
        if (halo) {
          c.fillStyle = halo;
          dot(c, x, y, 10);
        }
        c.fillStyle = COL['ink-3'];
        dot(c, x, y, 2.3);
      } else {
        if (halo) {
          c.save();
          c.strokeStyle = halo;
          c.lineWidth = 8;
          strokeCurve(c, v);
          c.restore();
        }
        c.setLineDash([4, 4]);
        strokeCurve(c, v);
      }
      c.restore();
    }
  }
}

// What's under the mouse, as the armed tool's next input: the point there, or one on the line or
// circle there, or the line or circle itself; null if it's not something the tool takes there.
function nextInput(tool) {
  const slot = tool.ins[ui.pending.length];
  const hv = ui.hover?.obj ? VALS.get(ui.hover.obj) : null;
  const [mx, my] = ui.mouse;
  if (slot.kind !== 'point') return hv?.kind === slot.kind ? hv : null;
  if (isPt(hv)) return hv;
  if (ui.hover?.pick) return ui.hover.pick.value;
  if (ui.hover?.cand) return ui.hover.cand.p;
  if (hv?.kind === 'line') return onLinePt(hv, placeOn(hv, mx, my));
  if (hv?.kind === 'circle') return onCirclePt(hv, Math.atan2(my - hv.cy, mx - hv.cx));
  return pt(mx, my);
}

// Preview, with whatever is under the mouse as the next input: what a saved tool makes inside,
// faint and dashed, as far as the inputs so far settle it; and once that's the last input, what
// the tool makes.
function drawPreview(c, tool) {
  const next = nextInput(tool);
  const inputs = [...ui.pending.map((p) => p.value), next];
  if (!tool.builtin) {
    const vals = toolInsides(tool, inputs);
    c.save();
    c.strokeStyle = c.fillStyle = COL['ink-3'];
    c.globalAlpha = 0.28;
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    for (const n of order(tool.graph)) {
      if (n.op === 'input') continue;
      for (const e of n.outs) {
        const v = vals.get(e);
        if (!v || tool.outIds.includes(e)) continue;
        if (v.kind === 'point') dot(c, ...toScreen(v.x, v.y), 2.3);
        else strokeCurve(c, v);
      }
    }
    c.restore();
  }
  const last = next && inputs.length === tool.ins.length;
  const made = last ? applyTool(tool, inputs) : null;
  if (!made) return;
  c.save();
  c.strokeStyle = COL.blue;
  c.globalAlpha = 0.6;
  c.lineWidth = 1.2;
  for (const v of made.filter(Boolean)) {
    if (v.kind === 'point') {
      const [x, y] = toScreen(v.x, v.y);
      c.save();
      c.globalAlpha = 0.9;
      c.lineWidth = 1.6;
      c.setLineDash([3, 2.5]);
      c.beginPath();
      c.arc(x, y, 7.5, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = COL.blue;
      dot(c, x, y, 2.4);
      c.restore();
    } else {
      c.setLineDash([5, 5]);
      strokeCurve(c, v);
    }
  }
  c.restore();
}

function drawCurveLabels(c) {
  c.font = LABEL_FONT;
  for (const e of ELIST) {
    if (e.kind === 'point' || !drawable(e) || !e.label) continue;
    const v = VALS.get(e.id);
    const at = v && curveLabelAt(v);
    if (!at) continue;
    const color = e.style?.color;
    c.save();
    if (e.hidden) c.globalAlpha = 0.35;
    c.lineWidth = 4;
    c.strokeStyle = COL.paper;
    c.strokeText(e.label, ...at);
    c.fillStyle = color ? COL['c-' + color] : isGiven(e) ? COL.ink : COL['ink-2'];
    c.fillText(e.label, ...at);
    c.restore();
  }
}

// Where shown curves cross, as small rings, to be picked.
function drawCandidates(c) {
  c.lineWidth = 1;
  c.strokeStyle = COL['ink-3'];
  for (const cd of CANDS) {
    const [x, y] = toScreen(cd.p.x, cd.p.y);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    if (ui.hover?.cand === cd) {
      c.fillStyle = COL.hover;
      dot(c, x, y, 9);
    }
    c.beginPath();
    c.arc(x, y, 2.7, 0, TAU);
    c.stroke();
  }
}

// Points, with their labels: arbitrary points hollow, intersections a little smaller.
function drawPoints(c, matched) {
  for (const e of ELIST) {
    if (e.kind !== 'point' || !drawable(e)) continue;
    const v = VALS.get(e.id);
    if (!v) continue;
    const [x, y] = toScreen(v.x, v.y);
    const role = roleOf(e);
    c.save();
    if (e.hidden) c.globalAlpha = 0.35;
    const halo = haloFor(e.id);
    if (halo) {
      c.fillStyle = halo;
      dot(c, x, y, 10);
    }
    const ok = matched.has(e.id);
    const own = e.style?.color ? COL['c-' + e.style.color] : null;
    const color = own || (ok ? COL.ok : role === 'given' ? COL.ink : COL['ink-2']);
    c.beginPath();
    c.arc(x, y, ok ? 4.6 : role === 'isect' ? 3.2 : 3.9, 0, TAU);
    if (role === 'arb') {
      c.fillStyle = COL.paper;
      c.fill();
      c.lineWidth = 1.6;
      c.strokeStyle = own || (ok ? COL.ok : COL.ink);
      c.stroke();
    } else {
      c.fillStyle = color;
      c.fill();
    }
    if (e.label) {
      c.font =
        (role === 'given' ? '600 ' : '') + 'italic 15px "STIX Two Text", "Times New Roman", serif';
      c.lineWidth = 4;
      c.strokeStyle = COL.paper;
      c.strokeText(e.label, x + 7, y - 7);
      c.fillStyle = color;
      c.fillText(e.label, x + 7, y - 7);
    }
    c.restore();
  }
}

// Points picked for the armed tool that don't exist yet: made when the tool is used.
function drawPicks(c) {
  for (const p of ui.pending) {
    if (p.id) continue;
    const [x, y] = toScreen(p.value.x, p.value.y);
    c.fillStyle = ui.hover?.pick === p ? COL.hover : COL['sel-in'];
    dot(c, x, y, 10);
    c.beginPath();
    c.arc(x, y, p.cand ? 3.2 : 3.9, 0, TAU);
    if (p.cand) {
      c.fillStyle = COL['ink-2'];
      c.fill();
    } else {
      c.fillStyle = COL.paper;
      c.fill();
      c.lineWidth = 1.6;
      c.strokeStyle = COL.ink;
      c.stroke();
    }
  }
}

// Where a badge goes by an element: below and to the right of a point, along a line, atop a circle.
function badgeAt(id) {
  const v = VALS.get(id);
  if (!v) return null;
  if (v.kind === 'point') {
    const [x, y] = toScreen(v.x, v.y);
    return [x + 14, y + 14];
  }
  if (v.kind === 'line') {
    const seg = lineOnScreen(v);
    return seg && alongLine(seg, 0.3);
  }
  const [x, y] = toScreen(v.cx, v.cy - v.r);
  return [Math.min(W - 30, Math.max(30, x)), Math.min(H - 20, Math.max(20, y))];
}

function drawBadge(c, x, y, text, fill) {
  c.font = '600 11px Barlow, system-ui, sans-serif';
  const w = c.measureText(text).width + 12;
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x - w / 2, y - 9, w, 18, 3);
  c.fill();
  c.fillStyle = COL.paper;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y + 0.5);
  c.textAlign = 'start';
  c.textBaseline = 'alphabetic';
}

// Badges saying what's what: the inputs and outputs of a tool being defined or edited, the picks
// for the armed tool, or an exercise's givens, scaffold, goals and elaboration.
function drawBadges(c, tool) {
  const badge = (id, text, fill) => {
    const e = doc.elems[id];
    if (!e || !drawable(e)) return;
    const at = badgeAt(id);
    if (at) drawBadge(c, ...at, text, fill);
  };
  const exercise = sheet.kind === 'notebook' && diagramOf(sheet.id).p.exercise;
  if (ui.def) {
    const words = defWords();
    ui.def.ins.forEach((id, i) => badge(id, `${words.in} ${i + 1}`, COL.blue));
    ui.def.scaffold.forEach((id) => badge(id, 'scaffold', COL['ink-2']));
    ui.def.outs.forEach((id, i) => badge(id, `${words.out} ${i + 1}`, COL.accent));
    ui.def.after.forEach((id) => badge(id, 'elaboration', COL.ok));
  } else if (tool) {
    ui.pending.forEach((p, i) => {
      if (p.id) {
        badge(p.id, String(i + 1), COL.blue);
      } else {
        const [x, y] = toScreen(p.value.x, p.value.y);
        drawBadge(c, x + 14, y + 14, String(i + 1), COL.blue);
      }
    });
  } else if (sheet.kind === 'tool') {
    TOOLS.get(sheet.tool).inIds.forEach((id, i) => badge(id, 'in ' + (i + 1), COL.blue));
    editOuts().forEach((id, i) => badge(id, 'out ' + (i + 1), COL.accent));
  } else if (exercise) {
    exercise.givens.forEach((id, i) => badge(id, 'given ' + (i + 1), COL.blue));
    exercise.scaffold.forEach((id) => badge(id, 'scaffold', COL['ink-2']));
    exercise.goals.forEach((id, i) => badge(id, 'goal ' + (i + 1), COL.accent));
    exercise.elaboration.forEach((id) => badge(id, 'elaboration', COL.ok));
  }
}
