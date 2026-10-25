// The start page, shown when no lesson or notebook is open.
import { $, html } from './dom.js';

// The start page's backdrop: a compass rosette (six circles through a common center), the second
// ring of circles around it, the hexagon and hexagram they determine, and the three long diameters.
function homeArt() {
  const R = 100;
  const f = (n) => n.toFixed(2);
  const polar = (r, deg) => [
    r * Math.cos((deg * Math.PI) / 180),
    r * Math.sin((deg * Math.PI) / 180),
  ];
  const six = (fn, offset = 0) => [0, 1, 2, 3, 4, 5].map((k) => fn(offset + 60 * k));
  const out = [];
  const circle = ([x, y], r, cls) =>
    out.push(`<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`);
  const line = ([x1, y1], [x2, y2]) =>
    out.push(`<line class="l" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
  const polygon = (pts, cls) =>
    out.push(`<polygon class="${cls}" points="${pts.map((p) => p.map(f).join(',')).join(' ')}"/>`);

  [0, 60, 120].forEach((deg) => line(polar(420, deg), polar(420, deg + 180)));
  six((deg) => circle(polar(Math.sqrt(3) * R, deg), R, 'c f'), 30);
  six((deg) => circle(polar(R, deg), R, 'c'));
  circle([0, 0], R, 'c');
  circle([0, 0], 2 * R, 'c');
  circle([0, 0], Math.sqrt(3) * R, 'c d');
  const hexagon = six((deg) => polar(R, deg));
  const triangles = [0, 60].map((start) => [0, 120, 240].map((deg) => polar(2 * R, start + deg)));
  polygon(hexagon, 'o');
  triangles.forEach((t) => polygon(t, 'o'));
  circle([0, 0], 2.6, 'p');
  six((deg) => circle(polar(R, deg), 2.6, 'p'));
  six((deg) => circle(polar(Math.sqrt(3) * R, deg), 2.2, 'p'), 30);
  six((deg) => circle(polar(2 * R, deg), 2.2, 'p'));
  return html`
    <svg
      class="home-bg" viewBox="-390 -262 780 524" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true">${out.join('')}</svg>`;
}

export function renderHome() {
  $('#home').innerHTML = html`
    ${homeArt()}
    <div class="home-inner">
      <h1>Get started</h1>
      <p class="lead">
        Build constructions with compass and straightedge. Any construction can become a tool you
        use in the next one.
      </p>
      <div class="home-grid">
        <div class="home-opt">
          <h2>Work through a lesson</h2>
          <p>
            Pick one under <b>Lessons</b>. Its problems build on each other, and you can save each
            solution as a tool for the ones that follow.
          </p>
        </div>
        <div class="home-opt">
          <h2>Start a notebook</h2>
          <p>
            Use <b>New notebook</b> under <b>Notebooks</b>. A notebook is a set of blank diagrams
            sharing one toolbox, for building whatever you like.
          </p>
        </div>
      </div>
      <p class="note narrow-only">Lessons and notebooks are under <b>Menu</b>.</p>
    </div>`;
}
