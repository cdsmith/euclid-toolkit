// A diagram's text, and a problem's, is shown under its title. It's Markdown, with TeX between $…$
// ($$…$$ for a display), rendered with marked and KaTeX, or as plain text if those haven't loaded.
// HTML in it shows as text, and links go only to web pages, so a lesson file can't run anything.
//
// A line ::: and a title, then what's under the title until a line :::, makes a fold: folded away
// until it's opened. "::: Hint" makes a hint.
import { esc } from './dom.js';

const FOLD = /^::: *(\S.*?) *(?:\n|(?![\s\S]))([\s\S]*?)(?:\n::: *(?:\n|(?![\s\S]))|(?![\s\S]))/;

const foldHTML = (head, body) =>
  `<details class="fold"><summary>${head}</summary>` +
  `<div class="fold-body">${body}</div></details>\n`;

const mathHTML = (tex, display) =>
  katex.renderToString(tex, { displayMode: display, output: 'mathml', throwOnError: false });

const fold = {
  name: 'fold',
  level: 'block',
  start(src) {
    return /^::: *\S/m.exec(src)?.index;
  },
  tokenizer(src) {
    const m = FOLD.exec(src);
    if (!m) return undefined;
    const t = { type: 'fold', raw: m[0], head: [], tokens: [] };
    this.lexer.inline(m[1], t.head);
    this.lexer.blockTokens(m[2], t.tokens);
    return t;
  },
  renderer(t) {
    return foldHTML(this.parser.parseInline(t.head), this.parser.parse(t.tokens));
  },
};

const mathBlock = {
  name: 'mathBlock',
  level: 'block',
  start(src) {
    const i = src.indexOf('$$');
    return i < 0 ? undefined : i;
  },
  tokenizer(src) {
    const m = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(src);
    return m ? { type: 'mathBlock', raw: m[0], tex: m[1] } : undefined;
  },
  renderer: (t) => mathHTML(t.tex, true),
};

// Math in a line can't start or end with a space, or have a digit right after it, so "$5 and $10"
// is money.
const mathInline = {
  name: 'mathInline',
  level: 'inline',
  start(src) {
    const m = /(^|[^\\])\$/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(src) {
    const m =
      /^\$\$([^$]+?)\$\$/.exec(src) || /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
    if (!m) return undefined;
    return { type: 'mathInline', raw: m[0], tex: m[1], display: m[0].startsWith('$$') };
  },
  renderer: (t) => mathHTML(t.tex, t.display),
};

const safeLink = (href, title, text) =>
  /^(https?:|mailto:)/i.test(href || '')
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    : text;

const MARKDOWN =
  window.marked && window.katex
    ? new marked.Marked({ gfm: true, breaks: true, async: false }).use({
        extensions: [fold, mathBlock, mathInline],
        renderer: {
          html: (html) => esc(html),
          link: safeLink,
          image: (href, title, text) => esc(text || ''),
        },
      })
    : null;

// A line can break on either side of a formula, as on either side of a picture, so a formula is
// kept together with the punctuation touching it ("$Q$," shouldn't leave the comma to start a
// line).
const keepMath = (html) =>
  html.replace(
    /([^\s<>]*)(<span class="katex">[\s\S]*?<\/math><\/span>)([^\s<]*)/g,
    (m, pre, math, post) => (pre || post ? `<span class="nowrap">${m}</span>` : m),
  );

// Without marked and KaTeX, it's plain text in paragraphs, folds still folded.
const plainParas = (t) => {
  const text = esc(t.trim())
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return text ? `<p>${text}</p>` : '';
};
function plainHTML(src) {
  // split around folds: text, then each fold's title and body, and the text after it
  const parts = src.split(new RegExp(FOLD.source, 'm'));
  return parts
    .map((t, i) => {
      if (i % 3 === 0) return plainParas(t);
      if (i % 3 === 1) return foldHTML(esc(t), plainParas(parts[i + 1]));
      return '';
    })
    .join('');
}

const TEXT_HTML = new Map();
export function textHTML(src) {
  if (!TEXT_HTML.has(src)) {
    TEXT_HTML.set(src, MARKDOWN ? keepMath(MARKDOWN.parse(src)) : plainHTML(src));
  }
  return TEXT_HTML.get(src);
}
