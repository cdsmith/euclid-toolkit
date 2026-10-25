import math
from harness import check, open_page, run, settle


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    st = await pg.locator('#stage').bounding_box()
    A, B = (st['x'] + 330, st['y'] + 330), (st['x'] + 490, st['y'] + 330)
    rows = lambda: pg.locator('.log li .txt').all_inner_texts()
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*A)
    await pg.mouse.click(*B)
    await pg.keyboard.press('Escape')
    base = await rows()
    check(base == ['Point() → A', 'Point() → B'], 'two points: ' + str(base))

    # a helper point picked and then abandoned with Esc
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(st['x'] + 600, st['y'] + 200)
    await settle(pg)
    await pg.screenshot(path='pick-pending.png')
    await pg.keyboard.press('Escape')
    await settle(pg)
    check(await rows() == base, 'Esc drops the picked point')
    # abandoned by choosing another tool
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(st['x'] + 600, st['y'] + 200)
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.keyboard.press('Escape')
    check(await rows() == base, 'switching tools drops it too')
    # a circle on two new points is one step with both helpers
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(st['x'] + 600, st['y'] + 200)
    await pg.mouse.click(st['x'] + 650, st['y'] + 200)
    await pg.keyboard.press('Escape')
    r = await rows()
    check(
        len(r) == 5 and r[2:4] == ['Free point', 'Free point'] and r[4].startswith('Circle('),
        'circle with helpers: ' + str(r),
    )
    await pg.click('[data-act=undo]')
    await settle(pg)
    check(await rows() == base, 'one undo removes the circle and its helpers')
    # picking the same new point twice
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.mouse.click(st['x'] + 600, st['y'] + 200)
    await pg.mouse.click(st['x'] + 600, st['y'] + 200)
    await settle(pg)
    check(
        await rows() == base and 'two different points' in await pg.locator('#toast').inner_text(),
        'same pick twice: refused, nothing left',
    )
    await pg.keyboard.press('Escape')
    # circles A-B and B-A, then a line through both intersections, picked as new points
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(*A)
    await pg.mouse.click(*B)
    await pg.mouse.click(*B)
    await pg.mouse.click(*A)
    await pg.keyboard.press('Escape')
    mx, my, h = (A[0] + B[0]) / 2, A[1], (B[0] - A[0]) * math.sqrt(3) / 2
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.mouse.click(mx, my - h)
    await pg.mouse.click(mx, my + h)
    await pg.keyboard.press('Escape')
    await settle(pg)
    r = await rows()
    check(
        len(r) == 7
        and r[4].startswith('Where')
        and 'other than' in r[5]
        and r[6].startswith('Line('),
        'line through both intersections; the second is "other than" the first: ' + str(r[4:]),
    )
    # hovering a picked point previews from it
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(st['x'] + 700, st['y'] + 450)
    await pg.mouse.move(st['x'] + 700, st['y'] + 451)
    await settle(pg)
    await pg.keyboard.press('Escape')
    check(len(await rows()) == 7, 'nothing left behind after hovering and Esc')


run(main)
