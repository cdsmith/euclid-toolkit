# Screenshots of solved problems, to look at their elaborations: each problem below, solved by its
# own solution (from all-solved.json, which solvedwork.js writes), on a contact sheet per lesson
# (reveal-<lesson>.png). Not a test: run node solvedwork.js, then python revealshot.py.
import json

from PIL import Image

from harness import open_page, run, seed, stage

SOLVED = json.load(open('all-solved.json'))
# fmt: off
LESSONS = {
    'compass': [
        'compass.mirror', 'compass.double', 'compass.invert', 'compass.midpoint', 'compass.third',
        'compass.foot', 'compass.line-circle', 'compass.two-lines',
    ],
    'straightedge': [
        'straightedge.midpoint-parallel', 'straightedge.parallelogram', 'straightedge.rotate',
        'straightedge.scale', 'straightedge.copy', 'straightedge.line-circle',
    ],
    'euclid': [
        'equilateral', 'perp-bisector', 'mirror', 'circumcircle', 'tangents', 'hexagon',
        'square-in-circle', 'square-on-segment', 'pentagon',
    ],
}
# fmt: on
COLUMNS = 3


async def main(b):
    pg = await open_page(b)
    await seed(pg, {}, SOLVED)
    for lesson, problems in LESSONS.items():
        await pg.click(f'[data-act=card-open][data-id={lesson}]')
        await pg.wait_for_timeout(150)
        shots = []
        for problem in problems:
            await pg.click(f"[data-act=sheet-open][data-id='{problem}']")
            await pg.wait_for_timeout(250)
            box = await stage(pg)
            shot = f'rv-{problem}.png'
            clip = {
                'x': box['x'],
                'y': box['y'],
                'width': box['width'],
                'height': box['height'] - 40,
            }
            await pg.screenshot(path=shot, clip=clip)
            shots.append(Image.open(shot))
        w, h = shots[0].width // 2, shots[0].height // 2
        rows = (len(shots) + COLUMNS - 1) // COLUMNS
        sheet = Image.new('RGB', (w * COLUMNS, h * rows), 'white')
        for n, im in enumerate(shots):
            sheet.paste(im.resize((w, h)), ((n % COLUMNS) * w, (n // COLUMNS) * h))
        sheet.save(f'reveal-{lesson}.png')


run(main)
