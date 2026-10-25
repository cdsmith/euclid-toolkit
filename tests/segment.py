# The Segment tool in a notebook: drawn between its ends, met only where it's drawn, points on it
# stay on it.
from harness import URL, check, run, saved_state, saved_work, serve_libs, watch


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
    await serve_libs(ctx)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    at = lambda x, y: (st['x'] + x, st['y'] + y)

    async def doc():
        s = await saved_state(pg)
        i = s['notebooks'][0]['diagrams'][0]['id']
        return await saved_work(pg, i)

    rows = lambda: pg.locator('#log li .txt').all_inner_texts()

    check(
        await pg.locator('#tools .tname').all_inner_texts()
        == ['Point', 'Line', 'Circle', 'Segment'],
        'a new notebook has Segment in its toolbox',
    )
    check(
        await pg.locator('#tools .tsig >> nth=3').inner_text() == 'A, B → segment',
        'and it makes a segment',
    )

    # A segment AB from (300, 300) to (500, 300)
    await pg.keyboard.press('4')
    await pg.mouse.click(*at(300, 300))
    await pg.mouse.click(*at(500, 300))
    await pg.wait_for_timeout(100)
    d = await doc()
    segs = [n for n in d['nodes'].values() if n['op'] == 'segment']
    check(
        len(segs) == 1 and d['elems'][segs[0]['outs'][0]]['kind'] == 'line',
        'a click at each end draws a segment, a kind of line',
    )
    check(
        any(r.startswith('Segment(') and r.endswith('segment') for r in await rows()),
        'and the construction lists it: ' + str(await rows()),
    )
    await pg.mouse.click(*at(300, 300))
    await pg.mouse.click(*at(500, 300))
    await pg.wait_for_timeout(100)
    check(
        await pg.locator('#toast').inner_text() == 'That segment is already drawn.',
        'the same segment twice is refused',
    )
    await pg.keyboard.press('Escape')

    # A circle at (500, 360) through (500, 260) crosses the segment's line at x = 420 (on it) and
    # 580 (past B).
    await pg.keyboard.press('3')
    await pg.mouse.click(*at(500, 360))
    await pg.mouse.click(*at(500, 260))
    await pg.wait_for_timeout(100)
    await pg.keyboard.press('1')
    await pg.mouse.click(*at(420, 300))
    await pg.wait_for_timeout(100)
    await pg.mouse.click(*at(580, 300))
    await pg.wait_for_timeout(100)
    r = await rows()
    check(
        any('meets' in x for x in r[-2:-1]) and 'meets' not in r[-1] and ' on ' in r[-1],
        'it meets the circle where it is drawn, and not past its end: ' + str(r[-2:]),
    )

    # A point on the segment, dragged past an end, stops at the end.
    await pg.mouse.click(*at(350, 300))
    await pg.wait_for_timeout(100)
    d = await doc()
    on = [
        n
        for n in d['nodes'].values()
        if n['op'] == 'point'
        and n['ins']
        and d['nodes'][d['elems'][n['ins'][0]]['node']]['op'] == 'segment'
    ]
    check(len(on) == 1 and abs(on[0]['t'] - 0.25) < 0.02, 'a point can go on it')
    await pg.keyboard.press('Escape')
    await pg.mouse.move(*at(350, 300))
    await pg.mouse.down()
    await pg.mouse.move(*at(300, 320), steps=4)
    await pg.mouse.move(*at(220, 300), steps=4)
    await pg.mouse.up()
    await pg.wait_for_timeout(100)
    d = await doc()
    on = [
        n
        for n in d['nodes'].values()
        if n['op'] == 'point'
        and n['ins']
        and d['nodes'][d['elems'][n['ins'][0]]['node']]['op'] == 'segment'
    ]
    check(on[0]['t'] == 0, 'dragged past an end, it stops there: t = ' + str(on[0]['t']))

    # The line through A and B can still be drawn: it isn't the segment.
    await pg.keyboard.press('2')
    await pg.mouse.click(*at(300, 300))
    await pg.mouse.click(*at(500, 300))
    await pg.wait_for_timeout(100)
    d = await doc()
    check(
        any(n['op'] == 'line' for n in d['nodes'].values()),
        'the line through its ends is a different thing',
    )
    await pg.screenshot(path='segment.png')


run(main)
