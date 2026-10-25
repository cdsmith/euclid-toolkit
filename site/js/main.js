// Starts the app: loads the lessons that come with it, then what's saved in this browser, and opens
// the start page. If the lessons can't be fetched, the page says so, and goes no further.
import { loadLessons } from './engine/lessons.js';
import { initCanvas } from './ui/canvas.js';
import { $ } from './ui/dom.js';
import { draw } from './ui/draw.js';
import { openSheet } from './ui/sheet.js';
import { loadState } from './ui/state.js';
import { measure } from './ui/view.js';

async function start() {
  try {
    await loadLessons(async (name) => {
      const r = await fetch(`lessons/${name}.json`);
      if (!r.ok) throw new Error(`lessons/${name}.json: ${r.status}`);
      return r.json();
    });
  } catch (e) {
    console.error(e);
    const home = $('#home');
    $('#app').classList.add('is-home');
    home.innerHTML =
      '<div class="home-inner"><h1>The lessons didn’t load</h1>' +
      '<p class="lead">Check your connection, then reload the page.</p></div>';
    home.hidden = false;
    return;
  }
  loadState();
  initCanvas();
  openSheet('home');
  new ResizeObserver(() => {
    measure();
    draw();
  }).observe($('#stage'));
  document.fonts.ready.then(draw);
}

start();
