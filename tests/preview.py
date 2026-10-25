# While a saved tool's inputs are picked, what it makes inside is drawn faintly under the mouse, as
# far as the inputs so far settle it. Perpendicular on line BC: with P under the mouse, its circle
# centered at P through its point on BC (a quarter of the way from B to C), and the rest. With P
# exactly that point (built as the midpoint of B and the midpoint of BC), that circle would have no
# radius, so Perpendicular puts its point elsewhere, and works.
from harness import check, open_page, run


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=card-open][data-id=triangle]')
    await pg.wait_for_timeout(150)
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=3')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / (200 * 1.75), (H - 70) / (180 * 1.75))
    S = lambda q: (st['x'] + (q[0] + 10) * s + W / 2, st['y'] + (q[1] + 13) * s + H / 2 - 20)
    B, C = (90, 30), (32, -76)

    # at 360 spots around a circle on screen, the darkest pixel within a pixel of each (r + g + b)
    def inked(c, r):
        return pg.evaluate(
            """([cx, cy, r]) => {
                const cv = document.querySelector('#stage canvas'),
                  g = cv.getContext('2d'),
                  k = cv.width / cv.getBoundingClientRect().width
                const box = cv.getBoundingClientRect(),
                  out = []
                for (let i = 0; i < 360; i++) {
                  const x = (cx - box.x + r * Math.cos((i * Math.PI) / 180)) * k,
                    y = (cy - box.y + r * Math.sin((i * Math.PI) / 180)) * k
                  const d = g.getImageData(Math.round(x) - 1, Math.round(y) - 1, 3, 3).data
                  let m = 765
                  for (let j = 0; j < d.length; j += 4)
                    m = Math.min(m, d[j] + d[j + 1] + d[j + 2])
                  out.push(m)
                }
                return out
              }""",
            [c[0], c[1], r],
        )

    await pg.click('[data-act=tool-use][data-id=line]')
    for q in (B, C):
        await pg.mouse.click(*S(q))
        await pg.wait_for_timeout(40)
    await pg.click('[data-act=tool-use][data-id="triangle.perpendicular"]')
    away, X = (-60, -40), (B[0] + (C[0] - B[0]) * 0.25, B[1] + (C[1] - B[1]) * 0.25)
    circle = (S(away), s * ((away[0] - X[0]) ** 2 + (away[1] - X[1]) ** 2) ** 0.5)
    await pg.mouse.move(*S(away))
    await pg.wait_for_timeout(60)
    before = await inked(*circle)
    await pg.mouse.click(*S((B[0] + (C[0] - B[0]) * 0.6, B[1] + (C[1] - B[1]) * 0.6)))
    await pg.wait_for_timeout(60)
    await pg.mouse.move(*S(away))
    await pg.wait_for_timeout(60)
    after = await inked(*circle)
    darker = sum(a < b - 30 for a, b in zip(after, before))
    check(
        darker > 100,
        'with BC picked and P under the mouse, its circle centered at P is drawn: '
        f'{darker} of 360 spots darker',
    )
    await pg.screenshot(path='preview-insides.png')
    await pg.keyboard.press('Escape')
    M = ((B[0] + C[0]) / 2, (B[1] + C[1]) / 2)
    await pg.click('[data-act=tool-use][data-id="triangle.midpoint"]')
    for q in (B, C, B, M):
        await pg.mouse.click(*S(q))
        await pg.wait_for_timeout(40)
    await pg.click('[data-act=tool-use][data-id="triangle.perpendicular"]')
    await pg.mouse.click(*S((B[0] + (C[0] - B[0]) * 0.6, B[1] + (C[1] - B[1]) * 0.6)))
    await pg.wait_for_timeout(40)
    await pg.mouse.move(*S(X))
    await pg.wait_for_timeout(60)
    await pg.screenshot(path='preview-moved.png')
    await pg.mouse.click(*S(X))
    await pg.wait_for_timeout(100)
    log = await pg.locator('#log').inner_text()
    check(
        'Perpendicular(' in log and await pg.locator('#toast').is_hidden(),
        'with P the midpoint of B and the midpoint of BC, Perpendicular works: '
        + log.replace('\n', ' '),
    )


run(main)
