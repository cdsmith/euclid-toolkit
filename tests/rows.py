# A notebook's diagram rows: renaming and deleting a diagram from its row, while on another.
from harness import check, open_page, run


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    st = await pg.locator('#stage').bounding_box()
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(st['x'] + 300, st['y'] + 300)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=diagram-new]')
    await pg.click('[data-act=diagram-new]')
    await pg.wait_for_timeout(100)
    rows = lambda: pg.locator('.diagrams .item').all_inner_texts()
    # rename Diagram 1 from its row while on Diagram 3
    await pg.click('.diagram-row >> nth=0 >> [data-act=diagram-rename]')
    await pg.fill('#nameInput', 'First')
    await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(100)
    check(
        await rows() == ['First', 'Diagram 2', 'Diagram 3']
        and await pg.locator('.tb-title h1').inner_text() == 'Diagram 3',
        'renaming another diagram from its row leaves you where you were: ' + str(await rows()),
    )
    await pg.locator('.diagram-row >> nth=1').hover()
    await pg.wait_for_timeout(100)
    await pg.screenshot(path='rows.png', clip={'x': 0, 'y': 0, 'width': 300, 'height': 330})
    # delete Diagram 2 (not the current one): stay on Diagram 3
    await pg.click('.diagram-row >> nth=1 >> [data-act=diagram-delete]')
    await pg.wait_for_timeout(50)
    await pg.screenshot(path='rows-confirm.png', clip={'x': 0, 'y': 0, 'width': 300, 'height': 380})
    await pg.click('[data-act=confirm-yes]')
    await pg.wait_for_timeout(100)
    check(
        await rows() == ['First', 'Diagram 3']
        and await pg.locator('.tb-title h1').inner_text() == 'Diagram 3',
        'deleting another diagram leaves you where you were: ' + str(await rows()),
    )
    # Diagram 1 (First) keeps its point
    await pg.click('.diagrams .item >> nth=0')
    await pg.wait_for_timeout(100)
    check(
        'Point() → A' in await pg.locator('#log').inner_text(),
        'the renamed diagram keeps its construction',
    )


run(main)
