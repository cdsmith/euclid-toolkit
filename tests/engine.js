// The app's engine, for engine_test.js and the scripts here: its modules, with the lessons that
// come with the app read from site/lessons/ (in a browser, the page fetches them).
import fs from 'node:fs';
import path from 'node:path';
import { loadLessons } from '../site/js/engine/lessons.js';

const dir = path.join(import.meta.dirname, '..', 'site', 'lessons');

await loadLessons((name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8')));

export * from '../site/js/engine/geometry.js';

export * from '../site/js/engine/construction.js';

export * from '../site/js/engine/tools.js';

export * from '../site/js/engine/problems.js';

export * from '../site/js/engine/lessons.js';
