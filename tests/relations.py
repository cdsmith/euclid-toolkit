# A tool keeps the relations its inputs had where it was made (O the center of ω, P on ℓ), says so,
# and takes only inputs that keep them; a point clicked for P goes on ℓ. Editing it keeps them too.
import json
from harness import URL, check, run, saved_state, saved_work, serve_libs, watch


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
    at = lambda x, y: (st['x'] + x, st['y'] + y)

    async def clicks(*ps):
        for q in ps:
            await pg.mouse.click(*at(*q))
            await pg.wait_for_timeout(40)

    prompt = lambda: pg.locator('#prompt .pt-text').inner_text()
    toast = lambda: pg.locator('.toast').last.inner_text()
    S = lambda: saved_state(pg)

    # ---- Mark: given ω about O, and P on ℓ, the line OP
    O, R, A, B, P = (300, 250), (380, 250), (150, 450), (650, 450), (500, 450)
    await pg.keyboard.press('1')
    await clicks(O, R, A, B)
    await pg.keyboard.press('3')
    await clicks(O, R)
    await pg.keyboard.press('2')
    await clicks(A, B)
    await pg.keyboard.press('1')
    await clicks(P)
    await pg.keyboard.press('2')
    await clicks(O, P)
    await pg.keyboard.press('Escape')
    await pg.click('[data-act=def-start]')
    await clicks((300, 170), O, (250, 450), P)
    await pg.click('[data-act=def-next]')
    await clicks((400, 350))
    await pg.click('[data-act=def-next]')
    await pg.wait_for_timeout(80)
    notes = await pg.locator('#defSec .rel').all_inner_texts()
    check(
        notes == ['B is the center of ω₁.', 'E is on ℓ₁.']
        or len(notes) == 2
        and 'center of' in notes[0]
        and ' is on ' in notes[1],
        'defining it says what it needs of its inputs: ' + str(notes),
    )
    await pg.fill('#toolName', 'Mark')
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(100)
    t = next(x for x in (await S())['tools'] if x['name'] == 'Mark')
    check(
        [x.get('on', []) for x in t['ins']] == [[], [], [], [2]]
        and [x.get('center', []) for x in t['ins']] == [[], [0], [], []],
        'it keeps them: ' + json.dumps(t['ins']),
    )
    await pg.click(f'[data-act=tool-more][data-id="{t["id"]}"]')
    await pg.wait_for_timeout(50)
    rel = await pg.locator('.tdetail .recipe li.rel').all_inner_texts()
    check(
        len(rel) == 2 and 'center of' in rel[0] and ' is on ' in rel[1],
        'and its recipe says so: ' + str(rel),
    )
    await pg.click(f'[data-act=tool-more][data-id="{t["id"]}"]')

    # ---- using it on a new diagram
    await pg.click('[data-act=diagram-new]')
    await pg.wait_for_timeout(100)
    F = (450, 380)
    await pg.keyboard.press('1')
    await clicks(O, R, A, B, F)
    await pg.keyboard.press('3')
    await clicks(O, R)
    await pg.keyboard.press('2')
    await clicks(A, B)
    await pg.keyboard.press('Escape')
    await pg.keyboard.press('5')
    await pg.wait_for_timeout(50)
    check(
        (await prompt()).startswith('Pick circle '), 'first it asks for a circle: ' + await prompt()
    )
    await clicks((300, 170))
    pr = await prompt()
    check('the center of' in pr and '(2 of 4)' in pr, 'then for its center: ' + pr)
    await clicks(F)
    check(
        (await toast()).startswith("That point isn't the center of circle"),
        'a point that isn\'t the center is refused: ' + await toast(),
    )
    await clicks(O)
    pr = await prompt()
    check(
        pr.startswith('Pick line ') and 'through' in pr,
        'then a line, through the last point: ' + pr,
    )
    await clicks((250, 450))
    pr = await prompt()
    check(
        pr.startswith('Pick point ') and ', on ' in pr and '(4 of 4)' in pr,
        'then a point on it: ' + pr,
    )
    await clicks(F)
    check(
        await toast() == "That point isn't on line CD.",
        'a point off it is refused: ' + await toast(),
    )
    await clicks((400, 452))
    s = await S()
    i = s['notebooks'][0]['diagrams'][1]['id']
    d = await saved_work(pg, i)
    ln = next(n for n in d['nodes'].values() if n['op'] == 'line')['outs'][0]
    use = next((n for n in d['nodes'].values() if n['op'] == 'tool'), None)
    pn = d['nodes'][d['elems'][use['ins'][3]]['node']] if use else None
    check(
        use and pn['op'] == 'point' and pn['ins'] == [ln],
        'a point clicked near the line goes on it, and the tool is used',
    )
    await pg.keyboard.press('Escape')

    # ---- editing it keeps them
    await pg.click(f'[data-act=tool-more][data-id="{t["id"]}"]')
    await pg.click(f'[data-act=tool-edit][data-id="{t["id"]}"]')
    await pg.wait_for_timeout(150)
    await pg.click('[data-act=edit-save]')
    await pg.wait_for_timeout(80)
    notes = await pg.locator('#defSec .rel').all_inner_texts()
    check(
        len(notes) == 2 and 'center of' in notes[0] and ' is on ' in notes[1],
        'on its edit sheet, the inputs keep their relations: ' + str(notes),
    )
    await pg.click('[data-act=def-save]')
    await pg.wait_for_timeout(100)
    check(
        (await toast()).startswith('Updated “Mark”'),
        'and it saves back as itself: ' + await toast(),
    )


run(main)
