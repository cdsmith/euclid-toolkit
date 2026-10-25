# Dragging is stateless. On Copy a Length, X is where ℓ meets a line AY, and a crossing of line OX
# with ω is picked. Dragging Y halfway around A sends X off through infinity, which turns line OX
# around, so the crossing picked by index moves to the other end of the diameter. Afterwards the
# saved construction is as it was, apart from where Y is.
import json, subprocess, math
from harness import check, open_page, run


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=card-open][data-id=straightedge]')
    await pg.wait_for_timeout(150)
    await pg.click(".card.is-open [data-act=sheet-open][data-id='straightedge.copy']")
    await pg.wait_for_timeout(200)
    f = json.loads(
        subprocess.run(
            ['node', 'fit.js', 'straightedge.copy'], capture_output=True, text=True
        ).stdout
    )
    st = await pg.locator('#stage').bounding_box()
    W, H = st['width'], st['height']
    s = min((W - 40) / (f['bw'] * 1.75), (H - 70) / (f['bh'] * 1.75))
    S = lambda q: (
        st['x'] + (q[0] - f['cx']) * s + W / 2,
        st['y'] + (q[1] - f['cy']) * s + H / 2 - 20,
    )
    O, P, R = (-170, -110), (20, 0), (170, 0)  # R: a second point of ℓ, for working out X
    A, Y = (0, 40), (120, -20)

    def meet(p1, p2, q1, q2):
        d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0])
        t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))

    X = meet(A, Y, P, R)
    u = ((X[0] - O[0]) / math.dist(O, X), (X[1] - O[1]) / math.dist(O, X))
    V = (O[0] + 35 * u[0], O[1] + 35 * u[1])

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*S(q))
            await pg.wait_for_timeout(40)

    await pg.click('[data-act=tool-use][data-id=point]')
    await clicks(Y)
    await pg.click('[data-act=tool-use][data-id=line]')
    await clicks(A, Y)
    await pg.click('[data-act=tool-use][data-id=point]')
    await clicks(X)
    await pg.click('[data-act=tool-use][data-id=line]')
    await clicks(O, X)
    await pg.click('[data-act=tool-use][data-id=point]')
    await clicks(V)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)
    work = lambda: pg.evaluate(
        'JSON.parse(localStorage.getItem("euclid-toolkit:work:straightedge.copy")).doc'
    )
    before = await work()
    check(
        sum(n['op'] == 'isect' and not n.get('given') for n in before['nodes'].values()) == 2,
        'X and a crossing of line OX with ω are picked',
    )
    r0, a0 = math.dist(A, Y), math.atan2(Y[1] - A[1], Y[0] - A[0])
    await pg.mouse.move(*S(Y))
    await pg.mouse.down()
    for k in range(1, 181):
        a = a0 + k * math.pi / 180
        await pg.mouse.move(*S((A[0] + r0 * math.cos(a), A[1] + r0 * math.sin(a))))
    await pg.mouse.up()
    await pg.wait_for_timeout(100)
    after = await work()
    yid = next(
        n['id']
        for n in before['nodes'].values()
        if not n.get('given') and n['op'] == 'point' and not n['ins']
    )
    strip = lambda d: {k: (dict(v, x=0, y=0) if k == yid else v) for k, v in d['nodes'].items()}
    moved = math.dist(
        (after['nodes'][yid]['x'], after['nodes'][yid]['y']), (2 * A[0] - Y[0], 2 * A[1] - Y[1])
    )
    check(moved < 3, f'Y went halfway around A ({moved:.2f} from where it should be)')
    check(
        strip(before) == strip(after),
        'after dragging Y halfway around A, the sheet is unchanged but for Y',
    )


run(main)
