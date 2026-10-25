from harness import URL, check, open_page, run, settle, watch


async def drag(pg, src, dst, after=False):
    a = await pg.locator(src).bounding_box()
    b = await pg.locator(dst).bounding_box()
    await pg.mouse.move(a['x'] + 30, a['y'] + a['height'] / 2)
    await pg.mouse.down()
    ty = b['y'] + (b['height'] * 0.8 if after else b['height'] * 0.2)
    for k in range(1, 9):
        await pg.mouse.move(
            a['x'] + 30, a['y'] + a['height'] / 2 + (ty - a['y'] - a['height'] / 2) * k / 8
        )
    await pg.mouse.up()
    await settle(pg)


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    for _ in range(3):
        await pg.click('[data-act=diagram-new]')
    await settle(pg)
    rows = lambda: pg.locator('.diagrams .item').all_inner_texts()
    h1 = lambda: pg.locator('.tb-title h1').inner_text()
    check(
        await rows() == ['Diagram 1', 'Diagram 2', 'Diagram 3', 'Diagram 4']
        and await h1() == 'Diagram 4',
        'four diagrams',
    )
    await drag(pg, '.diagram-row >> nth=3', '.diagram-row >> nth=0')
    check(
        await rows() == ['Diagram 4', 'Diagram 1', 'Diagram 2', 'Diagram 3'],
        'dragged Diagram 4 to the top: ' + str(await rows()),
    )
    check(await h1() == 'Diagram 4', 'dragging did not open a different diagram')
    await drag(pg, '.diagram-row >> nth=1', '.diagram-row >> nth=3', after=True)
    check(
        await rows() == ['Diagram 4', 'Diagram 2', 'Diagram 3', 'Diagram 1'],
        'dragged Diagram 1 to the bottom: ' + str(await rows()),
    )
    # a plain click still opens the diagram
    await pg.click('.diagrams .item >> nth=2')
    await settle(pg)
    check(await h1() == 'Diagram 3', 'a click still opens a diagram')
    # Esc cancels a drag
    a = await pg.locator('.diagram-row >> nth=0').bounding_box()
    await pg.mouse.move(a['x'] + 30, a['y'] + 10)
    await pg.mouse.down()
    await pg.mouse.move(a['x'] + 30, a['y'] + 80, steps=5)
    await pg.screenshot(
        path='reorder-drag.png', clip={'x': 0, 'y': 60, 'width': 280, 'height': 320}
    )
    await pg.keyboard.press('Escape')
    await pg.mouse.up()
    await settle(pg)
    check(
        await rows() == ['Diagram 4', 'Diagram 2', 'Diagram 3', 'Diagram 1'], 'Esc cancels a drag'
    )
    # duplicate lands right after its original
    await pg.click('.diagram-row >> nth=1 >> [data-act=diagram-duplicate]')
    await settle(pg)
    check(
        await rows() == ['Diagram 4', 'Diagram 2', 'Diagram 2 (copy)', 'Diagram 3', 'Diagram 1'],
        'a duplicate goes right after its original: ' + str(await rows()),
    )
    # the order survives a reload
    await pg.reload()
    await settle(pg)
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    check(
        await rows() == ['Diagram 4', 'Diagram 2', 'Diagram 2 (copy)', 'Diagram 3', 'Diagram 1'],
        'order kept after reload',
    )
    # tools
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
    for nm in ['First', 'Second', 'Third']:
        await pg.click('[data-act=def-start]')
        await pg.mouse.click(*P1)
        await pg.mouse.click(*P2)
        await pg.click('[data-act=def-next]')
        await pg.mouse.click((P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2)
        await pg.click('[data-act=def-next]')
        await pg.fill('#toolName', nm)
        await pg.click('[data-act=def-save]')
        await settle(pg)
    tools = lambda: pg.locator('#tools .tname').all_inner_texts()
    check(
        await tools() == ['Point', 'Line', 'Circle', 'Segment', 'First', 'Second', 'Third'],
        'three tools',
    )
    await drag(pg, '[data-drag=tool] >> nth=6', '[data-drag=tool] >> nth=4')
    check(
        await tools() == ['Point', 'Line', 'Circle', 'Segment', 'Third', 'First', 'Second'],
        'dragged Third to the top of the saved tools: ' + str(await tools()),
    )
    check(await pg.locator('.tcard.is-active').count() == 0, 'dragging a tool did not pick it up')
    await drag(pg, '[data-drag=tool] >> nth=0', '[data-drag=tool] >> nth=3')
    check(
        await tools() == ['Line', 'Circle', 'Point', 'Segment', 'Third', 'First', 'Second'],
        'Point, Line and Circle drag too: ' + str(await tools()),
    )
    await drag(pg, '[data-drag=tool] >> nth=5', '[data-drag=tool] >> nth=0')
    check(
        await tools() == ['First', 'Line', 'Circle', 'Point', 'Segment', 'Third', 'Second'],
        'a saved tool can go above them: ' + str(await tools()),
    )
    await pg.reload()
    await settle(pg)
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    check(
        await tools() == ['First', 'Line', 'Circle', 'Point', 'Segment', 'Third', 'Second'],
        'tool order kept after reload',
    )
    await pg.keyboard.press('1')
    await settle(pg)
    check(
        await pg.locator('.pt-name').inner_text() == 'FIRST',
        'shortcut 1 follows the new order: ' + await pg.locator('.pt-name').inner_text(),
    )
    await pg.keyboard.press('Escape')
    await pg.screenshot(
        path='reorder-tools.png', clip={'x': 1100, 'y': 60, 'width': 340, 'height': 500}
    )
    # phone: grips show, and the page still scrolls
    ph = watch(
        await b.new_page(viewport={'width': 400, 'height': 860}, has_touch=True, is_mobile=True)
    )
    await ph.goto(URL)
    await settle(ph)
    await ph.click('#navToggle')
    await settle(ph)
    await ph.click('[data-act=notebook-new]')
    await settle(ph)
    await ph.click('#navToggle')
    await settle(ph)
    check(
        await ph.locator('.diagram-row .grip >> nth=0').is_visible(), 'grips show on a touch screen'
    )
    await ph.screenshot(path='reorder-phone.png')


if __name__ == '__main__':
    run(main)
