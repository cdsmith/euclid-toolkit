# A tool made with another tool keeps using it, and still works once that tool is taken out of the
# toolbox.
from harness import check, open_page, run, saved_state, settle


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await settle(pg)
    st = await pg.locator('#stage').bounding_box()
    x, y = st['x'] + st['width'] / 2, st['y'] + st['height'] / 2
    A, B, T, U, ON = (x - 80, y), (x + 80, y), (x, y - 138.564), (x, y + 138.564), (x, y + 60)
    use = lambda i: pg.click(f'[data-act=tool-use][data-id={i}]')

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*q)
            await settle(pg)

    S = lambda: saved_state(pg)
    # Perp: the perpendicular bisector of A and B, built by hand
    await use('point')
    await clicks(A, B)
    await use('circle')
    await clicks(A, B, B, A)
    await use('point')
    await clicks(T, U)
    await use('line')
    await clicks(T, U)
    await pg.keyboard.press('Escape')

    async def define(ins, out, name):
        await pg.click('[data-act=def-start]')
        await clicks(*ins)
        await pg.click('[data-act=def-next]')
        await clicks(out)
        await pg.click('[data-act=def-next]')
        await pg.fill('#toolName', name)
        await pg.click('[data-act=def-save]')
        await settle(pg)

    await define([A, B], ON, 'Perp')
    perp = next(t for t in (await S())['tools'] if t['name'] == 'Perp')
    # on a new diagram, Perp2 is defined from a use of Perp
    await pg.click('[data-act=diagram-new]')
    await settle(pg)
    await use('point')
    await clicks(A, B)
    await use(perp['id'])
    await clicks(A, B)
    await pg.keyboard.press('Escape')
    await define([A, B], ON, 'Perp2')
    p2 = next(t for t in (await S())['tools'] if t['name'] == 'Perp2')
    ops = sorted(n['op'] for n in p2['graph']['nodes'].values())
    check(
        ops == ['input', 'input', 'tool']
        and [n['tool'] for n in p2['graph']['nodes'].values() if n['op'] == 'tool'] == [perp['id']],
        'Perp2 is saved as a use of Perp: ' + str(ops),
    )
    await pg.click(f"[data-act=tool-more][data-id={p2['id']}]")
    await settle(pg)
    recipe = await pg.locator('.tdetail .recipe').inner_text()
    check(recipe.startswith('ℓ₁: Perp(A, B)'), 'its recipe says so: ' + recipe.replace('\n', ' | '))
    # removing Perp from the toolbox keeps it, out of sight, for Perp2
    await pg.click(f"[data-act=tool-more][data-id={perp['id']}]")
    await pg.click(f"[data-act=tool-remove][data-id={perp['id']}]")
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    await pg.click('[data-act=diagram-new]')
    await settle(pg)
    await use('point')
    await clicks(A, (x + 40, y + 30))
    await use(p2['id'])
    await clicks(A, (x + 40, y + 30))
    await settle(pg)
    check(
        any('Perp2' in r for r in await pg.locator('.log li').all_inner_texts()),
        'Perp2 still works: ' + str(await pg.locator('.log li').all_inner_texts()),
    )
    # editing Perp2 lays out its one step, the use of Perp
    await pg.click(f"[data-act=tool-more][data-id={p2['id']}]")
    await pg.click(f"[data-act=tool-edit][data-id={p2['id']}]")
    await settle(pg)
    r = await pg.locator('.log li .txt').all_inner_texts()
    check(len(r) == 1 and r[0].startswith('Perp('), 'editing Perp2 shows its one step: ' + str(r))
    await pg.click('[data-act=edit-save]')
    await settle(pg)
    await pg.click('[data-act=def-save]')
    await settle(pg)
    check(not await pg.locator('#defSec .err').count(), 'and saves back unchanged')


run(main)
