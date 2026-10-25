from harness import check, folds, open_page, run, saved_state, settle

# An exercise's text, with two hints
TEXT = (
    'Construct $C$ so that $ABC$ is equilateral.\n\n'
    '::: Hint\nUse two circles.\n:::\n\n::: Hint\nThen their crossing.\n:::'
)


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    st = await pg.locator('#stage').bounding_box()
    x, y = st['x'] + st['width'] / 2, st['y'] + st['height'] / 2
    A, B, C, F = (x - 80, y + 40), (x + 80, y + 40), (x, y + 40 - 138.564), (x + 150, y - 120)
    use = lambda i: pg.click(f'[data-act=tool-use][data-id={i}]')

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*q)
            await settle(pg)

    await use('point')
    await clicks(A, B)
    await use('circle')
    await clicks(A, B, B, A)
    await use('point')
    await clicks(C, F)
    await pg.keyboard.press('Escape')

    async def S():
        return (await saved_state(pg))['notebooks'][0]['diagrams'][0]

    # a goal that doesn't follow from the givens
    await pg.click('[data-act=write][data-id=name]')
    await pg.fill('#writeField', 'Equilateral')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(
        await pg.locator('.tb-title h1').inner_text() == 'Equilateral'
        and 'Equilateral' in await pg.locator('.diagram-row').first.inner_text(),
        'the title is renamed in place, and the list follows',
    )
    await pg.click('[data-act=write][data-id=name]')
    await pg.fill('#writeField', '  ')
    await pg.keyboard.press('Escape')
    await settle(pg)
    check(
        await pg.locator('.tb-title h1').inner_text() == 'Equilateral',
        'an empty name leaves it as it was',
    )
    await pg.click('[data-act=exercise-mark]')
    await settle(pg)
    check(
        'MAKE AN EXERCISE' in (await pg.locator('#defSec').inner_text()).upper()
        and 'GIVENS' in (await pg.locator('.def-step').inner_text()).upper(),
        'the panel speaks of givens and goals',
    )
    await clicks(A, B)
    await pg.click('[data-act=def-next]')
    await pg.click('[data-act=def-next]')
    await clicks(F)
    await pg.click('[data-act=def-next]')
    await settle(pg)
    err = await pg.locator('#defSec .err').inner_text()
    check(
        'goals shift' in err and 'Make it a given' in err,
        'a free goal is refused, in exercise words: ' + err,
    )
    await pg.click('[data-act=def-drop][data-id]  >> nth=-1')
    await clicks(C)
    await pg.click('[data-act=def-next]')
    await pg.click('[data-act=def-next]')
    await settle(pg)
    check(
        await pg.locator('#def-title').count() == 0
        and await pg.locator('#def-toolName').get_attribute('placeholder') == 'Equilateral',
        'the form has no title: the tool it earns is named after the diagram',
    )
    await pg.screenshot(path='ex-panel.png')
    check(await pg.locator('#def-subtitle').count() == 0, 'nor a subtitle: it goes with the title')
    check(
        await pg.locator('#def-text').count() == 0 and await pg.locator('#def-hints').count() == 0,
        'nor text or hints: they go under the title',
    )
    await pg.fill('#def-toolName', 'Apex')
    await pg.keyboard.press('1')
    await settle(pg)
    check(
        await pg.locator('#def-toolName').input_value() == 'Apex1'
        and await pg.locator('.tcard.is-active').count() == 0,
        'typing in a field types, without picking tools',
    )
    await pg.fill('#def-toolName', '')
    await pg.click('[data-act=def-save]')
    await settle(pg)
    s = await S()
    check(
        s['name'] == 'Equilateral'
        and s['exercise']['toolName'] == 'Equilateral'
        and len(s['exercise']['givens']) == 2
        and len(s['exercise']['goals']) == 1
        and 'error' not in s['exercise'],
        'saved: ' + str({k: v for k, v in s['exercise'].items() if k not in ('givens', 'goals')}),
    )
    await pg.click('[data-act=write][data-id=subtitle]')
    await pg.keyboard.type('Euclid I.1')
    await pg.keyboard.press('Enter')
    await settle(pg)
    await pg.click('[data-act=write][data-id=text]')
    await pg.fill(
        '#writeField',
        TEXT,
    )
    await pg.keyboard.press('Escape')
    await settle(pg)
    tb = await pg.locator('#titleblock').inner_text()
    check(
        'EXERCISE' in tb.upper()
        and 'Euclid I.1' in tb
        and 'is equilateral.' in tb
        and 'Edit text' in tb,
        'the title block shows the exercise, its text written in place',
    )
    check(
        (await S()).get('text') == TEXT and (await S()).get('subtitle') == 'Euclid I.1',
        'the subtitle and text are the diagram\'s',
    )
    check(await pg.locator('.diagram-row .ex-mark').count() == 1, 'its row is marked')
    await pg.screenshot(path='ex-page.png')
    # deleting the goal breaks it; undo mends it
    await pg.locator('#log li >> nth=-2 >> [data-act=row-del]').click()
    await settle(pg)
    if await pg.locator('[data-act=confirm-yes]').count():
        await pg.click('[data-act=confirm-yes]')
        await settle(pg)
    check(
        'Needs fixing' in await pg.locator('#titleblock').inner_text()
        and await pg.locator('.ex-mark.bad').count() == 1
        and await pg.locator('[data-act=exercise-try]').is_disabled(),
        'deleting its goal breaks it: ' + await pg.locator('#titleblock').inner_text(),
    )
    await pg.click('[data-act=undo]')
    await settle(pg)
    check(
        await pg.locator('.ex-mark.bad').count() == 0
        and 'Needs fixing' not in await pg.locator('#titleblock').inner_text(),
        'undo mends it',
    )
    # trying it
    await pg.click('[data-act=exercise-try]')
    await settle(pg)
    tb = await pg.locator('#titleblock').inner_text()
    check(
        'TRYING' in tb.upper()
        and 'Not found yet' in tb
        and await pg.locator('#log li').count() == 1,
        'trying it starts from the givens alone: ' + tb.replace('\n', ' | '),
    )
    check(
        await pg.locator('.diagram-row .item.is-current').count() == 1,
        'its diagram stays marked in the notebook',
    )
    hints = lambda: folds(pg)
    opens = lambda k: pg.click(f'#titleblock details.fold >> nth={k} >> summary')
    await opens(0)
    await settle(pg)
    h = await hints()
    check(
        h[0][2:] == [True, 'Use two circles.'] and h[1][:3] == ['Hint', True, False],
        'the first hint opens, the second stays folded: ' + str(h),
    )
    await opens(1)
    await settle(pg)
    check((await hints())[1][2:] == [True, 'Then their crossing.'], 'then the second')
    await opens(0)
    await settle(pg)
    h = await hints()
    check(not h[0][2] and h[1][1] and h[1][2], 'folding the first leaves the second open')
    await pg.screenshot(path='ex-try.png')
    # where the trial's view put A, B and C: the diagram opened empty, so 1 px there was 1/s0 units;
    # the trial fits A and B (see fitView)
    Wd, Hd = st['width'], st['height']
    s0 = min((Wd - 40) / 525, (Hd - 70) / 350)
    t1 = await pg.locator('#stage').bounding_box()
    x1, y1 = (
        t1['x'] + t1['width'] / 2,
        t1['y'] + t1['height'] / 2,
    )  # the trial's title may be taller
    s1 = min((t1['width'] - 40) / (max(160 / s0, 180) * 1.75), (t1['height'] - 70) / (180 * 1.75))
    k = s1 / s0
    A2, B2, C2 = (
        (x1 - 80 * k, y1 - 20),
        (x1 + 80 * k, y1 - 20),
        (x1, y1 - 20 - 138.564 * k),
    )  # fitted 20 px above center
    await use('circle')
    await clicks(A2, B2, B2, A2)
    await use('point')
    await clicks(C2)
    await pg.keyboard.press('Escape')
    await settle(pg)
    tb = await pg.locator('#titleblock').inner_text()
    check(
        'SOLVED' in tb and 'Save as tool' not in tb and 'Back to the diagram' in tb,
        'solving it: ' + tb.replace('\n', ' | '),
    )
    solved = (await saved_state(pg))['solved']
    check(
        solved == {}
        and await pg.evaluate("Object.keys(localStorage).filter(k => k.includes('try:')).length")
        == 0,
        'trying records nothing',
    )
    await pg.click('[data-act=try-end]')
    await settle(pg)
    check(
        await pg.locator('.tb-title h1').inner_text() == 'Equilateral'
        and await pg.locator('#log li').count() == 6,
        'back to the diagram, as it was',
    )
    await pg.click('[data-act=exercise-try]')
    await settle(pg)
    check(await pg.locator('#log li').count() == 1, 'trying again starts fresh')
    await pg.click('[data-act=try-end]')
    await settle(pg)
    # editing keeps what was picked
    await pg.click('[data-act=exercise-mark]')
    await settle(pg)
    check(
        await pg.locator('#defSec .chip').count() == 2
        and 'EDIT EXERCISE' in (await pg.locator('#defSec').inner_text()).upper(),
        'editing starts with the givens picked',
    )
    await pg.click('[data-act=def-cancel]')
    await pg.click('[data-act=diagram-duplicate]')
    await settle(pg)
    s2 = (await saved_state(pg))['notebooks'][0]['diagrams'][1]
    check(
        s2.get('text') == TEXT and s2.get('exercise', {}).get('toolName') == 'Equilateral',
        'a duplicate is the same exercise',
    )
    await pg.click('[data-act=exercise-remove]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check(
        await pg.locator('[data-act=exercise-mark]').inner_text() == 'Make exercise'
        and await pg.locator('.ex-mark').count() == 1,
        'removing makes the copy a plain diagram again',
    )
    s3 = (await saved_state(pg))['notebooks'][0]['diagrams'][1]
    check(
        s3.get('text') == TEXT
        and s3.get('subtitle') == 'Euclid I.1'
        and 'Euclid I.1' in await pg.locator('#titleblock').inner_text(),
        'and keeps its subtitle and text',
    )


run(main)
