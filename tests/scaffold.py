# An exercise's scaffold and elaboration: picked after the givens and after the goals, each built
# from the givens alone, the scaffold not from a goal. Trying it, the scaffold is there to build on,
# and the elaboration appears once it's solved.
import json, math
from harness import URL, check, run, saved_work, serve_libs, watch, saved_state

# green pixels on the canvas: solved goals and the elaboration are drawn in --ok
GREEN = """(() => {
    const cv = document.querySelector('#stage canvas'),
      d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4)
      if (
        Math.abs(d[i] - 42) < 30 &&
        Math.abs(d[i + 1] - 132) < 30 &&
        Math.abs(d[i + 2] - 80) < 30
      )
        n++
    return n
  })()"""


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
    await serve_libs(ctx)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    st = await pg.locator('#stage').bounding_box()
    at = lambda q: (st['x'] + q[0], st['y'] + q[1])

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*at(q))
            await pg.wait_for_timeout(40)

    async def S():

        return (await saved_state(pg))['notebooks'][0]['diagrams'][0]

    err = lambda: pg.locator('#defSec .err').inner_text()

    # ---- A and B, the two circles, C where they meet, the circle about C through A; and line FA,
    # from free F
    r = 130
    cx, cy = st['width'] / 2, st['height'] / 2 + 60
    A, B = (cx - r / 2, cy), (cx + r / 2, cy)
    C = (cx, cy - r * math.sqrt(3) / 2)
    F = (A[0] - 60, A[1] + 110)
    await pg.keyboard.press('1')
    await clicks(A, B)
    await pg.keyboard.press('3')
    await clicks(A, B, B, A)
    await pg.keyboard.press('1')
    await clicks(C)
    await pg.keyboard.press('3')
    await clicks(C, A)
    await pg.keyboard.press('1')
    await clicks(F)
    await pg.keyboard.press('2')
    await clicks(F, A)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(50)
    onA, onB, around, onFA = (
        (A[0] - r, A[1]),
        (B[0] + r, B[1]),
        (C[0], C[1] - r),
        ((F[0] + A[0]) / 2, (F[1] + A[1]) / 2),
    )

    # ---- making it an exercise
    await pg.click('[data-act=exercise-mark]')
    await pg.wait_for_timeout(50)
    names = []
    for k in range(5):
        names.append(
            (await pg.locator('.def-step b').inner_text()).title()
            + ' '
            + await pg.locator('.def-step span').inner_text()
        )
        if k < 4:
            (
                await pg.click('[data-act=def-next]')
                if k
                else (await clicks(A, B), await pg.click('[data-act=def-next]'))
            )
        if k == 1:
            await clicks(C)
    check(
        names
        == ['Givens 1 of 5', 'Scaffold 2 of 5', 'Goals 3 of 5', 'Elaboration 4 of 5', 'Tool 5 of 5']
        and await pg.locator('.def-steps span').count() == 5,
        'the steps: givens, scaffold, goals, elaboration, tool: ' + str(names),
    )
    await pg.click('[data-act=def-cancel]')
    await pg.click('[data-act=exercise-mark]')
    await pg.wait_for_timeout(50)
    await clicks(A, B)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    check(
        'scaffold' in (await pg.locator('#prompt').inner_text())
        and 'SCAFFOLD' in (await pg.locator('.def-step b').inner_text()).upper(),
        'then the scaffold',
    )
    await clicks(onFA)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    check(
        "isn't built from the givens alone" in await err(),
        'a scaffold not built from the givens is refused: ' + await err(),
    )
    await pg.click('[data-act=def-drop][data-id]  >> nth=-1')
    await clicks(onA, onB, around)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    await clicks(A)
    check(
        (await pg.locator('.toast').last.inner_text()).endswith('is already a given.'),
        'a given can\'t be a goal too',
    )
    await clicks(C)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    check(
        'built from the goal' in await err(),
        'a scaffold built from a goal is refused: ' + await err(),
    )
    await pg.click('[data-act=def-back]')
    await pg.click('[data-act=def-drop][data-id]  >> nth=-1')
    await pg.wait_for_timeout(30)
    check(
        await pg.locator('#defSec .chip').count() == 2,
        'back at the scaffold, the circle about C is dropped',
    )
    await pg.click('[data-act=def-next]')
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    check(
        'ELABORATION' in (await pg.locator('.def-step b').inner_text()).upper(),
        'the goal kept, on to the elaboration',
    )
    await clicks(around)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(80)
    ex = (await S())['exercise']
    check(
        [len(ex[k]) for k in ('givens', 'scaffold', 'goals', 'elaboration')] == [2, 2, 1, 1]
        and 'error' not in ex,
        'saved: ' + json.dumps(ex),
    )
    await pg.click('[data-act=exercise-mark]')
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(30)
    check(await pg.locator('#defSec .chip').count() == 2, 'editing it keeps the scaffold')
    await pg.click('[data-act=def-cancel]')

    # ---- trying it: the scaffold is there, and the elaboration comes with the solution
    dg = (await S())['id']
    doc = await saved_work(pg, dg)
    wA, wB = [doc['nodes'][doc['elems'][e]['node']] for e in ex['givens']]
    await pg.click('[data-act=exercise-try]')
    await pg.wait_for_timeout(200)
    t = await pg.locator('#stage').bounding_box()
    W, H = t['width'], t['height']
    R = math.dist((wA['x'], wA['y']), (wB['x'], wB['y']))
    s = max(
        0.2, min((W - 40) / (max(3 * R, 180) * 1.75), (H - 70) / (max(2 * R, 180) * 1.75))
    )  # as fitView does, around A, B and the circles
    vx, vy = (wA['x'] + wB['x']) / 2, (wA['y'] + wB['y']) / 2 + 20 / s
    wC = ((wA['x'] + wB['x']) / 2, (wA['y'] + wB['y']) / 2 - R * math.sqrt(3) / 2)
    sC = (t['x'] + (wC[0] - vx) * s + W / 2, t['y'] + (wC[1] - vy) * s + H / 2)
    g0 = await pg.evaluate(GREEN)
    check(
        g0 < 30 and 'Not found yet' in await pg.locator('#titleblock').inner_text(),
        'trying it, nothing is green yet: ' + str(g0),
    )
    await pg.keyboard.press('1')
    await pg.mouse.click(*sC)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(1000)
    tb = await pg.locator('#titleblock').inner_text()
    g1 = await pg.evaluate(GREEN)
    check(
        'SOLVED' in tb and await pg.locator('#log li').count() == 1,
        'a point where the scaffold circles meet solves it: ' + tb.replace('\n', ' | '),
    )
    check(g1 > 500, 'and the elaboration appears with it: ' + str(g1) + ' green pixels')
    await pg.screenshot(path='scaffold-solved.png')
    await pg.click('[data-act=undo]')
    await pg.wait_for_timeout(100)
    check(await pg.evaluate(GREEN) < 30, 'undone, it goes again')
    await pg.click('[data-act=try-end]')
    await pg.wait_for_timeout(100)


run(main)
