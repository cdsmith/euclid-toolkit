# The goal is a soft band, and nothing else. On Parallel Line, with a large sheet (where a line
# drawn just off the sheet used to reach back onto it), what showing the goal changes is a band
# along one line: every changed pixel is near the line fitted through them.
from harness import URL, check, run, settle, watch


async def main(b):
    for w, h, dpr in ((2560, 1440, 1), (1440, 900, 2)):
        pg = watch(await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr))
        await pg.goto(URL)
        await pg.evaluate('localStorage.clear()')
        await pg.reload()
        await settle(pg)
        await pg.click('[data-act=card-open][data-id=euclid]')
        await settle(pg)
        await pg.click('.card.is-open [data-act=sheet-open] >> nth=5')
        await settle(pg)
        await pg.evaluate('document.fonts.ready')
        await pg.click('[data-act=goal-toggle]')
        await pg.click('[data-act=goal-toggle]')
        await settle(pg)
        await pg.evaluate(
            """const c = document.querySelector('#stage canvas')
              window.__on = c.getContext('2d').getImageData(0, 0, c.width, c.height).data"""
        )
        await pg.click('[data-act=goal-toggle]')
        await settle(pg)
        # the pixels showing the goal changed, the line through them, and how far the farthest is
        # from it
        n, far = await pg.evaluate(
            """() => {
                const c = document.querySelector('#stage canvas'),
                  off = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
                  on = window.__on
                const xs = [],
                  ys = []
                for (let i = 0; i < on.length; i += 4)
                  if (
                    Math.abs(on[i] - off[i]) +
                      Math.abs(on[i + 1] - off[i + 1]) +
                      Math.abs(on[i + 2] - off[i + 2]) >
                    6
                  ) {
                    xs.push((i / 4) % c.width)
                    ys.push(Math.floor(i / 4 / c.width))
                  }
                const n = xs.length,
                  mx = xs.reduce((a, b) => a + b, 0) / n,
                  my = ys.reduce((a, b) => a + b, 0) / n
                let sxx = 0,
                  syy = 0,
                  sxy = 0
                for (let i = 0; i < n; i++) {
                  sxx += (xs[i] - mx) ** 2
                  syy += (ys[i] - my) ** 2
                  sxy += (xs[i] - mx) * (ys[i] - my)
                }
                const a = Math.atan2(2 * sxy, sxx - syy) / 2,
                  ux = Math.cos(a),
                  uy = Math.sin(a)
                let far = 0
                for (let i = 0; i < n; i++)
                  far = Math.max(far, Math.abs(-(xs[i] - mx) * uy + (ys[i] - my) * ux))
                return [n, far]
              }"""
        )
        check(
            far < 40 * dpr,
            f'{w}x{h}@{dpr}: the goal changes only a band along its line '
            f'({n} pixels, the farthest {far:.0f} px off it)',
        )
        await pg.close()


run(main)
