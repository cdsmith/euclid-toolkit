from reorder import drag
from harness import check, open_page, run, settle


async def main(b):
    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.click('[data-act=diagram-new]')
    await settle(pg)
    rows = lambda: pg.evaluate(
        """[...document.querySelectorAll('.diagrams > li')].map((li) =>
            li.classList.contains('section-row')
              ? '# ' + li.textContent.trim()
              : li.textContent.trim(),
          )"""
    )
    await pg.click('[data-act=section-new]')
    await pg.click('[data-act=section-new]')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', 'Diagram 2', '# Section 1', '# Section 2'],
        'two headings at the end: ' + str(await rows()),
    )
    await drag(pg, '.diagrams > li >> nth=2', '.diagrams > li >> nth=0')
    check(
        await rows() == ['# Section 1', 'Diagram 1', 'Diagram 2', '# Section 2'],
        'heading dragged to the top: ' + str(await rows()),
    )
    await drag(pg, '.diagrams > li >> nth=2', '.diagrams > li >> nth=3', after=True)
    check(
        await rows() == ['# Section 1', 'Diagram 1', '# Section 2', 'Diagram 2'],
        'diagram dragged under the second heading: ' + str(await rows()),
    )
    check(
        '2 diagrams' in await pg.locator('.card.is-open .card-meta').inner_text(),
        'headings are not counted as diagrams',
    )
    await pg.click('[data-act=section-rename] >> nth=1')
    await pg.fill('#nameInput', 'Circles')
    await pg.keyboard.press('Enter')
    await settle(pg)
    check(
        await rows() == ['# Section 1', 'Diagram 1', '# Circles', 'Diagram 2'],
        'renamed: ' + str(await rows()),
    )
    await pg.click('[data-act=section-delete] >> nth=0')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', '# Circles', 'Diagram 2'],
        'deleted a heading, its diagram stays: ' + str(await rows()),
    )
    await pg.click('[data-act=diagram-delete] >> nth=1')
    await pg.click('[data-act=confirm-yes]')
    await settle(pg)
    check(
        await rows() == ['Diagram 1', '# Circles']
        and await pg.locator('.tb-title h1').inner_text() == 'Diagram 1',
        'deleting the current last diagram opens the one before, skipping the heading',
    )
    check(
        await pg.locator('[data-act=diagram-delete]').count() == 0,
        "the only diagram can't be deleted, headings aside",
    )
    await pg.reload()
    await settle(pg)
    await pg.click('[data-act=card-open] >> nth=0')
    await settle(pg)
    check(await rows() == ['Diagram 1', '# Circles'], 'kept after reload')
    await pg.locator('.card.is-open').screenshot(path='sections.png')


run(main)
