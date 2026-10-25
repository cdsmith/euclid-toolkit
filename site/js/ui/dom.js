// Small helpers for building the page.

export const $ = (s) => document.querySelector(s);

// Text made safe to put in HTML.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

export const pad2 = (n) => String(n).padStart(2, '0');

// HTML from a template laid out over lines, as in JSX: a line break, with the spaces around it,
// goes where it's next to a tag or a ${} (so it adds no space between elements), and is a single
// space anywhere else (between words, or between a tag's attributes). Values go in as they are.
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s.replace(/\s*\n\s*/g, (m, at) => {
      const before = s[at - 1];
      const after = s[at + m.length];
      return before === undefined || after === undefined || before === '>' || after === '<'
        ? ''
        : ' ';
    });
    if (i < values.length) out += values[i];
  });
  return out;
}
