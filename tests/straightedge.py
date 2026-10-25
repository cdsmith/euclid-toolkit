import json, subprocess
from harness import check, open_page, run


def cross(p1, p2, q1, q2):
    d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0])
    t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


async def main(b):
    pg = await open_page(b)
    names = [n.strip() for n in await pg.locator('#nav .card-name').all_text_contents()]
    check(
        names
        == [
            "Euclid's Constructions",
            'Triangle Centers',
            'Arithmetic',
            'Compass Only',
            'Straightedge Only',
        ],
        'the lessons: ' + str(names),
    )
    await pg.click('[data-act=card-open][data-id=straightedge]')
    await pg.wait_for_timeout(150)
    heads = [h.strip() for h in await pg.locator('.card.is-open .tier h4').all_text_contents()]
    check(
        heads == ['ILines Alone', 'IIOne Circle', 'IIITransformations', 'IVThe Missing Compass']
        and await pg.locator('.card.is-open .item:not(.is-diagram)').count() == 11,
        'its sections and 11 problems: ' + str(heads),
    )
    check(
        await pg.locator('.card.is-open .item.is-diagram').all_inner_texts()
        == ['◇\nA Trapezoid', '◇\nOne Circle']
        and (await pg.locator('#titleblock').inner_text()).startswith('DIAGRAM'),
        'it opens on the trapezoid diagram',
    )
    await pg.screenshot(path='straightedge-trapezoid.png')
    await pg.click('[data-act=next]')
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('#tools .tname').all_inner_texts() == ['Point', 'Line'],
        'its toolbox is Point and Line',
    )
    check(
        'only a straightedge' in await pg.locator('#titleblock').inner_text(),
        'the first problem says the rule',
    )
    # Midpoint from a Parallel, by hand
    await pg.click(".card.is-open [data-act=sheet-open][data-id='straightedge.midpoint-parallel']")
    await pg.wait_for_timeout(150)
    f = json.loads(
        subprocess.run(
            ['node', 'fit.js', 'straightedge.midpoint-parallel'], capture_output=True, text=True
        ).stdout
    )
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / (f['bw'] * 1.75), (H - 70) / (f['bh'] * 1.75))
    S = lambda q: (
        st['x'] + (q[0] - f['cx']) * s + W / 2,
        st['y'] + (q[1] - f['cy']) * s + H / 2 - 20,
    )
    A, B, C = (-100, 40), (100, 20), (-30, -50)
    C2 = (C[0] + 200, C[1] - 20)
    Sp = (-10, -130)
    A2, B2 = cross(Sp, A, C, C2), cross(Sp, B, C, C2)
    X = cross(A, B2, A2, B)
    M = cross(Sp, X, A, B)

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*S(q))
            await pg.wait_for_timeout(40)

    await pg.click('[data-act=tool-use][data-id=line]')
    await clicks(Sp, A, Sp, B, A, B2, A2, B, Sp, X, A, B)
    await pg.click('[data-act=tool-use][data-id=point]')
    await clicks(M)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)
    check(
        'SOLVED' in await pg.locator('#titleblock').inner_text(),
        'Midpoint from a Parallel solved by hand: '
        + str(len(await pg.locator('#log li').all_inner_texts()))
        + ' steps',
    )
    await pg.screenshot(path='straightedge-midpoint.png')
    await pg.click(".card.is-open [data-act=sheet-open][data-id='straightedge.line-circle']")
    await pg.wait_for_timeout(150)
    check('isn’t drawn' in await pg.locator('#titleblock').inner_text(), 'Line Meets Circle opens')
    await pg.screenshot(path='straightedge-last.png')


run(main)
