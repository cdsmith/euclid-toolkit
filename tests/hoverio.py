# Pointing at a row in the construction list highlights what it takes as well as what it makes, in
# another color.
from harness import check, open_page, run


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    st = await pg.locator('#stage').bounding_box()
    x, y = st['x'] + st['width'] / 2, st['y'] + st['height'] / 2
    A, B = (x - 80, y), (x + 80, y)
    await pg.keyboard.press('1')
    await pg.mouse.click(*A)
    await pg.mouse.click(*B)
    await pg.keyboard.press('3')
    await pg.mouse.click(*A)
    await pg.mouse.click(*B)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(80)
    row = pg.locator('#log li >> nth=2')
    check(
        await row.get_attribute('data-in')
        == await pg.locator('#log li >> nth=0').get_attribute('data-hi')
        + ' '
        + await pg.locator('#log li >> nth=1').get_attribute('data-hi'),
        "the circle's row lists what it takes: its center A and the point B it goes through",
    )
    # the color 7 pixels right of a point on the page
    px = lambda q: pg.evaluate(
        """([x, y]) => {
          const c = document.querySelector('#stage canvas')
          const r = c.getBoundingClientRect()
          const at = (v) => Math.round(v * devicePixelRatio)
          const d = c.getContext('2d').getImageData(at(x - r.x + 7), at(y - r.y), 1, 1).data
          return [d[0], d[1], d[2]]
        }""",
        list(q),
    )
    before = await px(A)
    await row.hover()
    await pg.wait_for_timeout(80)
    a, bb = await px(A), await px(B)
    blueish = lambda c: c[2] > c[0] + 20
    check(
        before != a and blueish(a) and blueish(bb),
        f'pointing at it rings A and B in the input color: {before} -> {a}, {bb}',
    )
    await pg.screenshot(path='hover-io.png')


run(main)
