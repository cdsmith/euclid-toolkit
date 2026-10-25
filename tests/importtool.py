from harness import URL, check, import_groups, run, saved_state, seed, watch

inp = {'in0': {'id': 'in0', 'op': 'input', 'idx': 0, 'ins': [], 'outs': ['a'], 'seq': -1000}}
el = {'a': {'id': 'a', 'node': 'in0', 'kind': 'point', 'label': 'A'}}


def tool(i, nm, box, uses=()):
    nodes, elems, last = dict(inp), dict(el), 'a'
    for k, u in enumerate(uses):
        nodes[f'n{k}'] = {
            'id': f'n{k}',
            'op': 'tool',
            'tool': u,
            'ins': [last],
            'outs': [f'o{k}'],
            'seq': k + 1,
        }
        elems[f'o{k}'] = {'id': f'o{k}', 'node': f'n{k}', 'kind': 'point', 'label': ''}
        last = f'o{k}'
    # each tool's input is labeled differently, so no two are built the same way
    return {
        'id': i,
        'name': nm,
        'box': box,
        'ins': [{'kind': 'point', 'label': nm}],
        'outs': [{'kind': 'point', 'label': 'A'}],
        'graph': {'rel': True, 'nodes': nodes, 'elems': elems, 'seq': len(uses) + 1},
        'inIds': ['a'],
        'outIds': [last],
        'sample': [{'kind': 'point', 'x': 0, 'y': 0}],
    }


# The lesson has Same, Twice and Shown, and Hidden, which was removed. Alpha has no Line.
state = {
    'solved': {},
    'tools': [
        tool('tSame', 'Same', 'euclid'),
        tool('tTwice', 'Twice', 'euclid'),
        tool('tHid', 'Hidden', 'euclid'),
        tool('tShown', 'Shown', 'euclid'),
        tool('tBee', 'Bee', 'nb2'),
    ],
    'toolboxes': {
        'euclid': ['point', 'line', 'circle', 'tSame', 'tTwice', 'tShown'],
        'nb1': ['point', 'circle'],
        'nb2': ['point', 'line', 'circle', 'tBee'],
    },
    'notebooks': [
        {'id': 'nb1', 'name': 'Alpha', 'diagrams': [{'id': 'p1', 'name': 'Diagram 1'}]},
        {'id': 'nb2', 'name': 'Beta', 'diagrams': [{'id': 'p2', 'name': 'Diagram 1'}]},
    ],
}


async def main(b):
    pg = watch(await b.new_page(viewport={'width': 1440, 'height': 900}))
    await pg.goto(URL)
    await seed(pg, state)
    tools = lambda: pg.locator('#tools .tname').all_inner_texts()
    toast = lambda: pg.locator('.toast').last.inner_text()
    groups = lambda: import_groups(pg)
    check(
        '1 diagram · 4 tools' in await pg.locator('#nav').inner_text()
        and '1 diagram · 2 tools' in await pg.locator('#nav').inner_text(),
        'notebook cards count the tools their toolboxes show',
    )
    await pg.click('[data-act=card-open][data-id=nb1]')
    await pg.wait_for_timeout(150)
    check(await tools() == ['Point', 'Circle'], 'Alpha has Point and Circle: ' + str(await tools()))
    await pg.click('[data-act=tool-import]')
    await pg.wait_for_timeout(50)
    check(
        await groups()
        == [
            'Built in: Line, Segment',
            'Beta: Bee',
            "Euclid's Constructions: Same, Twice, Shown",
            "Triangle Centers: Midpoint, Perpendicular, Angle bisector",
            "Arithmetic: Parallel, Perpendicular, Midpoint, Transfer distance",
        ],
        'importable: ' + str(await groups()),
    )
    await pg.locator('.import').screenshot(path='import-list.png')
    await pg.click('[data-act=tool-import-pick][data-id=line]')
    await pg.wait_for_timeout(50)
    check(
        await tools() == ['Point', 'Circle', 'Line'] and await toast() == 'Imported “Line”.',
        'imported Line: ' + str(await tools()),
    )
    check(
        await groups()
        == [
            'Built in: Segment',
            'Beta: Bee',
            "Euclid's Constructions: Same, Twice, Shown",
            "Triangle Centers: Midpoint, Perpendicular, Angle bisector",
            "Arithmetic: Parallel, Perpendicular, Midpoint, Transfer distance",
        ],
        'the list stays open, without Line',
    )
    await pg.click('[data-act=tool-import-pick][data-id=tTwice]')
    await pg.wait_for_timeout(50)
    check(
        await tools() == ['Point', 'Circle', 'Line', 'Twice']
        and await toast() == 'Imported “Twice”.',
        'imported Twice alone: ' + str(await tools()),
    )
    check(
        await groups()
        == [
            'Built in: Segment',
            'Beta: Bee',
            "Euclid's Constructions: Same, Shown",
            "Triangle Centers: Midpoint, Perpendicular, Angle bisector",
            "Arithmetic: Parallel, Perpendicular, Midpoint, Transfer distance",
        ],
        'Twice is here now: ' + str(await groups()),
    )
    await pg.click('[data-act=tool-import-pick][data-id=tSame]')
    await pg.click('[data-act=tool-import-pick][data-id=tShown]')
    await pg.wait_for_timeout(50)
    s = await saved_state(pg)
    check(
        sorted(t['name'] for t in s['tools'] if t['box'] == 'nb1') == ['Same', 'Shown', 'Twice'],
        'copies are in Alpha',
    )
    await pg.click('[data-act=tool-import-pick][data-id=tBee]')
    await pg.wait_for_timeout(50)
    while await pg.locator('.import-item').count():
        await pg.click('.import-item >> nth=0')
        await pg.wait_for_timeout(50)
    check(await pg.locator('.import').count() == 0, 'the list closes when nothing is left')
    check(
        await pg.locator('#tools .tname').all_inner_texts()
        == [
            'Point',
            'Circle',
            'Line',
            'Twice',
            'Same',
            'Shown',
            'Bee',
            'Segment',
            'Midpoint',
            'Perpendicular',
            'Angle bisector',
            'Parallel',
            'Transfer distance',
        ],
        "lessons' given tools can be imported too, and one built the same way as another comes "
        'once: ' + str(await pg.locator('#tools .tname').all_inner_texts()),
    )
    await pg.click('[data-act=tool-import]')
    await pg.wait_for_timeout(50)
    check(
        'nothing left to import' in await pg.locator('.import').inner_text(),
        'and says so if opened',
    )
    await pg.click('[data-act=form-cancel]')
    await pg.click('[data-act=tool-more][data-id=line]')
    await pg.click('[data-act=tool-remove][data-id=line]')
    await pg.wait_for_timeout(50)
    check(
        'you can import it again' in await pg.locator('.tdetail .confirm').inner_text(),
        'removing Line asks: ' + await pg.locator('.tdetail .confirm').inner_text(),
    )
    await pg.click('[data-act=confirm-yes]')
    await pg.wait_for_timeout(50)
    check('Line' not in await tools(), 'Line removed from Alpha')
    await pg.click('[data-act=tool-import]')
    await pg.wait_for_timeout(50)
    check(await groups() == ['Built in: Line'], 'and importable again: ' + str(await groups()))
    await pg.click('[data-act=form-cancel]')
    tw = next(t['id'] for t in s['tools'] if t['box'] == 'nb1' and t['name'] == 'Twice')
    box = await pg.locator('#stage').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(x, y)
    await pg.wait_for_timeout(50)
    await pg.click(f'[data-act=tool-use][data-id={tw}]')
    await pg.mouse.click(x, y)
    await pg.wait_for_timeout(100)
    check(
        'Twice(A) → B' in ' '.join(await pg.locator('.log li').all_inner_texts()),
        'the import works: ' + str(await pg.locator('.log li').all_inner_texts()),
    )
    # a lesson: Import appears only once a starting tool is gone, and offers only those
    await pg.click('[data-act=card-open][data-id=euclid]')
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('[data-act=tool-import]').count() == 0,
        'a lesson with all its tools has no Import',
    )
    await pg.click('[data-act=tool-more][data-id=circle]')
    await pg.click('[data-act=tool-remove][data-id=circle]')
    await pg.click('[data-act=confirm-yes]')
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=tool-import]')
    await pg.wait_for_timeout(50)
    check(
        await groups() == ['Starting tools: Circle'],
        'the lesson offers back only its own tools: ' + str(await groups()),
    )
    await pg.click('[data-act=tool-import-pick][data-id=circle]')
    await pg.wait_for_timeout(50)
    check(
        await tools() == ['Point', 'Line', 'Same', 'Twice', 'Shown', 'Circle']
        and await pg.locator('[data-act=tool-import]').count() == 0,
        'Circle back: ' + str(await tools()),
    )
    await pg.click('[data-act=lesson-reset]')
    await pg.click('[data-act=confirm-yes]')
    await pg.wait_for_timeout(100)
    check(
        await tools() == ['Point', 'Line', 'Circle'],
        'reset gives the lesson its starting tools: ' + str(await tools()),
    )
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    check(
        await tools() == ['Point', 'Line', 'Circle', 'Segment'],
        'a new notebook starts with Point, Line, Circle and Segment',
    )


run(main)
