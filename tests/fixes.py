# Two fixed bugs: a label typed just before clicking a swatch was lost, and a tool being edited lost
# its output when that was deleted and brought back with Undo.
from harness import check, open_page, run, saved_state


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    P1, P2 = (st['x'] + 300, st['y'] + 300), (st['x'] + 460, st['y'] + 340)
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=tool-use][data-id=line]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.keyboard.press('Escape')
    # label then click a swatch: both take effect
    await pg.click('.log li >> nth=0 >> .txt')
    await pg.fill('#selLabel', 'Q')
    await pg.click('[data-act=sel-color][data-id=red]')
    await pg.wait_for_timeout(100)
    e = await pg.evaluate(
        """() => {
            const w = JSON.parse(
              localStorage.getItem(
                'euclid-toolkit:work:' +
                  document.querySelector('.diagrams .is-current').dataset.id,
              ),
            )
            return Object.values(w.doc.elems).find((x) => x.label === 'Q')
          }"""
    )
    check(
        e is not None
        and e.get('style') == {'color': 'red'}
        and await pg.locator('.sel .what').inner_text() == 'Q',
        'typing a label, then clicking a swatch, keeps both: ' + str(e),
    )
    await pg.click('[data-act=sel-clear]')
    # define a tool, edit it, delete its output, undo, save
    await pg.click('[data-act=def-start]')
    await pg.mouse.click(*P1)
    await pg.mouse.click(*P2)
    await pg.click('[data-act=def-next]')
    await pg.mouse.click((P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2)
    await pg.click('[data-act=def-next]')
    await pg.fill('#toolName', 'Join')
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(100)
    tid = (await saved_state(pg))['tools'][0]['id']
    await pg.click(f'[data-act=tool-more][data-id="{tid}"]')
    await pg.click(f'[data-act=tool-edit][data-id="{tid}"]')
    await pg.wait_for_timeout(150)
    await pg.click('.log li >> nth=0 >> [data-act=row-del]')
    await pg.wait_for_timeout(50)
    await pg.click('[data-act=undo]')
    await pg.click('[data-act=edit-save]')
    await pg.wait_for_timeout(100)
    check(
        await pg.locator('#defSec .sig').count() == 1
        and await pg.locator('#defSec .err').count() == 0,
        "editing a tool, deleting its output and undoing, it saves with its output",
    )
    await pg.close()


run(main)
