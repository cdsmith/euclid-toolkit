// Solved work for every problem: its sheet, with the author's solution on it, out of sight but for
// the goals.
import fs from 'node:fs';
import * as E from './engine.js';

const out = {};

const upstream = (g, ids) => {
  const seen = new Set();
  const visit = (e) => {
    const n = g.nodes[g.elems[e].node];
    if (!seen.has(n.id)) {
      seen.add(n.id);
      n.ins.forEach(visit);
    }
  };
  ids.forEach(visit);
  return seen;
};

for (const L of E.LESSONS)
  for (const p of L.items) {
    if (p.kind !== 'problem') continue;
    const sheet = E.problemSheet(p);
    for (const id of upstream(p.diagram, p.goals))
      if (!sheet.nodes[id]) {
        sheet.nodes[id] = structuredClone(p.diagram.nodes[id]);
        for (const e of sheet.nodes[id].outs)
          sheet.elems[e] = Object.assign(
            structuredClone(p.diagram.elems[e]),
            p.goals.includes(e) ? {} : { internal: true },
          );
      }
    out[p.id] = sheet;
  }

fs.writeFileSync(import.meta.dirname + '/all-solved.json', JSON.stringify(out));
