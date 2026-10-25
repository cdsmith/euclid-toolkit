// Point, Line, Circle and Segment are built in: a toolbox can have them without anyone making them.
import { GEPS, dist, mkCircle, mkLine } from '../engine/geometry.js';

export const BUILTIN = [
  {
    id: 'point',
    name: 'Point',
    builtin: true,
    ins: [],
    outs: [{ kind: 'point', label: 'P' }],
    recipe: '<li><span class="out">P</span>: arbitrary point</li>',
  },
  {
    id: 'line',
    name: 'Line',
    builtin: true,
    ins: [
      { kind: 'point', label: 'A', ask: 'a point' },
      { kind: 'point', label: 'B', ask: 'a second point' },
    ],
    outs: [{ kind: 'line', label: 'ℓ' }],
    make: ([a, b]) => (dist(a, b) > GEPS ? mkLine(a, b) : null),
    recipe: '<li><span class="out">ℓ</span>: line through <i>A</i>, <i>B</i></li>',
  },
  {
    id: 'circle',
    name: 'Circle',
    builtin: true,
    ins: [
      { kind: 'point', label: 'O', ask: 'the center' },
      { kind: 'point', label: 'A', ask: 'a point on the circle' },
    ],
    outs: [{ kind: 'circle', label: 'ω' }],
    make: ([c, p]) => (dist(c, p) > GEPS ? mkCircle(c, dist(c, p)) : null),
    recipe: '<li><span class="out">ω</span>: circle at <i>O</i> through <i>A</i></li>',
  },
  {
    id: 'segment',
    name: 'Segment',
    builtin: true,
    ins: [
      { kind: 'point', label: 'A', ask: 'a point' },
      { kind: 'point', label: 'B', ask: 'the other end' },
    ],
    outs: [{ kind: 'line', label: 'ℓ', word: 'segment' }],
    make: ([a, b]) => (dist(a, b) > GEPS ? mkLine(a, b, true) : null),
    recipe: '<li><span class="out">ℓ</span>: segment from <i>A</i> to <i>B</i></li>',
  },
];

export const BUILTIN_BY = new Map(BUILTIN.map((t) => [t.id, t]));
