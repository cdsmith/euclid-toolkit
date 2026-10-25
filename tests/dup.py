# Duplicating a diagram copies its construction, the one you're on or another.
from harness import check, open_page, run, settle


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    st = await pg.locator('#stage').bounding_box()
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(st['x'] + 300, st['y'] + 300)
    await pg.mouse.click(st['x'] + 400, st['y'] + 300)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.mouse.click(st['x'] + 300, st['y'] + 300)
    await pg.mouse.click(st['x'] + 400, st['y'] + 300)
    await pg.keyboard.press('Escape')
    rows = lambda: pg.locator('.diagrams .item').all_inner_texts()
    log = lambda: pg.locator('#log').inner_text()
    before = await log()
    await pg.click('.diagram-row >> nth=0 >> [data-act=diagram-duplicate]')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', 'Diagram 1 (copy)']
        and await pg.locator('.tb-title h1').inner_text() == 'Diagram 1 (copy)'
        and await log() == before,
        'duplicating the diagram you are on puts the copy after it, opens it, with the same '
        'construction: ' + str(await rows()),
    )
    # change the copy; the original stays as it was
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(st['x'] + 300, st['y'] + 300)
    await pg.mouse.click(st['x'] + 400, st['y'] + 300)
    await pg.keyboard.press('Escape')
    await pg.click('.diagrams .item >> nth=0')
    await settle(pg)
    check(await log() == before, 'changing the copy leaves the original as it was')
    # duplicate a diagram you're not on
    await pg.click('.diagrams .item >> nth=1')
    await settle(pg)
    await pg.click('.diagram-row >> nth=0 >> [data-act=diagram-duplicate]')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', 'Diagram 1 (copy)', 'Diagram 1 (copy)']
        and await log() == before,
        'duplicating a diagram you are not on copies it as it was saved: ' + str(await rows()),
    )
    await pg.locator('.diagram-row >> nth=0').hover()
    await pg.screenshot(path='dup.png', clip={'x': 0, 'y': 60, 'width': 280, 'height': 300})


run(main)
