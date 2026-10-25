from harness import URL, check, folds, run, serve_libs, watch


async def main(b):
    pg = watch(await b.new_page(viewport={'width': 1440, 'height': 900}))
    await serve_libs(pg)
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(300)
    check(
        'Arithmetic' in await pg.locator('#nav').inner_text()
        and '13 problems' in await pg.locator('#nav').inner_text(),
        'the lesson is listed',
    )
    await pg.click('[data-act=card-open][data-id=arithmetic]')
    await pg.wait_for_timeout(150)
    heads = [h.strip() for h in await pg.locator('.card.is-open .tier h4').all_text_contents()]
    check(heads == ['IAdding', 'IIMultiplying', 'IIIRoots'], 'its sections: ' + str(heads))
    check(
        await pg.locator('.tname').all_inner_texts()
        == [
            'Point',
            'Line',
            'Circle',
            'Parallel',
            'Perpendicular',
            'Midpoint',
            'Transfer distance',
        ],
        'its toolbox: ' + str(await pg.locator('.tname').all_inner_texts()),
    )
    check(
        await pg.locator('.tsig').all_inner_texts()
        == [
            'anywhere → P',
            'A, B → line',
            'O, A → circle',
            'ℓ, P → line',
            'ℓ, P → line',
            'A, B → M',
            'A, B, C → circle',
        ],
        'signatures: ' + str(await pg.locator('.tsig').all_inner_texts()),
    )
    tb = await pg.locator('#titleblock').inner_text()
    check(
        'Two and Three' in tb
        and 'is a number line' in tb
        and '$' not in tb
        and await pg.locator('.tb-text > p math').count() == 3,
        'the first problem, its names as math: ' + tb.replace('\n', ' | '),
    )
    await pg.screenshot(path='arithmetic-first.png')
    hints = lambda: folds(pg)
    opens = lambda k: pg.click(f'#titleblock details.fold >> nth={k} >> summary')
    h = await hints()
    check(len(h) == 1 and h[0][:3] == ['Hint', True, False], 'one hint, folded: ' + str(h))
    await opens(0)
    await pg.wait_for_timeout(30)
    check((await hints())[0][2], 'it opens')
    await opens(0)
    await pg.wait_for_timeout(30)
    check(not (await hints())[0][2], 'and folds again')
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=9')
    await pg.wait_for_timeout(150)
    h = await hints()
    check(
        [x[:3] for x in h] == [['Hint', True, False], ['Hint', True, False]],
        'Square Root: two hints, both folded: ' + str(h),
    )
    await opens(0)
    await pg.wait_for_timeout(30)
    h = await hints()
    check(
        'The perpendicular from the hypotenuse' in h[0][3] and h[1][:3] == ['Hint', True, False],
        'the first opens on its own: ' + str(h),
    )
    await opens(1)
    await pg.wait_for_timeout(30)
    check(
        (await hints())[1][3] == 'A right angle lying on a circle subtends a diameter.',
        'then the second opens',
    )
    await pg.screenshot(path='arithmetic-hints.png')
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=0')
    await pg.wait_for_timeout(150)
    # Negatives, solved by clicking: a circle at O through A, and a point where it meets ℓ on the
    # far side
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=1')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / 315, (H - 70) / 315)
    S = lambda x, y: (st['x'] + (x + 12) * s + W / 2, st['y'] + (y - 50) * s + H / 2 - 20)
    await pg.click('[data-act=tool-use][data-id=circle]')
    await pg.mouse.click(*S(-60, 50))
    await pg.mouse.click(*S(36, 50))
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*S(-156, 50))
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)
    check('SOLVED' in await pg.locator('#titleblock').inner_text(), 'Negatives solved by hand')
    await pg.click('[data-act=solution-save]')
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(80)
    check(
        'Negate' in await pg.locator('.tname').all_inner_texts(),
        'and saved as a tool alongside the given ones',
    )
    # Perpendicular at a point on the line, in Root Two
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=8')
    await pg.wait_for_timeout(150)
    check('Root Two' in await pg.locator('#titleblock').inner_text(), 'Root Two opens')
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / 315, (H - 70) / 315)
    S = lambda x, y: (st['x'] + (x + 40) * s + W / 2, st['y'] + (y - 50) * s + H / 2 - 20)
    await pg.click('[data-act=tool-use][data-id="arithmetic.perpendicular"]')
    await pg.mouse.click(*S(40, 50))
    await pg.mouse.click(*S(-20, 50))
    await pg.wait_for_timeout(100)
    check(
        any('Perpendicular(ℓ, U)' in r for r in await pg.locator('#log li').all_inner_texts()),
        'the perpendicular at U on ℓ: ' + str(await pg.locator('#log li').all_inner_texts()),
    )
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=goal-toggle]') if False else None
    await pg.screenshot(path='arithmetic-root2.png')
    # names are math: in Euclid's first problem, A, B and C; in the perpendicular problem's hint, P
    # and ℓ, the article A not
    await pg.click('[data-act=card-open][data-id=euclid]')
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('.tb-text > p math').count() == 5,
        'point names are math: ' + str(await pg.locator('.tb-text > p math').count()),
    )
    await pg.click('.card.is-open [data-act=sheet-open] >> nth=3')
    await opens(0)
    await pg.wait_for_timeout(50)
    check(
        (await pg.locator('.fold-body').inner_text()).startswith('A circle centered at')
        and await pg.locator('.fold-body math').count() == 3,
        'an article A in Euclid: ' + (await pg.locator('.fold-body').inner_html())[:120],
    )


run(main)
