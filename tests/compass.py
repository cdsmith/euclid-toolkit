from harness import check, open_page, run, settle


def reflect(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    f = (a[0] + t * dx, a[1] + t * dy)
    return (2 * f[0] - p[0], 2 * f[1] - p[1])


async def main(b):
    pg = await open_page(b)
    check(
        'Compass Only' in await pg.locator('#nav').inner_text()
        and '11 problems' in await pg.locator('#nav').inner_text(),
        'the lesson is listed',
    )
    await pg.click('[data-act=card-open][data-id=compass]')
    await settle(pg)
    check(
        await pg.locator('.tname').all_inner_texts() == ['Point', 'Circle'],
        'its toolbox is Point and Circle: ' + str(await pg.locator('.tname').all_inner_texts()),
    )
    check(await pg.locator('[data-act=tool-import]').count() == 0, 'with nothing to import')
    heads = [h.strip() for h in await pg.locator('.card.is-open .tier h4').all_text_contents()]
    check(
        heads == ['IReflections', 'IIUsing Reflections', 'IIILines and Circles'],
        'its sections: ' + str(heads),
    )
    check(
        "no straightedge" in await pg.locator('#titleblock').inner_text(),
        'the first problem says the rule',
    )
    # Mirror, by hand: circles at A and B through P meet again at the reflection
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / (230 * 1.75), (H - 70) / (180 * 1.75))
    S = lambda q: (st['x'] + (q[0] + 5) * s + W / 2, st['y'] + q[1] * s + H / 2 - 20)
    A, B, P = (-120, 60), (110, 20), (-10, -60)
    await pg.click('[data-act=tool-use][data-id=circle]')
    for q in [A, P, B, P]:
        await pg.mouse.click(*S(q))
        await settle(pg)
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*S(reflect(P, A, B)))
    await pg.keyboard.press('Escape')
    await settle(pg)
    check('SOLVED' in await pg.locator('#titleblock').inner_text(), 'Mirror solved by hand')
    await pg.click('[data-act=solution-save]')
    await pg.click('[data-act=def-save]')
    await settle(pg)
    check(
        await pg.locator('.tname').all_inner_texts() == ['Point', 'Circle', 'Reflect across a line']
        and await pg.locator('.tsig >> nth=2').inner_text() == 'A, B, P → C',
        'and earns Mirror: ' + await pg.locator('.tsig >> nth=2').inner_text(),
    )
    await pg.screenshot(path='compass-mirror.png')
    # a later problem's hints
    await pg.click('.card.is-open [data-act=sheet-open][data-id="compass.line-circle"]')
    await settle(pg)
    await pg.click('#titleblock details.fold >> nth=0 >> summary')
    await pg.click('#titleblock details.fold >> nth=1 >> summary')
    await settle(pg)
    check(
        await pg.locator('.fold-body >> nth=1').inner_text()
        == 'A circle is fixed by its center and one of its points.',
        'Line Meets Circle hints',
    )
    await pg.screenshot(path='compass-line-circle.png')
    await pg.click(".card.is-open [data-act=sheet-open][data-id='compass.center']")
    await settle(pg)
    check(
        'Napoleon' in await pg.locator('#titleblock').inner_text(),
        'Find the Center is Napoleon’s problem',
    )
    await pg.screenshot(path='compass-center.png')


run(main)
