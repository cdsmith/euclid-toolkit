from harness import check, open_page, run


def foot(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    return (a[0] + t * dx, a[1] + t * dy)


def cross(p1, p2, q1, q2):
    d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0])
    t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


async def main(b):
    pg = await open_page(b)
    names = [n.strip() for n in await pg.locator('#nav .card-name').all_text_contents()]
    check(
        names[:2] == ["Euclid's Constructions", 'Triangle Centers'],
        'it comes second among the lessons: ' + str(names),
    )
    await pg.click('[data-act=card-open][data-id=triangle]')
    await pg.wait_for_timeout(150)
    heads = [h.strip() for h in await pg.locator('.card.is-open .tier h4').all_text_contents()]
    check(
        heads == ['IThe Four Centers', 'IILines and Circles', 'IIIMore Centers']
        and await pg.locator('.card.is-open .item').count() == 11,
        'its sections and 11 problems: ' + str(heads),
    )
    check(
        await pg.locator('.tname').all_inner_texts()
        == ['Point', 'Line', 'Circle', 'Midpoint', 'Perpendicular', 'Angle bisector'],
        'its toolbox: ' + str(await pg.locator('.tname').all_inner_texts()),
    )
    # Orthocenter, by hand: two altitudes with Perpendicular, and a point where they cross
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=3')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / (200 * 1.75), (H - 70) / (180 * 1.75))
    S = lambda q: (st['x'] + (q[0] + 10) * s + W / 2, st['y'] + (q[1] + 13) * s + H / 2 - 20)
    A, B, C = (-110, 50), (90, 30), (32, -76)
    on = lambda p, q, t: (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*S(q))
            await pg.wait_for_timeout(40)

    await pg.click('[data-act=tool-use][data-id=line]')
    await clicks(B, C, C, A)
    await pg.click('[data-act=tool-use][data-id="triangle.perpendicular"]')
    await clicks(on(B, C, 0.3), A, on(C, A, 0.3), B)
    Hh = cross(A, foot(A, B, C), B, foot(B, C, A))
    await pg.click('[data-act=tool-use][data-id=point]')
    await clicks(Hh)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)
    check(
        'SOLVED' in await pg.locator('#titleblock').inner_text(),
        'Orthocenter solved by hand: ' + str(await pg.locator('#log li').all_inner_texts()),
    )
    await pg.click('[data-act=solution-save]')
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(80)
    check('Orthocenter' in await pg.locator('.tname').all_inner_texts(), 'and earns Orthocenter')
    await pg.screenshot(path='triangle-ortho.png')
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=10')
    await pg.wait_for_timeout(150)
    await pg.screenshot(path='triangle-feuerbach.png')
    check('Feuerbach' in await pg.locator('#titleblock').inner_text(), 'the last problem opens')


run(main)
