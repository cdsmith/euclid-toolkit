from harness import check, open_page, run, saved_state


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    st = await pg.locator('#stage').bounding_box()
    x, y = st['x'] + st['width'] / 2, st['y'] + st['height'] / 2
    A, B, T, U, ON = (x - 80, y), (x + 80, y), (x, y - 138.564), (x, y + 138.564), (x, y + 60)
    use = lambda i: pg.click(f'[data-act=tool-use][data-id={i}]')

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*q)
            await pg.wait_for_timeout(30)

    await use('point')
    await clicks(A, B)
    await use('circle')
    await clicks(A, B, B, A)
    await use('point')
    await clicks(T, U)
    await use('line')
    await clicks(T, U)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=def-start]')
    await clicks(A, B)
    await pg.click('[data-act=def-next]')
    await clicks(ON)
    await pg.click('[data-act=def-next]')
    await pg.fill('#toolName', 'Perp')
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(100)
    perp = (await saved_state(pg))['tools'][0]['id']
    await pg.click('[data-act=diagram-new]')
    await pg.wait_for_timeout(100)
    await use('point')
    await clicks(A, B)
    await use(perp)
    await clicks(A, B)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(50)
    btn = lambda k, m: pg.locator(f'#log li:not(.inside) >> nth={k} >> [data-act=row-{m}]')

    async def mode(k):
        on = [
            m
            for m in ['show', 'hide', 'detail']
            if await btn(k, m).count() and await btn(k, m).get_attribute('aria-pressed') == 'true'
        ]
        return on[0] if len(on) == 1 else on

    inner = lambda: pg.locator('#log li.inside').all_inner_texts()
    check(
        [await btn(k, 'detail').count() for k in range(3)] == [0, 0, 1]
        and await pg.locator('#log [data-act=row-show]').count() == 3
        and await pg.locator('#log [data-act=row-del]').count() == 3,
        'every row has Show and Hide, the tool use Detail too, and each has Delete',
    )
    check([await mode(k) for k in range(3)] == ['show'] * 3, 'all shown to start')
    await btn(2, 'detail').click()
    await pg.wait_for_timeout(80)
    check(
        len(await inner()) == 5
        and (await inner())[0] == 'ω₁: circle at A through B'
        and await mode(2) == 'detail',
        'Detail: its steps show under it: ' + str(await inner()),
    )
    await pg.screenshot(path='inside-on.png')
    await pg.locator('#log li.inside >> nth=2').hover()
    await pg.wait_for_timeout(50)
    await pg.screenshot(path='inside-hover.png')
    await pg.locator('#log li.inside >> nth=2').click()
    await pg.wait_for_timeout(50)
    check(
        await pg.locator('.sel').count() == 0,
        "clicking a step that isn't on the page selects nothing",
    )
    await pg.mouse.move(*A)
    await pg.mouse.down()
    await pg.mouse.move(A[0] - 20, A[1] + 30, steps=5)
    await pg.mouse.up()
    await pg.wait_for_timeout(80)
    check(len(await inner()) == 5, 'still in detail after dragging A')
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.click('[data-act=card-open] >> nth=0')
    await pg.wait_for_timeout(150)
    check(len(await inner()) == 5 and await mode(2) == 'detail', 'detail is saved with the diagram')
    await btn(2, 'hide').click()
    await pg.wait_for_timeout(50)
    check(
        len(await inner()) == 0
        and await mode(2) == 'hide'
        and 'is-hidden' in await pg.locator('#log li:not(.inside) >> nth=2').get_attribute('class'),
        'Hide',
    )
    await btn(2, 'detail').click()
    await pg.wait_for_timeout(50)
    check(
        len(await inner()) == 5
        and await mode(2) == 'detail'
        and 'is-hidden'
        not in await pg.locator('#log li:not(.inside) >> nth=2').get_attribute('class'),
        'straight from hidden to Detail',
    )
    await btn(2, 'show').click()
    await pg.wait_for_timeout(50)
    check(len(await inner()) == 0 and await mode(2) == 'show', 'Show')
    await btn(2, 'show').click()
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=undo]')
    await pg.wait_for_timeout(50)
    check(
        await mode(2) == 'detail',
        "clicking the mode already on changes nothing, so undo goes back past it",
    )
    await pg.click('[data-act=undo]')
    await pg.wait_for_timeout(50)
    check(await mode(2) == 'hide', 'and back again')
    await btn(0, 'hide').click()
    await pg.wait_for_timeout(50)
    check(await mode(0) == 'hide', 'a point row: hidden')
    await btn(0, 'show').click()
    await pg.wait_for_timeout(50)
    check(await mode(0) == 'show', 'and shown again')


run(main)
