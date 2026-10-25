# Euclid's Toolkit

A compass-and-straightedge construction web site. You build constructions, define your own tools from them, keep
notebooks of diagrams, and work through lessons of problems that earn tools. It runs entirely in the browser: state
is in localStorage, and the only outside requests are marked and KaTeX from jsdelivr and fonts from Google.

## Layout

- `site/`: the site, served as it is; there's no build step.
  - `index.html`: the page's markup. `style.css`: its styles.
  - `js/`: the app, as ES modules. `main.js` starts it. The code is heavily commented; read the comments by a
    function before changing it.
    - `js/engine/`: constructions, tools, problems and lessons, with nothing about the page, so the tests run it in
      Node: `geometry.js`, `construction.js` (graphs, evaluating, running tools, names), `tools.js` (defining
      tools, exercises), `problems.js`, `lessons.js`.
    - `js/ui/`: the page, one module per part (`sheet.js` holds the sheet on view and its construction, `state.js`
      what's saved and the UI state, `draw.js` the canvas, `actions.js` what buttons and keys do, and so on). Each
      module's state is changed only by that module; others call its functions (e.g. `replaceDoc`).
    - HTML is built with the `html` tag from `ui/dom.js`: it drops line breaks next to tags, so markup can be laid
      out over lines without adding space between elements. Escape text with `esc`.
  - `lessons/index.json`: the names of the built-in lessons, in the order they're listed. Each is in
    `lessons/<name>.json`, and gets its name as its id. To add one, add its file and its name here.
  - `lessons/<name>.json`: the built-in lessons. **These are the source of truth.** Lessons are edited in the app
    (open a lesson file as a notebook, edit, export, download); save an edited lesson over `site/lessons/<name>.json`.
- `serve.py`: serves `site/`. Run it and open http://localhost:8000/ to use the app locally (a page opened as a file
  can't fetch its lessons).
- `run_tests.py`: runs every suite, all at once (so suites mustn't share files).
  `python run_tests.py engine text scaffold` runs just those.
- `tests/engine_test.js`: engine tests in Node (constructions, tools, problems, lessons). It imports the engine from
  `tests/engine.js`, which loads the lessons from `site/lessons/`.
- `tests/*.py`: browser suites (Playwright, headless Chromium), one file each, built on `tests/harness.py`:
  `run(main)`, `check()`, `open_page()` (a fresh page on a local `serve.py` server, with marked and KaTeX served
  from `node_modules`), `seed()`, `saved_state()` and `settle()`. Suites write their screenshots and files in
  `tests/`.
- After input, wait with `settle()` (the app has started, and two frames have passed), not a fixed time: the app
  responds to input at once. Wait a fixed time only for what's timed (a fade, a toast going away).
- `tests/solvedwork.js` + `tests/revealshot.py`: screenshots of solved problems (to look at elaborations).

## Setup

- Node, and Python with Playwright: `pip install playwright`, then `playwright install chromium`.
- `npm install`: Prettier and ESLint, and the marked and KaTeX the page loads (same versions as `index.html`),
  served to the tests in place of the CDN.
- Formatting: `npm run format` (Prettier, 100 columns) and `black .` for Python (settings in `pyproject.toml`);
  `npm run lint` (ESLint). Keep lines within 100 columns, comments included.
- On Windows, Python needs UTF-8: `run_tests.py` sets `PYTHONUTF8=1`; set it yourself to run a suite directly.

## Deploying

- The site is on Firebase Hosting, project `euclid-toolkit`: https://euclid-toolkit.web.app. `firebase.json` serves
  `site/` as it is, with `Cache-Control: no-cache` so a deploy shows up on the next load.
- CI (`.github/workflows/ci.yml`) runs lint, format checks and every test on each push and pull request, and
  deploys to Firebase when they pass on `main`, with the `github-deploy` service account (its key is the repo secret
  `FIREBASE_SERVICE_ACCOUNT`). By hand: `npx firebase-tools deploy --only hosting`.

## Tests

- Everything should pass before and after a change. Add or update a suite for new behavior.
- The lesson suites (`arithmetic.py`, `compass.py`, `straightedge.py`, `triangle.py`, and the lesson checks in
  `engine_test.js`) check the shipped lessons' content. When a lesson is edited, update those tests to the new content;
  never change a lesson back to satisfy a test.
- Tests click at computed screen positions; after layout changes, re-measure (`#stage` bounding box) rather than
  hard-coding.
- For any visible change, take a screenshot and look at it (light and dark; phone width too for layout).

## The model, briefly

- A construction is a DAG of nodes (`fixed`, `input`, `point` free or on a curve, `line`, `segment`, `circle`,
  `isect`, `tool`) making elements (`kind`, `label`, `hidden`, `internal`, `style`). What it draws depends only on
  where its free points are: constructions are stateless.
- A tool is a saved construction with inputs and outputs. Tools keep their uses of other tools (no flattening on
  save); a tool's dependencies come along into the same toolbox, hidden unless listed. Inputs carry relations
  (`on`: a point on an input curve; `center`), inferred when defined and enforced when picked.
- An exercise / problem marks elements of a diagram as **givens** (the earned tool's inputs), **scaffold**
  (construction built from the givens alone, shown from the start, the student may build on it), **goals** (what
  the student constructs; the tool's outputs) and **elaboration** (built from the givens alone, drawn once solved,
  never part of the student's construction). The scaffold may not be built from a goal.
- A diagram's text, under its title, is Markdown with TeX (`$…$`, `$$…$$`). `::: Title` … `:::` makes a fold with
  that title (`::: Hint` for hints).
- localStorage: `euclid-toolkit:state` (notebooks, lessons, tools, solved), `euclid-toolkit:work:<id>` (a sheet's
  construction), `euclid-toolkit:ui`.

## Design rules

- For now, while there are no users: no backward compatibility, migrations or old-format handling. Breaking saved
  notebooks or downloaded files is fine. This will change once people use the site.
- Constructions stay stateless.
- No "secret tools": a lesson uses only what a lesson author could make in the editor.
- UI text: succinct and plain. Explanatory text only when it's key; no text explaining the app's rules. Prefer the
  simple, obvious thing to anything wordy or clever (e.g. no "Another hint" labels).
