# Tools that use other tools: they keep the use, and wherever they go (imported, or into a lesson),
# the tools they use come along out of sight. A tool can't be used in itself.
import os, json, copy
from harness import URL, check, import_groups, run, saved_state, seed, serve_libs, settle, watch

pb, mid = json.load(
    open('deps-tools.json')
)  # made by mkdeps.js: Midpoint uses Perpendicular bisector
pbg = dict(copy.deepcopy(pb), id='tPBg', box='nb3')


def equilateral():
    n = lambda i, op, ins, **kw: dict(id=f'n{i}', op=op, ins=ins, outs=[f'e{i}'], seq=i, **kw)
    e = lambda i, kind, label='': dict(id=f'e{i}', node=f'n{i}', kind=kind, label=label)
    return {
        'nodes': {
            'n1': n(1, 'point', [], x=-70, y=30),
            'n2': n(2, 'point', [], x=70, y=30),
            'n3': n(3, 'circle', ['e1', 'e2']),
            'n4': n(4, 'circle', ['e2', 'e1']),
            'n5': n(5, 'isect', ['e3', 'e4'], which=1),
        },
        'elems': {
            'e1': e(1, 'point', 'A'),
            'e2': e(2, 'point', 'B'),
            'e3': e(3, 'circle'),
            'e4': e(4, 'circle'),
            'e5': e(5, 'point', 'C'),
        },
        'seq': 5,
        'texts': [],
    }


ex = {
    'givens': ['e1', 'e2'],
    'scaffold': [],
    'goals': ['e5'],
    'elaboration': [],
    'toolName': 'Apex',
}
state = {
    'solved': {},
    'tools': [pb, mid, pbg],
    'lessons': [],
    # Alpha shows Midpoint but not the Perpendicular bisector it uses; Gamma has a bisector built
    # the same way
    'toolboxes': {
        'nb1': ['point', 'line', 'circle', 'tMid'],
        'nb2': ['point', 'line', 'circle'],
        'nb3': ['point', 'tPBg'],
    },
    'notebooks': [
        {'id': 'nb1', 'name': 'Alpha', 'diagrams': [{'id': 'dgW', 'name': 'Apex', 'exercise': ex}]},
        {'id': 'nb2', 'name': 'Beta', 'diagrams': [{'id': 'dgB', 'name': 'Diagram 1'}]},
        {'id': 'nb3', 'name': 'Gamma', 'diagrams': [{'id': 'dgG', 'name': 'Diagram 1'}]},
    ],
}
work = {'dgW': equilateral()}


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    await serve_libs(ctx)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await seed(pg, state, work)
    S = lambda: saved_state(pg)
    tools = lambda: pg.locator('#tools .tname').all_inner_texts()
    rows = lambda: pg.locator('#log li .txt').all_inner_texts()
    groups = lambda: import_groups(pg)

    # ---- Alpha: Midpoint works, though the bisector it uses isn't shown
    await pg.click('[data-act=card-open][data-id=nb1]')
    await settle(pg)
    check(
        await tools() == ['Point', 'Line', 'Circle', 'Midpoint'],
        'Alpha shows Midpoint only: ' + str(await tools()),
    )
    await pg.click('[data-act=tool-more][data-id=tMid]')
    await settle(pg)
    recipe = await pg.locator('.tdetail .recipe').inner_text()
    check(
        'Perpendicular bisector(' in recipe,
        'its recipe uses the bisector: ' + recipe.replace('\n', ' | '),
    )
    await pg.click('[data-act=tool-more][data-id=tMid]')

    # ---- Beta: importing Midpoint brings the bisector along, out of sight
    await pg.click('[data-act=card-open][data-id=nb2]')
    await settle(pg)
    await pg.click('[data-act=tool-import]')
    await settle(pg)
    g = await groups()
    check(
        'Alpha: Midpoint' in g and 'Gamma: Perpendicular bisector' in g,
        'Alpha offers Midpoint, Gamma its bisector: ' + str(g),
    )
    await pg.click('[data-act=tool-import-pick][data-id=tMid]')
    await settle(pg)
    s = await S()
    mine = [t for t in s['tools'] if t['box'] == 'nb2']
    mc = next((t for t in mine if t['name'] == 'Midpoint'), None)
    pc = next((t for t in mine if t['name'] == 'Perpendicular bisector'), None)
    uses = [n['tool'] for n in mc['graph']['nodes'].values() if n['op'] == 'tool'] if mc else []
    check(
        len(mine) == 2 and mc and pc and uses == [pc['id']],
        'Midpoint and the bisector it uses are copied in, the copy using the copy',
    )
    check(
        s['toolboxes']['nb2'] == ['point', 'line', 'circle', mc['id']]
        and await tools() == ['Point', 'Line', 'Circle', 'Midpoint'],
        'only Midpoint is shown: ' + str(await tools()),
    )
    st = await pg.locator('#stage').bounding_box()
    at = lambda x, y: (st['x'] + x, st['y'] + y)
    await pg.keyboard.press('4')
    await pg.mouse.click(*at(300, 300))
    await pg.mouse.click(*at(500, 300))
    await settle(pg)
    r = await rows()
    check(any(x.startswith('Midpoint(') for x in r), 'and it works there: ' + str(r))
    await pg.keyboard.press('Escape')
    await pg.locator('#log li:not(.inside) >> nth=2 >> [data-act=row-detail]').click()
    await settle(pg)
    inner = await pg.locator('#log li.inside .txt').all_inner_texts()
    check(
        len(inner) == 3 and inner[0].startswith('ℓ₁: Perpendicular bisector('),
        "how it's built shows the bisector as one step: " + str(inner),
    )
    step = lambda k, m: pg.locator(f'#log li.inside >> nth={k} >> [data-act=step-{m}]')
    modes = lambda: pg.evaluate(
        """[...document.querySelectorAll('#log li.inside')].map(
            (li) =>
              ['show', 'hide', 'detail']
                .filter((m) => li.querySelector(`[data-act=step-${m}][aria-pressed=true]`))
                .join() + (li.querySelector('[data-act=step-detail]') ? '+' : ''),
          )"""
    )
    check(
        await modes() == ['show+', 'show', 'show'],
        'each step has Show and Hide, and the bisector step a detail button too: '
        + str(await modes()),
    )
    await step(0, 'detail').click()
    await settle(pg)
    inner = await pg.locator('#log li.inside .txt').all_inner_texts()
    deep = await pg.evaluate(
        """[...document.querySelectorAll('#log li.inside')].map((li) =>
            li.style.getPropertyValue('--d'),
          )"""
    )
    check(
        len(inner) == 8
        and inner[0].startswith('ℓ₁: Perpendicular bisector(')
        and 'circle at' in inner[1]
        and deep == ['0', '1', '1', '1', '1', '1', '0', '0'],
        'opening it shows its five steps under it: ' + str(list(zip(deep, inner))),
    )
    check((await modes())[0] == 'detail+', 'and its detail button shows it open')
    await pg.screenshot(path='deps-inside.png')
    await step(1, 'hide').click()
    await settle(pg)
    check(
        (await modes())[1] == 'hide'
        and 'is-hidden' in await pg.locator('#log li.inside >> nth=1').get_attribute('class'),
        'a step can be hidden',
    )
    await step(0, 'hide').click()
    await settle(pg)
    check(await modes() == ['hide+', 'show', 'show'], 'hiding the bisector step closes it')
    s2 = await S()
    w = await pg.evaluate(
        """Object.keys(localStorage)
            .filter((k) => k.startsWith('euclid-toolkit:work:'))
            .map((k) => localStorage.getItem(k))
            .join()"""
    )
    check('"open"' not in w and 'step' not in json.dumps(s2), "none of that is saved")
    await pg.keyboard.press('Control+z')
    await settle(pg)
    check(
        await pg.locator('#log li.inside').count() == 0,
        "or undone: Undo takes back the use's own detail",
    )

    # ---- importing the bisector too shows the copy that's there, rather than copying it again
    await pg.click('[data-act=tool-import]')
    await settle(pg)
    g = await groups()
    check(
        not any(x.startswith('Alpha') for x in g),
        "a tool built the same way as one that's shown isn't offered: " + str(g),
    )
    await pg.click('[data-act=tool-import-pick][data-id=tPBg]')
    await settle(pg)
    s = await S()
    check(
        len([t for t in s['tools'] if t['box'] == 'nb2']) == 2
        and s['toolboxes']['nb2'][-1] == pc['id'],
        'importing the bisector shows the copy already there',
    )
    await pg.click('[data-act=form-cancel]')

    # ---- a tool can't be used in itself, directly or not
    await pg.click(f'[data-act=tool-more][data-id="{mc["id"]}"]')
    await pg.click(f'[data-act=tool-edit][data-id="{mc["id"]}"]')
    await settle(pg)
    t = await tools()
    check(
        'Midpoint' not in t and 'Perpendicular bisector' in t,
        'editing Midpoint, it is not in the toolbox: ' + str(t),
    )
    r = await rows()
    check(
        any(x.startswith('Perpendicular bisector(') for x in r),
        'and its construction keeps the bisector as one step: ' + str(r),
    )
    await pg.click('[data-act=edit-cancel]')
    await settle(pg)

    # ---- into a lesson: the bisector comes along, out of sight
    await pg.click('[data-act=card-open][data-id=nb1]')
    await settle(pg)
    await pg.click('[data-act=notebook-export]')
    await settle(pg)
    await pg.fill('#lessonBlurb', 'One.')
    await pg.click('#exportForm [type=submit]')
    await settle(pg)
    s = await S()
    L = s['lessons'][0]
    lt = {t['name']: t for t in L['tools']}
    check(
        [t['name'] for t in L['tools']] == ['Perpendicular bisector', 'Midpoint']
        and L['toolbox'] == ['point', 'line', 'circle', lt['Midpoint']['id']],
        'the lesson has both tools, the bisector first and not shown',
    )
    check(
        [n['tool'] for n in lt['Midpoint']['graph']['nodes'].values() if n['op'] == 'tool']
        == [lt['Perpendicular bisector']['id']],
        "the lesson's Midpoint uses the lesson's bisector",
    )
    await pg.click(f"[data-act=card-open][data-id={L['id']}]")
    await settle(pg)
    await pg.click(f"[data-act=sheet-open][data-id='{L['id']}.dgW']")
    await settle(pg)
    check(
        await tools() == ['Point', 'Line', 'Circle', 'Midpoint'],
        "the lesson's problem shows Midpoint only: " + str(await tools()),
    )
    # download, delete, import back; broken files are refused
    async with pg.expect_download() as dl:
        await pg.click('[data-act=lesson-download]')
    d = await dl.value
    path = os.path.abspath('deps-lesson.json')
    await d.save_as(path)
    await pg.click('[data-act=lesson-delete]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    bad = os.path.abspath('deps-bad.json')
    swapped = json.load(open(path))
    swapped['tools'].reverse()
    json.dump(swapped, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await settle(pg)
    check((await S())['lessons'] == [], 'a lesson whose tool uses one listed after it is refused')
    missing = json.load(open(path))
    missing['tools'] = missing['tools'][1:]
    json.dump(missing, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await settle(pg)
    check((await S())['lessons'] == [], 'and one whose tool uses one it lacks')
    await pg.set_input_files('#lessonFile', path)
    await settle(pg)
    s = await S()
    check(
        len(s['lessons']) == 1 and len(s['lessons'][0]['tools']) == 2,
        'the downloaded lesson imports',
    )
    await pg.click(f"[data-act=sheet-open][data-id='{L['id']}.dgW']")
    await settle(pg)
    await pg.click(f'[data-act=tool-use][data-id="{lt["Midpoint"]["id"]}"]')
    check(
        await pg.locator('#prompt').is_visible(), "the imported lesson's Midpoint can be picked up"
    )


run(main)
