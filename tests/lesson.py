import os, json
from harness import URL, check, run, saved_state, seed, watch


def equilateral(ax=-70):
    n = lambda i, op, ins, **kw: dict(id=f'n{i}', op=op, ins=ins, outs=[f'e{i}'], seq=i, **kw)
    e = lambda i, kind, label='': dict(id=f'e{i}', node=f'n{i}', kind=kind, label=label)
    return {
        'nodes': {
            'n1': n(1, 'point', [], x=ax, y=30),
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
same = {
    'id': 'tSame',
    'name': 'Same',
    'box': 'nb1',
    'ins': [{'kind': 'point', 'label': 'P'}],
    'outs': [{'kind': 'point', 'label': 'A'}],
    'graph': {
        'rel': True,
        'nodes': {
            'in0': {'id': 'in0', 'op': 'input', 'idx': 0, 'ins': [], 'outs': ['a'], 'seq': -1000}
        },
        'elems': {'a': {'id': 'a', 'node': 'in0', 'kind': 'point', 'label': 'P'}},
        'seq': 0,
    },
    'inIds': ['a'],
    'outIds': ['a'],
    'sample': [{'kind': 'point', 'x': 0, 'y': 0}],
}
state = {
    'solved': {},
    'tools': [same],
    'toolboxes': {'nb1': ['point', 'circle', 'tSame']},
    'lessons': [],
    'notebooks': [
        {
            'id': 'nb1',
            'name': 'Basics',
            'diagrams': [
                {'id': 'dgW', 'name': 'Warm-up', 'text': 'Find $C$.', 'exercise': ex},
                {'id': 'sc1', 'name': 'Triangles', 'section': True},
                {
                    'id': 'dgE',
                    'name': 'Equilateral',
                    'text': 'Make $ABC$ equilateral.',
                    'exercise': ex,
                },
                {'id': 'dgS', 'name': 'Scratch', 'text': 'Just *looking*.'},
                {'id': 'sc2', 'name': 'Empty', 'section': True},
            ],
        }
    ],
}
work = {
    'dgW': equilateral(),
    'dgE': equilateral(-60),
    'dgS': {'nodes': {}, 'elems': {}, 'seq': 0, 'texts': []},
}


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await seed(pg, state, work)
    S = lambda: saved_state(pg)
    await pg.click('[data-act=card-open][data-id=nb1]')
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('.diagram-row .ex-mark').count() == 2, 'two exercise diagrams are marked'
    )
    await pg.click('[data-act=notebook-export]')
    await pg.wait_for_timeout(80)
    form = await pg.locator('#exportForm').inner_text()
    check(
        'with 2 problems, 1 other diagram and 3 tools' in form
        and not await pg.locator('#exportForm [type=submit]').is_disabled(),
        'the form says what goes in: ' + form.split('\n')[0],
    )
    await pg.fill('#lessonBlurb', 'Two warm-ups.')
    await pg.locator('.card.is-open').screenshot(path='lesson-form.png')
    await pg.click('#exportForm [type=submit]')
    await pg.wait_for_timeout(150)
    s = await S()
    L = s['lessons'][0] if s['lessons'] else {}
    check(
        L.get('title') == 'Basics'
        and L.get('blurb') == 'Two warm-ups.'
        and L.get('tiers') == ['', 'Triangles']
        and [(q['kind'], q['id']) for q in L.get('items', [])]
        == [
            ('problem', L['id'] + '.dgW'),
            ('problem', L['id'] + '.dgE'),
            ('diagram', L['id'] + '.dgS'),
        ],
        'exported: ' + str({k: L.get(k) for k in ('title', 'blurb', 'tiers')}),
    )
    check(
        L.get('toolbox', [])[:2] == ['point', 'circle']
        and len(L.get('tools', [])) == 1
        and L['tools'][0]['box'] == L['id']
        and L['toolbox'][2] == L['tools'][0]['id'],
        "the notebook's toolbox comes along, its own tool copied in",
    )
    check(
        s['notebooks'][0].get('lessonId') == L.get('id')
        and await pg.locator('[data-act=notebook-export]').inner_text() == 'Update lesson',
        'the notebook remembers its lesson',
    )
    check('Made the lesson “Basics”' in await pg.locator('.toast').inner_text(), 'toast')
    # the lesson
    await pg.click(f"[data-act=card-open][data-id={L['id']}]")
    await pg.wait_for_timeout(150)
    card = await pg.locator('.card.is-open').inner_text()
    check(
        'TRIANGLES' in card.upper()
        and 'Warm-up' in card
        and 'Equilateral' in card
        and 'EMPTY' not in card.upper(),
        'the lesson lists its problems under their sections',
    )
    check(
        await pg.locator('.card.is-open .item.is-diagram').all_inner_texts() == ['◇\nScratch'],
        'and the diagram that is not an exercise, marked: '
        + str(await pg.locator('.card.is-open .item.is-diagram').all_inner_texts()),
    )
    check(
        await pg.locator('.card.is-open .tier h4').count() == 1,
        'the unnamed first section has no heading',
    )
    check(
        await pg.locator('.tname').all_inner_texts() == ['Point', 'Circle', 'Same'],
        'its toolbox: ' + str(await pg.locator('.tname').all_inner_texts()),
    )
    await pg.click(f"[data-act=tool-more][data-id='{L['tools'][0]['id']}']")
    await pg.wait_for_timeout(50)
    check(
        await pg.locator('[data-act=tool-edit]').count() == 0
        and await pg.locator('[data-act=tool-remove]').count() == 1,
        "the lesson's own tool can be removed, not edited",
    )
    tb = await pg.locator('#titleblock').inner_text()
    check(
        'Find' in tb
        and 'Not found yet' in tb
        and await pg.locator('#log li.empty-row').count() == 1,
        'its first problem opens with the givens alone',
    )
    await pg.screenshot(path='lesson-open.png')
    # re-export: new text keeps progress; a changed construction drops it
    await pg.evaluate(
        """() => {
            const s = JSON.parse(localStorage.getItem('euclid-toolkit:state'))
            s.solved = Object.fromEntries(
              s.lessons[0].items.filter((p) => p.kind === 'problem').map((p) => [p.id, true]),
            )
            localStorage.setItem('euclid-toolkit:state', JSON.stringify(s))
          }"""
    )
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.click('[data-act=card-open][data-id=nb1]')
    await pg.wait_for_timeout(100)
    await pg.click('.diagram-row [data-act=sheet-open][data-id=dgW]')
    await pg.wait_for_timeout(100)
    await pg.click('[data-act=write][data-id=text]')
    await pg.fill('#writeField', 'Find the apex $C$.')
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(50)
    await pg.evaluate(
        """() => {
            const k = 'euclid-toolkit:work:dgE',
              w = JSON.parse(localStorage.getItem(k))
            w.doc.nodes.n1.x = -50
            localStorage.setItem(k, JSON.stringify(w))
          }"""
    )
    await pg.click('[data-act=notebook-export]')
    await pg.click('#exportForm [type=submit]')
    await pg.wait_for_timeout(150)
    s = await S()
    check(
        s['solved'] == {L['id'] + '.dgW': True}
        and s['lessons'][0]['items'][0]['text'] == 'Find the apex $C$.'
        and s['lessons'][0]['items'][2]['text'] == 'Just *looking*.'
        and len(s['lessons']) == 1,
        'updated in place; only the changed problem lost its progress: ' + str(s['solved']),
    )
    # a broken exercise stops the export
    await pg.click('.diagram-row [data-act=sheet-open][data-id=dgE]')
    await pg.wait_for_timeout(100)
    await pg.locator('#log li >> nth=-1 >> [data-act=row-del]').click()
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=notebook-export]')
    await pg.wait_for_timeout(50)
    check(
        'Equilateral needs fixing' in await pg.locator('#exportForm').inner_text()
        and await pg.locator('#exportForm [type=submit]').is_disabled(),
        'a broken exercise stops the export',
    )
    await pg.click('[data-act=form-cancel]')
    await pg.click('[data-act=undo]')
    await pg.wait_for_timeout(50)
    # download, delete, import
    await pg.click(f"[data-act=card-open][data-id={L['id']}]")
    await pg.wait_for_timeout(100)
    async with pg.expect_download() as dl:
        await pg.click('[data-act=lesson-download]')
    d = await dl.value
    path = os.path.abspath('lesson-download.json')
    await d.save_as(path)
    check(
        d.suggested_filename == 'Basics.json' and json.load(open(path))['id'] == L['id'],
        'Download saves the lesson as a file: ' + d.suggested_filename,
    )
    await pg.click('[data-act=lesson-delete]')
    await pg.click('[data-act=confirm-yes]')
    await pg.wait_for_timeout(100)
    s = await S()
    check(
        s['lessons'] == []
        and await pg.locator(f"[data-act=card-open][data-id={L['id']}]").count() == 0
        and s['solved'] == {},
        'deleted, with its progress',
    )
    bad = os.path.abspath('bad-lesson.json')
    json.dump({'id': 'x', 'title': 'Nope'}, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await pg.wait_for_timeout(150)
    check(
        "isn't a lesson" in await pg.locator('.toast').inner_text(),
        'a file that is not a lesson is refused',
    )
    broken = json.load(open(path))
    broken['items'][0]['goals'] = ['e99']
    json.dump(broken, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await pg.wait_for_timeout(150)
    check(
        "isn't a lesson" in await pg.locator('.toast').inner_text()
        and (await S())['lessons'] == [],
        'nor one whose goal is missing',
    )
    clash = json.load(open(path))
    clash['tools'][0]['id'] = 'tSame'
    clash['toolbox'][2] = 'tSame'
    json.dump(clash, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await pg.wait_for_timeout(150)
    check((await S())['lessons'] == [], "nor one whose tool would take the place of one of yours")
    clash = json.load(open(path))
    clash['items'][0]['id'] = 'dgS'
    json.dump(clash, open(bad, 'w'))
    await pg.set_input_files('#lessonFile', bad)
    await pg.wait_for_timeout(150)
    check((await S())['lessons'] == [], "nor one whose problem has a diagram's id")
    await pg.set_input_files('#lessonFile', path)
    await pg.wait_for_timeout(200)
    s = await S()
    check(
        len(s['lessons']) == 1
        and await pg.locator('.card.is-open .card-name').first.inner_text() == 'Basics'
        and 'Added the lesson' in await pg.locator('.toast').inner_text(),
        'imported, and opened',
    )
    check(await pg.locator('#lessonFile').evaluate('e => e.hidden'), 'the file picker stays hidden')


run(main)
