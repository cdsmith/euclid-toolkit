// The toolkit beside the sheet: what's selected, the panel for defining a tool, the toolbox, and
// the construction log. A lesson's diagram has no tools or steps to show, only a word on what you
// can do with it.
import { renderDef } from './definepanel.js';
import { $ } from './dom.js';
import { renderLog } from './log.js';
import { renderSel } from './selection.js';
import { sheet } from './sheet.js';
import { renderTools } from './toollist.js';

export function renderKit() {
  const look = sheet.kind === 'diagram';
  $('#toolSec').hidden = $('#logSec').hidden = look;
  $('#lookSec').hidden = !look;
  renderSel();
  renderDef();
  if (!look) {
    renderTools();
    renderLog();
  }
}
