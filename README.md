# Euclid's Toolkit

Compass-and-straightedge constructions in the browser, where any construction can become a tool you
use in the next one.

**Try it: https://euclid-toolkit.web.app**

- **Lessons** are sequences of problems. Solve one and save your solution as a tool for the problems
  that follow. Five lessons come with the app: Euclid's classic constructions, triangle centers,
  arithmetic with lengths, compass only (Mohr–Mascheroni), and straightedge with one circle
  (Poncelet–Steiner).
- **Notebooks** are blank diagrams sharing a toolbox, for building whatever you like. A notebook's
  diagrams can be marked as exercises and exported as a lesson of your own, to share as a file.
- Diagrams and problems carry text in Markdown, with math in TeX.

Everything runs in the browser and is saved there, in local storage. There's no server and no
account.

## About this project

This is an entirely AI-coded project: all of its code was written by AI. I'm not accepting pull
requests, but feel free to open issues.

## Running it locally

The site is static files in `site/`, with no build step. The page fetches its lessons, so it has to
be served, not opened as a file:

```
python serve.py
```

and open http://localhost:8000/.

## Development

You'll need Node and Python 3. To set up:

```
npm install
pip install playwright black pyflakes
playwright install chromium
```

To run the tests, `python run_tests.py`, or name suites to run just those:
`python run_tests.py engine text`. There are two kinds:

- `tests/engine_test.js` tests the construction engine in Node.
- `tests/*.py` drive the app in headless Chromium, one feature per file.

To format and lint: `npm run format` and `black .`, then `npm run lint`.

## How it's organized

- `site/index.html` and `site/style.css`: the page.
- `site/js/engine/`: constructions, tools, problems and lessons, independent of the page.
  - A construction is a graph of steps: points, lines, circles, intersections, and uses of tools.
  - What it draws depends only on where its free points are.
- `site/js/ui/`: the page, one module per part. `site/js/main.js` starts it.
- `site/lessons/`: the lessons that come with the app, as JSON. `index.json` lists them in order.
  - To change a lesson, open its file as a notebook in the app (Import a notebook), edit it, export
    it as a lesson, download it, and save it over the original.
  - To add a lesson, add its file and its name in `index.json`.
- `tests/`: the test suites, and `harness.py`, which they share.
