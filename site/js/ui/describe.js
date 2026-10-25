// Tools and their steps, in words: a tool's signature ("A, B → line"), its recipe, and what it
// needs of its inputs.
import { TOOLS, graphNames, order } from '../engine/construction.js';
import { esc } from './dom.js';

const math = (s) => `<span class="m">${esc(s)}</span>`;

// What a tool takes and makes: its inputs' names, and its outputs' names (points) or kinds.
export function sigHTML(t) {
  const ins = t.ins.length
    ? t.ins.map((x) => math(x.label)).join(', ')
    : '<span class="kw">anywhere</span>';
  const outs = t.outs.map((x) =>
    x.kind === 'point' ? math(x.label) : `<span class="kw">${x.word || x.kind}</span>`,
  );
  return `${ins} → ${outs.join(', ')}`;
}

// One step of a tool, in words: name(id) names an element, made(id) the one the step makes.
export function stepHTML(n, name, made = name) {
  const [a, b, c] = n.ins.map(name);
  const out = made(n.outs[0]);
  switch (n.op) {
    case 'line':
      return `${out}: line through ${a}, ${b}`;
    case 'segment':
      return `${out}: segment from ${a} to ${b}`;
    case 'circle':
      return `${out}: circle at ${a} through ${b}`;
    case 'isect':
      return `${out}: where ${a} meets ${b}${c ? `, other than ${c}` : ''}`;
    case 'point':
      return `<span class="free">${out}: arbitrary point${a ? ' on ' + a : ''}</span>`;
    case 'tool': {
      const tool = `<span class="tool">${esc(TOOLS.get(n.tool).name)}</span>`;
      return `${n.outs.map(made).join(', ')}: ${tool}(${n.ins.map(name).join(', ')})`;
    }
  }
  return '';
}

// What tool t needs of input k besides its kind, in words: "the center of ω", "on ℓ", and, said of
// a line or circle, "centered at O", "through P". own: only what's said of a point itself.
// name(i) names input i.
export function relWords(t, k, own = false, name = (i) => math(t.ins[i].label)) {
  const x = t.ins[k];
  const words = [
    ...(x.center || []).map((j) => `the center of ${name(j)}`),
    ...(x.on || []).map((j) => `on ${name(j)}`),
  ];
  if (!own) {
    t.ins.forEach((y, i) => {
      if ((y.center || []).includes(k)) words.push(`centered at ${name(i)}`);
      if ((y.on || []).includes(k)) words.push(`through ${name(i)}`);
    });
  }
  return words;
}

// What tool t needs of its inputs, as sentences ("P is on ℓ.").
export function relSentences(t, name) {
  return t.ins
    .map((x, i) => {
      const words = relWords(t, i, true, name);
      return words.length ? `${name(i)} is ${words.join(' and ')}.` : '';
    })
    .filter(Boolean);
}

// A tool's recipe: what it needs of its inputs, then its steps, its outputs marked.
export function recipeHTML(t) {
  if (t.builtin) return t.recipe;
  const g = t.graph;
  const names = graphNames(g);
  const outs = new Set(t.outIds);
  const name = (id) => `<i>${esc(names.get(id))}</i>`;
  const made = (id) => (outs.has(id) ? `<span class="out">${esc(names.get(id))}</span>` : name(id));
  const relations = relSentences(t, (i) => name(t.inIds[i])).map(
    (x) => `<li class="rel">${x}</li>`,
  );
  const steps = order(g)
    .filter((n) => n.op !== 'input')
    .map((n) => `<li>${stepHTML(n, name, made)}</li>`);
  return relations.join('') + steps.join('');
}
