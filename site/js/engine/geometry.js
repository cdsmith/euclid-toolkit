// Points, lines and circles, and where they meet.
//
// Values are points { kind: 'point', x, y }, lines through two points { kind: 'line', x1, y1, x2,
// y2 } (with seg for a segment: the line, drawn only between those points), and circles { kind:
// 'circle', cx, cy, r }.

// How close two values must be to count as the same. Drawings are hundreds of units across.
export const GEPS = 1e-4;

export const TAU = Math.PI * 2;

export const pt = (x, y) => ({ kind: 'point', x, y });

export const mkLine = (a, b, seg) =>
  Object.assign({ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, seg ? { seg } : {});

export const mkCircle = (c, r) => ({ kind: 'circle', cx: c.x, cy: c.y, r });

export const isPt = (v) => !!v && v.kind === 'point';

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// line ∩ line
function iLL(a, b) {
  const d1x = a.x2 - a.x1;
  const d1y = a.y2 - a.y1;
  const d2x = b.x2 - b.x1;
  const d2y = b.y2 - b.y1;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-10 * Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) return [];
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
  return [pt(a.x1 + t * d1x, a.y1 + t * d1y)];
}

// line ∩ circle, ordered along the line's direction (first defining point toward the second)
function iLC(l, c) {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const t0 = (c.cx - l.x1) * ux + (c.cy - l.y1) * uy;
  const fx = l.x1 + t0 * ux;
  const fy = l.y1 + t0 * uy;
  const h2 = c.r * c.r - ((c.cx - fx) ** 2 + (c.cy - fy) ** 2);
  if (h2 < -1e-9 * c.r * c.r) return [];
  const h = Math.sqrt(Math.max(0, h2));
  return [pt(fx - h * ux, fy - h * uy), pt(fx + h * ux, fy + h * uy)];
}

// circle ∩ circle: index 0 lies to the left of the ray from the first center to the second
function iCC(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12 * (a.r + b.r)) return [];
  const m = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const R = Math.max(a.r, b.r);
  const h2 = a.r * a.r - m * m;
  if (h2 < -1e-9 * R * R) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const bx = a.cx + (m * dx) / d;
  const by = a.cy + (m * dy) / d;
  const nx = -dy / d;
  const ny = dx / d;
  return [pt(bx + h * nx, by + h * ny), pt(bx - h * nx, by - h * ny)];
}

// Where two curves meet: no points, one (lines), or two (which may coincide, where they touch).
export function isectAll(a, b) {
  if (!a || !b || a.kind === 'point' || b.kind === 'point') return [];
  if (a.kind === 'line' && b.kind === 'line') return iLL(a, b);
  if (a.kind === 'line') return iLC(a, b);
  if (b.kind === 'line') return iLC(b, a);
  return iCC(a, b);
}

// Two curves alone can't tell their intersections apart in a way that survives reflection
// (reflecting across the line of centers swaps them and fixes both curves). So an intersection is
// recorded relative to the construction: as the one other than a point X that's already there,
// which holds under every rigid motion, or, where nothing tells the two apart, by its index in
// isectAll (handedness).
export function otherIsect(a, b, x) {
  const r = isectAll(a, b);
  if (!r.length || !x) return null;
  return r.length === 1 || dist(r[0], x) >= dist(r[1], x) ? r[0] : r[1];
}

// Whether two values are the same point, circle or line (a line through any two of its points).
export function same(a, b, eps = GEPS) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'point') return Math.hypot(a.x - b.x, a.y - b.y) < eps;
  if (a.kind === 'circle')
    return Math.hypot(a.cx - b.cx, a.cy - b.cy) < eps && Math.abs(a.r - b.r) < eps;
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const n = Math.hypot(dx, dy);
  const ex = b.x2 - b.x1;
  const ey = b.y2 - b.y1;
  const m = Math.hypot(ex, ey);
  if (Math.abs(dx * ey - dy * ex) / (n * m) > 1e-6) return false;
  return Math.abs((b.x1 - a.x1) * dy - (b.y1 - a.y1) * dx) / n < eps;
}

// Whether two values draw the same thing: as same, but segments are the same only with the same
// ends.
export function sameDrawn(a, b) {
  if (!a || !b || !!a.seg !== !!b.seg) return false;
  if (!a.seg) return same(a, b);
  const P = (v) => [pt(v.x1, v.y1), pt(v.x2, v.y2)];
  const [a1, a2] = P(a);
  const [b1, b2] = P(b);
  return (same(a1, b1) && same(a2, b2)) || (same(a1, b2) && same(a2, b1));
}

// The point at t along a line (0 at its first defining point, 1 at its second), and at angle a
// around a circle.
export const onLinePt = (l, t) => pt(l.x1 + t * (l.x2 - l.x1), l.y1 + t * (l.y2 - l.y1));

export const onCirclePt = (c, a) => pt(c.cx + c.r * Math.cos(a), c.cy + c.r * Math.sin(a));

// Where along a line the point nearest (x, y) is, as for onLinePt.
export function lineParam(l, x, y) {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  return ((x - l.x1) * dx + (y - l.y1) * dy) / (dx * dx + dy * dy);
}

// Where on a line or segment a point at (x, y) goes: a segment's points stay between its ends.
export const placeOn = (l, x, y) =>
  l.seg ? Math.max(0, Math.min(1, lineParam(l, x, y))) : lineParam(l, x, y);

// Whether point p, on curve v's line, is on what's drawn of it.
export const onDrawn = (v, p) => {
  if (!v.seg) return true;
  const t = lineParam(v, p.x, p.y) * Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
  return t > -GEPS && t < Math.hypot(v.x2 - v.x1, v.y2 - v.y1) + GEPS;
};

// How far (x, y) is from a line, segment or circle.
export function curveDist(v, x, y) {
  if (v.kind === 'line') {
    const dx = v.x2 - v.x1;
    const dy = v.y2 - v.y1;
    if (v.seg) {
      const t = Math.max(0, Math.min(1, lineParam(v, x, y)));
      return Math.hypot(x - v.x1 - t * dx, y - v.y1 - t * dy);
    }
    return Math.abs((x - v.x1) * dy - (y - v.y1) * dx) / Math.hypot(dx, dy);
  }
  return Math.abs(Math.hypot(x - v.cx, y - v.cy) - v.r);
}

// A similarity frame built from a tool's inputs, so arbitrary points inside a tool
// land in the same relative place wherever the tool is used.
export function frameOf(vals) {
  const an = [];
  let rad = 0;
  for (const v of vals) {
    if (v.kind === 'point') an.push([v.x, v.y]);
    else if (v.kind === 'line') {
      an.push([v.x1, v.y1]);
      an.push([v.x2, v.y2]);
    } else {
      an.push([v.cx, v.cy]);
      if (!rad) rad = v.r;
    }
  }
  const o = an[0];
  let ex = null;
  for (let i = 1; i < an.length; i++) {
    const vx = an[i][0] - o[0];
    const vy = an[i][1] - o[1];
    if (Math.hypot(vx, vy) > 1e-9) {
      ex = [vx, vy];
      break;
    }
  }
  if (!ex) ex = [rad || 100, 0];
  return { ox: o[0], oy: o[1], ex, ey: [-ex[1], ex[0]], ang: Math.atan2(ex[1], ex[0]) };
}

// A point's coordinates (u, v) in a frame, and back.
export function toFrame(f, x, y) {
  const dx = x - f.ox;
  const dy = y - f.oy;
  const n2 = f.ex[0] ** 2 + f.ex[1] ** 2;
  return [(dx * f.ex[0] + dy * f.ex[1]) / n2, (dx * f.ey[0] + dy * f.ey[1]) / n2];
}

export const fromFrame = (f, u, v) =>
  pt(f.ox + u * f.ex[0] + v * f.ey[0], f.oy + u * f.ex[1] + v * f.ey[1]);
