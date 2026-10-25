import json
from harness import URL, check, run, saved_state, settle, watch


async def main(b):
    pg = await b.new_page(viewport={'width': 1440, 'height': 900})
    watch(pg)
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await settle(pg)
    T = lambda sel: pg.locator(sel).inner_text()
    n = lambda sel: pg.locator(sel).count()
    h1 = lambda: T('.tb-title h1')
    rows = lambda: pg.locator('.diagrams .item').all_inner_texts()
    tools = lambda: pg.locator('.tname').all_inner_texts()
    log = lambda: T('#log')

    check(await pg.locator('#home').is_visible(), 'boots to the start page')
    check(
        await n('.card.is-open') == 0 and await n('[data-act=notebook-new]') == 1,
        'nav: no open card, New notebook button',
    )

    # ---- notebooks and diagrams
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    check(
        await n('#nameForm') == 0
        and await h1() == 'Diagram 1'
        and (await T('#headSum')).startswith('Notebook 1:'),
        'New notebook makes "Notebook 1" at once, open on Diagram 1',
    )
    await pg.click('.card-head [data-act=notebook-rename]')
    await pg.fill('#nameInput', '')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(await n('#nameForm') == 1, 'an empty name is not accepted')
    await pg.fill('#nameInput', 'Polygons')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check((await T('#headSum')).startswith('Polygons:'), 'renamed it')
    check(
        await rows() == ['Diagram 1'] and await n('[data-act=diagram-delete]') == 0,
        'one diagram, no Delete diagram',
    )
    check('Polygons: 1 diagram' in await T('#headSum'), 'header summary for the notebook')

    st = await pg.locator('#stage').bounding_box()
    P1, P2 = (st['x'] + 300, st['y'] + 300), (st['x'] + 460, st['y'] + 340)
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.keyboard.press('Escape')
    check(
        'Line(A, B)' in await log(),
        'drew two points and a line: ' + (await log()).replace('\n', ' | ')[:80],
    )
    await pg.click('[data-act=def-start]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.click('[data-act=def-next]')
    await pg.mouse.click((P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2)
    await pg.click('[data-act=def-next]')
    await pg.fill('#toolName', 'Join')
    await pg.click('[data-act=def-save]')
    await settle(pg)
    check('Join' in await tools(), 'defined a tool in the notebook toolbox')

    await pg.click('[data-act=diagram-new]')
    await settle(pg)
    check(
        await h1() == 'Diagram 2'
        and 'Join' in await tools()
        and 'Nothing drawn yet.' in await log(),
        'New diagram makes Diagram 2, which shares the toolbox and starts empty',
    )
    await pg.click('[data-act=diagram-new]')
    await settle(pg)
    await pg.click('.diagram-row:has(.is-current) [data-act=diagram-rename]')
    await pg.fill('#nameInput', 'Hexagon')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', 'Diagram 2', 'Hexagon'] and await h1() == 'Hexagon',
        'third diagram added and renamed',
    )
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    check((await T('#headSum')).startswith('Notebook 2:'), 'the next new notebook is Notebook 2')
    await pg.click('[data-act=notebook-delete]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    await pg.click('.diagrams .item >> nth=2')
    await settle(pg)
    await pg.click('.diagrams .item >> nth=1')
    await settle(pg)
    await pg.click('.diagram-row:has(.is-current) [data-act=diagram-rename]')
    await pg.keyboard.press('Escape')
    await settle(pg)
    check(await n('#nameForm') == 0 and await h1() == 'Diagram 2', 'Esc cancels a rename')
    await pg.click('.diagram-row:has(.is-current) [data-act=diagram-rename]')
    await pg.fill('#nameInput', 'Scratch')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(
        await h1() == 'Scratch' and await rows() == ['Diagram 1', 'Scratch', 'Hexagon'],
        'renamed a diagram',
    )
    await pg.click('.diagram-row:has(.is-current) [data-act=diagram-delete]')
    check(await n('.diagram-row .confirm') == 1, 'Delete diagram asks first, on its row')
    await pg.click('[data-act=confirm-no]')
    await settle(pg)
    check(
        await n('.confirm') == 0 and await rows() == ['Diagram 1', 'Scratch', 'Hexagon'],
        'Keep leaves it',
    )
    await pg.click('.diagram-row:has(.is-current) [data-act=diagram-delete]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', 'Hexagon'] and await h1() == 'Hexagon',
        'deleted a diagram and moved to the next one',
    )
    await pg.click('.card-head [data-act=notebook-rename]')
    await pg.fill('#nameInput', 'Shapes')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(
        await T('.card.is-open .card-name') == 'Shapes' and 'Shapes toolbox' in await T('#boxName'),
        'renamed the notebook',
    )

    # a confirmation closes when you do something else
    await pg.click('[data-act=notebook-delete]')
    check(await n('.card-foot .confirm') == 1, 'Delete notebook asks first')
    await pg.click('[data-act=fit]')
    await settle(pg)
    check(await n('.confirm') == 0, 'another action closes the question')

    # ---- tools: rename, remove (keep), edit and cancel
    await pg.click('.diagrams .item >> nth=0')
    await settle(pg)
    tid = (await saved_state(pg))['tools'][0]['id']
    await pg.click(f'[data-act=tool-more][data-id="{tid}"]')
    await pg.click(f'[data-act=tool-rename][data-id="{tid}"]')
    await pg.fill('#nameInput', 'Join two')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check('Join two' in await tools(), 'renamed a tool')
    await pg.click(f'[data-act=tool-remove][data-id="{tid}"]')
    check(await n('.tdetail .confirm') == 1, 'Remove tool asks first')
    await pg.click('[data-act=confirm-no]')
    await pg.click(f'[data-act=tool-edit][data-id="{tid}"]')
    await settle(pg)
    check(
        await h1() == 'Join two'
        and await n('.card.is-open') == 1
        and 'Shapes toolbox' in await T('#boxName'),
        'editing a tool keeps its notebook open',
    )
    await pg.click('[data-act=edit-cancel]')
    await settle(pg)
    check(await h1() == 'Diagram 1', 'cancel returns to the diagram')

    # ---- selecting, styling, deleting
    await pg.click('.log li >> nth=0 >> .txt')
    await settle(pg)
    check(
        await n('.sel') == 1 and 'A' in await T('.sel .what'),
        'clicking a construction row selects its point',
    )
    await pg.click('[data-act=sel-color][data-id=red]')
    await settle(pg)
    style = await pg.evaluate(
        """() => {
            const id = document.querySelector('.diagrams .is-current').dataset.id
            const w = JSON.parse(localStorage.getItem('euclid-toolkit:work:' + id))
            return Object.values(w.doc.elems).find((e) => e.label === 'A').style
          }"""
    )
    check(style == {'color': 'red'}, 'colored the point red')
    await pg.click('[data-act=sel-del]')
    check(
        await n('.sel .confirm') == 1 and 'line' in await T('.sel .confirm'),
        'deleting A asks, naming the line built on it',
    )
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check('Line' not in await log() and await n('.sel') == 0, 'A and its line deleted')
    await pg.click('[data-act=undo]')
    await settle(pg)
    check('Line(A, B)' in await log(), 'undo brings them back')
    await pg.click('.log li >> nth=0 >> [data-act=row-del]')
    check(await n('.log .confirm') == 1, 'row delete asks on the row')
    await pg.keyboard.press('Escape')
    await settle(pg)
    check(await n('.confirm') == 0, 'Esc closes the question')

    # ---- close and reopen
    await pg.click('[data-act=card-close]')
    await settle(pg)
    check(
        await pg.locator('#home').is_visible() and await n('.card.is-open') == 0,
        'Close goes to the start page',
    )
    await pg.click('[data-act=card-open]')
    await settle(pg)
    check(await h1() == 'Diagram 1', 'reopening returns to the last diagram')
    await pg.click('.diagrams .item >> nth=1')
    await pg.reload()
    await settle(pg)
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    check(
        await h1() == 'Hexagon' and await rows() == ['Diagram 1', 'Hexagon'],
        'after a reload, diagrams and the last diagram are remembered',
    )

    # ---- a lesson
    await pg.click('[data-act=card-open][data-id=euclid]')
    await settle(pg)
    check(
        await h1() == 'Equilateral Triangle'
        and await n('.notebooks, .card.is-open .diagrams') == 0,
        'lesson opens on problem 1; the notebook folds',
    )
    bb = await pg.locator('#cv').bounding_box()
    W, H = bb['width'], bb['height']
    s = min((W - 40) / (180 * 1.75), (H - 70) / (180 * 1.75))
    sc = lambda x, y: (bb['x'] + x * s + W / 2, bb['y'] + (y - 30) * s + H / 2 - 20)
    await pg.click('[data-act=tool-use][data-id=circle]')
    for x, y in [(-70, 30), (70, 30), (70, 30), (-70, 30)]:
        await pg.mouse.click(*sc(x, y))
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*sc(0, 30 - 121.2436))
    await pg.keyboard.press('Escape')
    await settle(pg)
    check(await n('.stamp') == 1, 'solved problem 1')
    await pg.click('[data-act=solution-save]')
    await settle(pg)
    check(await pg.input_value('#toolName') == 'Equilateral apex', 'Save as tool suggests the name')
    await pg.click('[data-act=def-save]')
    await settle(pg)
    check(
        'Equilateral apex' in await tools()
        and "Euclid's Constructions toolbox" in await T('#boxName'),
        'saved to the lesson toolbox',
    )
    await pg.click('[data-act=next]')
    await settle(pg)
    check(
        await h1() == 'Perpendicular Bisector' and 'Equilateral apex' in await tools(),
        'next problem has the lesson tool',
    )
    check(
        await pg.locator('.item:disabled').count() == 0
        and await pg.locator('[data-act=skip]').count() == 0,
        'no locked problems, no Skip',
    )
    await pg.click('.item >> nth=15')
    await settle(pg)
    check(
        await h1() == 'Regular Pentagon' and await pg.locator('[data-act=next]').count() == 0,
        'can open the last problem directly',
    )
    await pg.click('.item >> nth=1')
    await settle(pg)
    check('1 of 16 solved' in await T('.card.is-open .card-meta'), 'lesson card shows progress')
    await pg.click('[data-act=lesson-reset]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check(
        await h1() == 'Equilateral Triangle'
        and 'Equilateral apex' not in await tools()
        and '0 of 16 solved' in await T('.card.is-open .card-meta'),
        'lesson reset clears tools and progress',
    )
    await pg.screenshot(path='clean-lesson.png')

    # ---- delete the notebook
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    await pg.screenshot(path='clean-notebook.png')
    await pg.click('[data-act=notebook-delete]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    left = await pg.evaluate(
        "Object.keys(localStorage).filter(k => k.includes(':work:pg') || k.includes(':work:edit:'))"
    )
    check(
        await pg.locator('#home').is_visible()
        and await n('[data-act=card-open]') == len(json.load(open('../site/lessons/index.json')))
        and left == [],
        'notebook deleted with its work, leaving the built-in lessons: ' + str(left),
    )
    await pg.close()

    # ---- phone
    ph = watch(await b.new_page(viewport={'width': 400, 'height': 860}))
    await ph.goto(URL)
    await ph.evaluate('localStorage.clear()')
    await ph.reload()
    await settle(ph)
    await ph.click('#navToggle')
    await settle(ph)
    await ph.click('[data-act=notebook-new]')
    await settle(ph)
    check(
        not await ph.locator('#nav.open').count()
        and await ph.locator('.tb-title h1').inner_text() == 'Diagram 1',
        'phone: creating a notebook closes the drawer and opens it',
    )
    check(
        await ph.evaluate('document.documentElement.scrollWidth') <= 400,
        'phone: no horizontal scroll',
    )
    await ph.click('#navToggle')
    await settle(ph)
    await ph.screenshot(path='clean-phone.png')
    await ph.close()
    for scheme in ['dark']:
        d = watch(await b.new_page(viewport={'width': 1440, 'height': 900}, color_scheme=scheme))
        await d.goto(URL)
        await settle(d)
        await d.screenshot(path='clean-home-dark.png')
        await d.click('[data-act=card-open] >> nth=0')
        await settle(d)
        await d.screenshot(path='clean-dark.png')
        await d.close()


run(main)
