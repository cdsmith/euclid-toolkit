# A lesson's toolbox can be reordered by dragging, and resetting the lesson puts it back.
from reorder import drag
from harness import check, open_page, run, settle


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=card-open][data-id=euclid]')
    await settle(pg)
    tools = lambda: pg.locator('.tname').all_inner_texts()
    check(
        await tools() == ['Point', 'Line', 'Circle'], 'the lesson starts with Point, Line, Circle'
    )
    await drag(pg, '[data-drag=tool] >> nth=2', '[data-drag=tool] >> nth=0')
    check(
        await tools() == ['Circle', 'Point', 'Line'],
        'dragging Circle to the top moves it there: ' + str(await tools()),
    )
    await pg.click('[data-act=lesson-reset]')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check(
        await tools() == ['Point', 'Line', 'Circle'],
        'resetting the lesson puts its tools back in order: ' + str(await tools()),
    )


run(main)
