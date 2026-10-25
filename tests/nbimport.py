# A lesson file opened as a notebook: sections, exercises with their solutions, other diagrams with
# their text, tools (hidden ones hidden), all under new ids; the setup behind givens comes in
# hidden. It exports again.
import os, json
from harness import URL, check, run, saved_state, saved_work, serve_libs, watch


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    await serve_libs(ctx)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(300)
    S = lambda: saved_state(pg)
    work = lambda i: saved_work(pg, i)
    toast = lambda: pg.locator('.toast').last.inner_text()

    # ---- Straightedge Only, downloaded, opened as a notebook
    await pg.click('[data-act=card-open][data-id=straightedge]')
    await pg.wait_for_timeout(150)
    async with pg.expect_download() as dl:
        await pg.click('[data-act=lesson-download]')
    d = await dl.value
    path = os.path.abspath('se-download.json')
    await d.save_as(path)
    L = json.load(open(path))
    await pg.set_input_files('#notebookFile', path)
    await pg.wait_for_timeout(300)
    s = await S()
    nb = s['notebooks'][0] if s['notebooks'] else {}
    secs = [q['name'] for q in nb.get('diagrams', []) if q.get('section')]
    dgs = [q for q in nb.get('diagrams', []) if not q.get('section')]
    check(
        nb.get('name') == 'Straightedge Only'
        and secs == L['tiers']
        and [q['name'] for q in dgs] == [it['title'] for it in L['items']],
        'the lesson comes in as a notebook, with its sections and items: ' + str(secs),
    )
    check(
        [bool(q.get('exercise')) for q in dgs] == [it['kind'] == 'problem' for it in L['items']]
        and all(q['id'] not in [it['id'] for it in L['items']] for q in dgs),
        'its problems are exercises, under new ids',
    )
    ex = next(q for q in dgs if q['name'] == 'Parallel')
    it = next(i for i in L['items'] if i['title'] == 'Parallel')
    check(
        ex['text'] == it['text']
        and '::: Hint' in ex['text']
        and 'hints' not in ex['exercise']
        and ex['exercise']['givens'] == it['givens'],
        'with their text, hints in it, and givens',
    )
    dd = next(q for q in dgs if q['name'] == 'One Circle')
    di = next(i for i in L['items'] if i['title'] == 'One Circle')
    check(
        dd.get('text') == di['text'] and 'exercise' not in dd, 'its other diagrams keep their text'
    )
    check(
        s['toolboxes'][nb['id']] == L['toolbox'],
        "and the lesson's toolbox: " + str(s['toolboxes'][nb['id']]),
    )
    check((await toast()).startswith('Made the notebook'), 'it says so: ' + await toast())
    g = await work(ex['id'])
    hidden = [e for e in g['elems'].values() if e.get('hidden')]
    check(
        len(hidden) >= 1
        and all(not e.get('label') for e in hidden)
        and not any(e.get('internal') for e in g['elems'].values()),
        'the setup behind the givens is hidden, not out of reach',
    )
    check(len(g['nodes']) == len(it['diagram']['nodes']), 'the exercise has its solution')
    # it exports again
    await pg.click('[data-act=notebook-export]')
    await pg.wait_for_timeout(80)
    form = await pg.locator('#exportForm').inner_text()
    check(
        not await pg.locator('#exportForm [type=submit]').is_disabled()
        and 'needs fixing' not in form,
        'every exercise is sound, so it exports: ' + form.split('\n')[0],
    )
    await pg.click('#exportForm [type=submit]')
    await pg.wait_for_timeout(200)
    s = await S()
    check(
        len(s['lessons']) == 1
        and len([i for i in s['lessons'][0]['items'] if i['kind'] == 'problem'])
        == len([i for i in L['items'] if i['kind'] == 'problem']),
        'as a new lesson with the same problems',
    )

    # ---- a lesson with tools: the one Midpoint uses comes in out of sight
    await pg.set_input_files('#notebookFile', os.path.abspath('deps-lesson.json'))
    await pg.wait_for_timeout(300)
    s = await S()
    nb = s['notebooks'][-1]
    DL = json.load(open('deps-lesson.json'))
    mine = [t for t in s['tools'] if t['box'] == nb['id']]
    mid = next((t for t in mine if t['name'] == 'Midpoint'), None)
    pb = next((t for t in mine if t['name'] == 'Perpendicular bisector'), None)
    check(
        len(mine) == 2
        and mid
        and pb
        and s['toolboxes'][nb['id']] == DL['toolbox'][:3] + [mid['id']],
        "its tools come along, the bisector out of sight: " + str(s['toolboxes'][nb['id']]),
    )
    check(
        [n['tool'] for n in mid['graph']['nodes'].values() if n['op'] == 'tool'] == [pb['id']],
        "and Midpoint uses the notebook's bisector",
    )
    check(
        await pg.locator('#tools .tname').all_inner_texts()
        == ['Point', 'Line', 'Circle', 'Midpoint'],
        'its toolbox shows: ' + str(await pg.locator('#tools .tname').all_inner_texts()),
    )

    # ---- not a lesson
    bad = os.path.abspath('bad-lesson.json')
    json.dump({'id': 'x', 'title': 'Nope'}, open(bad, 'w'))
    n0 = len((await S())['notebooks'])
    await pg.set_input_files('#notebookFile', bad)
    await pg.wait_for_timeout(150)
    check(
        await toast() == "That file isn't a lesson." and len((await S())['notebooks']) == n0,
        'a file that is not a lesson is refused, and nothing changes',
    )
    await pg.screenshot(path='nbimport.png')


run(main)
