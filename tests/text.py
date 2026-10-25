# A diagram's text: Markdown with TeX, under its title, written in place on a notebook diagram, and
# carried into a lesson, where its diagrams and problems show theirs (and a problem's hints) the
# same way.
from harness import URL, check, run, saved_state, seed, serve_libs, watch

APEX_TEXT = (
    'Find $C$, with $AC = AB$.\n\n' '::: Hint\nEach circle goes through the other’s *center*.\n:::'
)


def equilateral():
    n = lambda i, op, ins, **kw: dict(id=f'n{i}', op=op, ins=ins, outs=[f'e{i}'], seq=i, **kw)
    e = lambda i, kind, label='': dict(id=f'e{i}', node=f'n{i}', kind=kind, label=label)
    return {
        'nodes': {
            'n1': n(1, 'point', [], x=-70, y=30),
            'n2': n(2, 'point', [], x=70, y=30),
            'n3': n(3, 'circle', ['e1', 'e2']),
            'n4': n(4, 'circle', ['e2', 'e1']),
            'n5': n(5, 'isect', ['e3', 'e4'], which=1),
        },
        'elems': {
            'e1': e(1, 'point', 'A'),
            'e2': e(2, 'point', 'B'),
            'e3': e(3, 'circle'),
            'e4': e(4, 'circle'),
            'e5': e(5, 'point', 'C'),
        },
        'seq': 5,
    }


ex = {
    'givens': ['e1', 'e2'],
    'scaffold': [],
    'goals': ['e5'],
    'elaboration': [],
    'toolName': 'Apex',
}
state = {
    'solved': {},
    'tools': [],
    'toolboxes': {'nb1': ['point', 'line', 'circle']},
    'lessons': [],
    'notebooks': [
        {
            'id': 'nb1',
            'name': 'Notes',
            'diagrams': [
                {
                    'id': 'dgI',
                    'name': 'Two circles',
                    'text': 'Two circles, **each** through the other’s center.',
                },
                {
                    'id': 'dgE',
                    'name': 'Apex',
                    'subtitle': 'Euclid I.1',
                    'text': APEX_TEXT,
                    'exercise': ex,
                },
            ],
        }
    ],
}
work = {'dgI': equilateral(), 'dgE': equilateral()}


async def main(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
    await serve_libs(ctx)
    pg = watch(await ctx.new_page())
    await pg.goto(URL)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(300)
    S = lambda: saved_state(pg)

    async def text():
        return (await saved_state(pg))['notebooks'][0]['diagrams'][0].get('text')

    # ---- a new diagram has no text, and no Text tool
    await pg.click('[data-act=notebook-new]')
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('#titleblock [data-act=write][data-id=text]').inner_text() == 'Add text',
        'a new diagram offers to add text under its title',
    )
    check(
        await pg.locator('#tools .tname').all_inner_texts()
        == ['Point', 'Line', 'Circle', 'Segment']
        and await pg.locator('#textTool').count() == 0,
        'and there is no Text tool',
    )
    await pg.keyboard.press('t')
    await pg.wait_for_timeout(50)
    check(await pg.locator('#prompt').is_hidden(), 'T arms nothing')

    # ---- writing it
    await pg.click('[data-act=write][data-id=text]')
    await pg.wait_for_timeout(50)
    check(
        await pg.evaluate("document.activeElement.id") == 'writeField',
        'Add text opens a field to write in, under the title',
    )
    await pg.keyboard.type(
        '**Circle** $\\omega$ through $A$\n\n$$x^2 + y^2 = r^2$$\n\nCosts $5 and $10. '
        '<b>not bold</b> <img src=x onerror="window.__pwned=1"> '
        '[bad](javascript:window.__pwned=1) [good](https://example.com)1'
    )
    check(
        (await pg.locator('#writeField').input_value()).endswith('1')
        and await pg.locator('.tcard.is-active').count() == 0,
        'typing types, without picking tools',
    )
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(100)
    inner = await pg.locator('#titleblock .tb-text').inner_html()
    check(
        '<strong>Circle</strong>' in inner
        and inner.count('<math') == 3
        and 'display="block"' in inner,
        'Markdown and TeX are rendered: ' + inner[:80],
    )
    check(
        '$5 and $10' in inner
        and '&lt;b&gt;not bold&lt;/b&gt;' in inner
        and '<img' not in inner
        and 'javascript:' not in inner
        and 'href="https://example.com"' in inner,
        'money stays money, HTML shows as text, only web links work',
    )
    check(await pg.evaluate('window.__pwned') is None, 'nothing in the text runs')
    check((await text()).startswith('**Circle**'), 'the text is kept with the diagram')
    check(
        await pg.locator('#titleblock [data-act=write][data-id=text]').inner_text() == 'Edit text',
        'and can be edited',
    )
    # editing it again, finished with Ctrl+Enter; emptying it takes it away
    await pg.click('[data-act=write][data-id=text]')
    await pg.wait_for_timeout(50)
    check(
        (await pg.locator('#writeField').input_value()).startswith('**Circle**'),
        'editing starts from the text',
    )
    await pg.fill('#writeField', 'Just $A$.')
    await pg.keyboard.press('Control+Enter')
    await pg.wait_for_timeout(80)
    check(
        await text() == 'Just $A$.' and await pg.locator('#titleblock .tb-text math').count() == 1,
        'Ctrl+Enter finishes too',
    )
    # a fold takes whatever title it's given, with math in it, and runs to its closing line
    await pg.click('[data-act=write][data-id=text]')
    await pg.fill(
        '#writeField',
        'Before.\n\n::: Why $OP = 1$\nOne line,\nand **another**.\n\nA paragraph.\n:::\n\n'
        '::: Warning\nCareful.\n:::\n\nAfter.',
    )
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(80)
    folds = lambda: pg.evaluate(
        """[...document.querySelectorAll('#titleblock details.fold')].map((d) => [
            d.querySelector('summary').textContent.trim(),
            d.querySelectorAll('summary math').length,
            d.querySelector('.fold-body').textContent.trim(),
          ])"""
    )
    f = await folds()
    check(
        len(f) == 2
        and f[0][0].startswith('Why')
        and f[0][1] == 1
        and 'another' in f[0][2]
        and 'A paragraph.' in f[0][2]
        and f[1][:1] == ['Warning']
        and f[1][2] == 'Careful.',
        'a fold is titled by its line, math and all: ' + str(f),
    )
    check(
        await pg.locator('#titleblock .tb-text > p').all_inner_texts() == ['Before.', 'After.'],
        'and what is around the folds is outside them',
    )
    await pg.click('[data-act=write][data-id=text]')
    await pg.fill('#writeField', '  ')
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(80)
    check(
        await text() is None
        and await pg.locator('#titleblock [data-act=write][data-id=text]').inner_text()
        == 'Add text',
        'emptying it takes it away',
    )

    # the subtitle: added in place, finished with Enter; emptying it takes it away
    async def sub():
        return (await saved_state(pg))['notebooks'][0]['diagrams'][0].get('subtitle')

    check(
        await pg.locator('#titleblock [data-act=write][data-id=subtitle]').inner_text()
        == 'Add subtitle',
        'it offers a subtitle too',
    )
    await pg.click('[data-act=write][data-id=subtitle]')
    await pg.keyboard.type('After Euclid I.1')
    await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(80)
    check(
        await sub() == 'After Euclid I.1'
        and await pg.locator('#titleblock .tb-subbtn').inner_text() == 'After Euclid I.1',
        'a subtitle is written in place, and Enter finishes it',
    )
    await pg.click('[data-act=write][data-id=subtitle]')
    await pg.fill('#writeField', '')
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(80)
    check(
        await sub() is None
        and await pg.locator('#titleblock .tb-subbtn').inner_text() == 'Add subtitle',
        'emptying it takes it away',
    )
    # a click on a button that ends the writing still works
    await pg.click('[data-act=write][data-id=text]')
    await pg.keyboard.type('Then $B$.')
    await pg.click('[data-act=exercise-mark]')
    await pg.wait_for_timeout(80)
    check(
        await text() == 'Then $B$.' and await pg.locator('#defSec').is_visible(),
        'clicking Make exercise while writing keeps the text and makes the exercise: '
        + str(await text()),
    )
    await pg.click('[data-act=def-cancel]')

    # ---- into a lesson: a diagram's and a problem's text show under their titles, and hints the
    # same way
    await seed(pg, state, work)
    await pg.click('[data-act=card-open][data-id=nb1]')
    await pg.wait_for_timeout(100)
    await pg.click('[data-act=notebook-export]')
    await pg.click('#exportForm [type=submit]')
    await pg.wait_for_timeout(150)
    L = (await S())['lessons'][0]
    check(
        [it.get('text') for it in L['items']]
        == [
            'Two circles, **each** through the other’s center.',
            APEX_TEXT,
        ]
        and not any('texts' in it['diagram'] for it in L['items']),
        'the lesson has the texts',
    )
    await pg.click(f"[data-act=card-open][data-id={L['id']}]")
    await pg.wait_for_timeout(150)
    await pg.click(f"[data-act=sheet-open][data-id='{L['id']}.dgI']")
    await pg.wait_for_timeout(150)
    check(
        '<strong>each</strong>' in await pg.locator('#titleblock .tb-text').inner_html(),
        "the lesson's diagram shows its text",
    )
    await pg.click(f"[data-act=sheet-open][data-id='{L['id']}.dgE']")
    await pg.wait_for_timeout(150)
    check(
        await pg.locator('#titleblock .tb-text > p math').count() == 2
        and await pg.locator('[data-act=write]').count() == 0
        and 'Euclid I.1' in await pg.locator('#titleblock .tb-sub').inner_text(),
        'the problem shows its subtitle and text, not to be edited',
    )
    await pg.click('#titleblock details.fold summary')
    await pg.wait_for_timeout(50)
    check(
        '<em>center</em>' in await pg.locator('.fold-body').inner_html(),
        'and its hint, folded until opened, in Markdown',
    )
    st = await pg.locator('#stage').bounding_box()
    await pg.keyboard.press('1')
    await pg.mouse.click(st['x'] + 200, st['y'] + 200)
    await pg.wait_for_timeout(80)
    check(
        await pg.locator('#log li').count() == 1
        and await pg.evaluate("document.querySelector('#titleblock details.fold').open"),
        'drawing keeps the hint open',
    )
    await pg.screenshot(path='text-lesson.png')

    # ---- without marked and KaTeX, folds still fold
    ctx2 = await b.new_context(viewport={'width': 1440, 'height': 900})
    await ctx2.route('https://cdn.jsdelivr.net/**', lambda r: r.abort())
    pg2 = watch(await ctx2.new_page())
    plain = dict(state)
    plain['notebooks'] = [
        dict(
            state['notebooks'][0],
            diagrams=[
                dict(
                    state['notebooks'][0]['diagrams'][0],
                    text=(
                        'Before.\n\n::: Note <b>\nOne line,\nand another.\n:::\n\n'
                        'After.\n\n::: Hint\nLast'
                    ),
                )
            ],
        )
    ]
    await pg2.goto(URL)
    await seed(pg2, plain, work)
    await pg2.click('[data-act=card-open][data-id=nb1]')
    await pg2.wait_for_timeout(100)
    h = await pg2.locator('#titleblock .tb-text').inner_html()
    check(
        h == '<p>Before.</p><details class="fold"><summary>Note &lt;b&gt;</summary>'
        '<div class="fold-body"><p>One line,<br>and another.</p></div></details>\n'
        '<p>After.</p><details class="fold"><summary>Hint</summary>'
        '<div class="fold-body"><p>Last</p></div></details>\n',
        'without marked, folds still fold: ' + h,
    )


run(main)
