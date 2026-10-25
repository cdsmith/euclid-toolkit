// A lesson is a named, ordered list of items grouped into tiers (each item's tier indexes the
// lesson's tiers; a tier may be unnamed), with the tools its toolbox starts with (toolbox: ids of
// built-in tools and of its own tools, which it carries in tools, saved in its box). An item is a
// problem or a diagram (its kind), with an id, a title, a subtitle, a text (Markdown, with its
// hints; see textHTML) and a diagram. A problem's diagram is a construction with givens, scaffold,
// goals and elaboration (see problems.js), and a problem names the tool its solution makes, which
// takes its givens and makes its goals. A lesson's diagram is there to look at and drag. Solved
// problems and saved work are stored by item id, so ids must be unique across all lessons. Lessons
// made from notebooks have the same form as the ones that come with the app.

// The lessons that come with the app; every lesson: those and the ones you've made or been given
// (see indexLessons); and every item in every lesson, as the sheet you work it on or look at: like
// every sheet it knows its kind and toolbox, and its lesson.
export let APP_LESSONS = [];

export let LESSONS = [];

export let ITEMS = [];

// The lessons that come with the app are in lessons/, next to the page: lessons/index.json lists
// their names in order, and each is in lessons/<name>.json, with its name as its id. read(name)
// gets a file's contents, or a promise of them: the page fetches them, and the tests read them from
// disk.
export async function loadLessons(read) {
  const names = await read('index');
  const lessons = await Promise.all(names.map(read));
  APP_LESSONS = lessons.map((L, i) => Object.assign(L, { id: names[i] }));
  indexLessons();
}

export function indexLessons(more = []) {
  LESSONS = [...APP_LESSONS, ...more];
  ITEMS = LESSONS.flatMap((L) =>
    L.items.map((it) => Object.assign({}, it, { box: L.id, lesson: L })),
  );
}

export const problemsOf = (L) => L.items.filter((it) => it.kind === 'problem');
