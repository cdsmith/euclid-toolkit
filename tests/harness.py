# What every browser suite shares: the app served locally (served.py), a browser, pages opened
# fresh on it, and checks. A suite is an async function of the browser, run with run(); it reports
# each check, and passes if all of them do and no page it watched threw an error.
import asyncio
import pathlib

from playwright.async_api import async_playwright

from served import URL

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The libraries the page loads from jsdelivr, served from node_modules instead: the same versions,
# and no network needed.
CDN = 'https://cdn.jsdelivr.net/npm/'
LIBS = {
    CDN + 'marked@12.0.2/marked.min.js': ROOT / 'node_modules/marked/marked.min.js',
    CDN + 'katex@0.16.47/dist/katex.min.js': ROOT / 'node_modules/katex/dist/katex.min.js',
}

fails = []
errors = []


def check(ok, message):
    print(('ok   ' if ok else 'FAIL ') + message)
    if not ok:
        fails.append(message)


def watch(page):
    """Keeps the errors thrown on a page, to fail the suite."""
    page.on('pageerror', lambda e: errors.append(str(e)))
    return page


async def serve_libs(target):
    """Serves the libraries from node_modules to a page or browser context."""
    await target.route(
        CDN + '**',
        lambda r: r.fulfill(path=LIBS[r.request.url], content_type='application/javascript'),
    )


async def open_page(browser, width=1440, height=900, fresh=True, **options):
    """A page on the app, watched, with nothing saved in the browser (unless fresh is False)."""
    page = watch(await browser.new_page(viewport={'width': width, 'height': height}, **options))
    await serve_libs(page)
    await page.goto(URL)
    if fresh:
        await page.evaluate('localStorage.clear()')
        await page.reload()
    await page.wait_for_timeout(300)
    return page


async def seed(page, state, work=None):
    """Replaces what's saved in the browser with state, and each sheet's construction (work, by
    sheet id), and reloads."""
    await page.evaluate(
        """([state, work]) => {
          localStorage.clear();
          localStorage.setItem('euclid-toolkit:state', JSON.stringify(state));
          for (const id in work) {
            localStorage.setItem('euclid-toolkit:work:' + id, JSON.stringify({ doc: work[id] }));
          }
        }""",
        [state, work or {}],
    )
    await page.reload()
    await page.wait_for_timeout(300)


async def saved_state(page):
    """What the app has saved in the browser: notebooks, lessons, tools, toolboxes and solved."""
    return await page.evaluate("JSON.parse(localStorage.getItem('euclid-toolkit:state'))")


async def saved_work(page, sheet_id):
    """The construction saved for a sheet."""
    key = 'euclid-toolkit:work:' + sheet_id
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key)).doc", key)


async def folds(page):
    """The folds in the title block: [title, shown, open, text inside] for each."""
    return await page.evaluate(
        """[...document.querySelectorAll('#titleblock details.fold')].map((d) => [
          d.querySelector('summary').textContent,
          getComputedStyle(d).display !== 'none',
          d.open,
          d.querySelector('.fold-body').innerText,
        ])"""
    )


async def import_groups(page):
    """The tools offered for import, as 'Group: Tool, Tool' for each group."""
    return await page.evaluate(
        """[...document.querySelectorAll('.import-group')].map(
          (g) =>
            g.querySelector('h4').textContent +
            ': ' +
            [...g.querySelectorAll('.import-item > span:first-child')]
              .map((s) => s.textContent)
              .join(', '),
        )"""
    )


async def stage(page):
    """The canvas's box on the page."""
    return await page.locator('#stage').bounding_box()


def run(suite):
    async def main():
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            await suite(browser)
            await browser.close()
        check(not errors, 'no errors: ' + str(errors))
        print('\n' + (f'{len(fails)} FAILED' if fails else 'ALL PASSED'))

    asyncio.run(main())
