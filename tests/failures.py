# When things outside the app fail, it says so. If the lessons can't be fetched, the page says they
# didn't load. If saving fails (the browser's storage is full), it says your work isn't being saved,
# once, not on every change. Fills localStorage to the last byte.
from harness import check, open_page, run, watch, URL

FILL = """() => {
    let i = 0
    for (let k = 20; k >= 0; k--) {
      const s = 'x'.repeat(1 << k)
      try {
        for (;;) localStorage.setItem('fill' + i++, s)
      } catch (e) {}
    }
  }"""


async def main(b):
    pg = watch(await b.new_page(viewport={'width': 1440, 'height': 900}))
    await pg.route('**/lessons/**', lambda r: r.abort())
    await pg.goto(URL)
    await pg.wait_for_timeout(300)
    check(
        await pg.locator('#home').is_visible()
        and "The lessons didn’t load" in await pg.locator('#home').inner_text(),
        'lessons that fail to load: the page says so',
    )
    await pg.unroute('**/lessons/**')
    await pg.route('**/lessons/euclid.json', lambda r: r.fulfill(status=404, body='not found'))
    await pg.reload()
    await pg.wait_for_timeout(300)
    check(
        "The lessons didn’t load" in await pg.locator('#home').inner_text(),
        'and so does one that is missing',
    )
    await pg.close()

    pg = await open_page(b)
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(150)
    st = await pg.locator('#stage').bounding_box()
    await pg.click('[data-act=tool-use][data-id=point]')
    await pg.mouse.click(st['x'] + 300, st['y'] + 300)
    await pg.wait_for_timeout(100)
    check(await pg.locator('#toast').is_hidden(), 'while saving works, nothing is said')
    await pg.evaluate(FILL)
    await pg.mouse.click(st['x'] + 400, st['y'] + 300)
    await pg.wait_for_timeout(100)
    check(
        "isn't being saved" in await pg.locator('#toast').inner_text(),
        'when saving fails, the page says so',
    )
    await pg.wait_for_timeout(3000)
    await pg.mouse.click(st['x'] + 500, st['y'] + 300)
    await pg.wait_for_timeout(100)
    check(await pg.locator('#toast').is_hidden(), 'and not again on every change after that')
    await pg.evaluate(
        """Object.keys(localStorage)
            .filter((k) => k.startsWith('fill'))
            .forEach((k) => localStorage.removeItem(k))"""
    )
    await pg.mouse.click(st['x'] + 600, st['y'] + 300)
    await pg.wait_for_timeout(100)
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.click('[data-act=card-open] >> nth=0')
    await pg.wait_for_timeout(200)
    check(
        len(await pg.locator('#log li').all()) == 4,
        'once there is room again, the next change saves all the work: '
        + str(await pg.locator('#log li').all_inner_texts()),
    )


run(main)
