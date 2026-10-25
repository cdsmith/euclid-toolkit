# Dragging a point brings along the hidden points that only serve to fix lines and circles built
# from it: a given circle about O keeps its radius, and Rotate's ℓ through O keeps its direction. A
# visible point stays put.
import json, subprocess, math
from harness import check, open_page, run, saved_state, saved_work


def at(n):
    return (n['x'], n['y']) if 'x' in n else (n['val']['x'], n['val']['y'])


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=card-open][data-id=straightedge]')
    await pg.wait_for_timeout(150)

    async def drag_on(pid, frm, to):
        await pg.click(f".card.is-open [data-act=sheet-open][data-id='{pid}']")
        await pg.wait_for_timeout(200)
        f = json.loads(
            subprocess.run(['node', 'fit.js', pid], capture_output=True, text=True).stdout
        )
        st = await pg.locator('#stage').bounding_box()
        W, H = st['width'], st['height']
        s = min((W - 40) / (f['bw'] * 1.75), (H - 70) / (f['bh'] * 1.75))
        S = lambda q: (
            st['x'] + (q[0] - f['cx']) * s + W / 2,
            st['y'] + (q[1] - f['cy']) * s + H / 2 - 20,
        )
        await pg.mouse.move(*S(frm))
        await pg.mouse.down()
        for k in range(1, 11):
            await pg.mouse.move(
                *S((frm[0] + (to[0] - frm[0]) * k / 10, frm[1] + (to[1] - frm[1]) * k / 10))
            )
        await pg.mouse.up()
        await pg.wait_for_timeout(100)
        return await saved_work(pg, pid)

    # Parallel: ω is about O, through a hidden point
    d = await drag_on('straightedge.parallel', (-170, -110), (-110, -70))
    c = next(n for n in d['nodes'].values() if n['op'] == 'circle')
    o, r = (d['nodes'][d['elems'][e]['node']] for e in c['ins'])
    check(math.dist(at(o), (-110, -70)) < 1.5, 'O went where it was dragged: ' + str(at(o)))
    check(
        abs(math.dist(at(o), at(r)) - 35) < 1e-6,
        'and ω kept its radius: ' + str(math.dist(at(o), at(r))),
    )
    # Rotate: ℓ goes through O and a hidden point, and keeps its direction
    await pg.click(".card.is-open [data-act=sheet-open][data-id='straightedge.rotate']")
    await pg.wait_for_timeout(200)
    d = await drag_on('straightedge.rotate', (-170, -110), (-130, -150))
    ln = next(
        n
        for n in d['nodes'].values()
        if n['op'] == 'line' and d['elems'][n['outs'][0]]['label'] == 'ℓ'
    )
    o, h = (d['nodes'][d['elems'][e]['node']] for e in ln['ins'])
    ang = math.atan2(at(h)[1] - at(o)[1], at(h)[0] - at(o)[0])
    want = math.atan2(-62 + 110, -185 + 170)
    check(
        abs(ang - want) < 1e-9 and math.dist(at(o), (-130, -150)) < 1.5,
        f'ℓ slid with O and kept its direction: {ang:.6f} vs {want:.6f}',
    )
    # Undo puts both back
    await pg.keyboard.press('Control+z')
    await pg.wait_for_timeout(100)
    d = json.loads(
        await pg.evaluate("localStorage.getItem('euclid-toolkit:work:straightedge.rotate')")
    )['doc']
    o, h = (d['nodes'][d['elems'][e]['node']] for e in ln['ins'])
    check(at(o) == (-170, -110) and at(h) == (-185, -62), 'Undo puts O and the hidden point back')
    # A circle through a visible point changes size: the point stays put
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(100)
    st = await pg.locator('#stage').bounding_box()
    q = lambda x, y: (st['x'] + x, st['y'] + y)
    await pg.keyboard.press('1')
    await pg.mouse.click(*q(300, 300))
    await pg.mouse.click(*q(400, 300))
    await pg.keyboard.press('3')
    await pg.mouse.click(*q(300, 300))
    await pg.mouse.click(*q(400, 300))
    await pg.keyboard.press('Escape')
    s = await saved_state(pg)
    i = s['notebooks'][0]['diagrams'][0]['id']
    doc = lambda: saved_work(pg, i)
    pts = lambda d: [
        at(n) for n in sorted(d['nodes'].values(), key=lambda n: n['seq']) if n['op'] == 'point'
    ]
    before = pts(await doc())
    await pg.mouse.move(*q(300, 300))
    await pg.mouse.down()
    await pg.mouse.move(*q(330, 320), steps=5)
    await pg.mouse.up()
    await pg.wait_for_timeout(100)
    after = pts(await doc())
    check(
        after[1] == before[1] and after[0] != before[0],
        'a circle through a visible point: that point stays put: '
        + str(before)
        + ' -> '
        + str(after),
    )


run(main)
