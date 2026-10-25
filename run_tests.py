# Runs every test: engine_test.js (the engine, in Node; "engine") and the browser suites
# (Playwright), at the same time, each in a process of its own. Name suites to run just those:
# python run_tests.py engine text scaffold. Some suites need files others make: mkdeps.js makes
# deps-tools.json for deps.py, and deps.py makes deps-lesson.json for nbimport.py, so those run
# first when needed.
import concurrent.futures, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent
TESTS = ROOT / 'tests'
SUITES = [
    'full',
    'lesson',
    'exercise',
    'text',
    'scaffold',
    'sections',
    'importtool',
    'reorder',
    'picks',
    'inside',
    'flat',
    'arithmetic',
    'compass',
    'triangle',
    'straightedge',
    'goaldrag',
    'segment',
    'deps',
    'hoverio',
    'relations',
    'follow',
    'nbimport',
    'lessondrag',
    'fixes',
    'dup',
    'rows',
    'preview',
    'goalband',
    'failures',
]
ENV = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8')


def run(cmd):
    r = subprocess.run(
        cmd, cwd=TESTS, env=ENV, capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    return r.returncode, r.stdout + r.stderr


def engine():
    code, out = run(['node', 'engine_test.js'])
    last = out.strip().splitlines()[-1] if out.strip() else ''
    ok = code == 0 and 'FAIL' not in out
    shown = [l for l in out.splitlines() if 'FAIL' in l or 'Error' in l]
    return f'engine: {last}', ok, shown


def suite(s, after=None):
    if after:
        after.result()
    code, out = run([sys.executable, s + '.py'])
    ok = code == 0 and 'ALL PASSED' in out
    lines = out.splitlines()
    shown = [l for l in lines if l.startswith('FAIL') or 'Error' in l or 'errors [' in l]
    return f'{s}: {"ok" if ok else "FAILED"}', ok, shown


def main():
    picked = sys.argv[1:]
    if 'nbimport' in picked and 'deps' not in picked:
        picked.append('deps')
    code, out = run(['node', 'mkdeps.js'])
    if code:
        sys.exit('mkdeps.js failed:\n' + out)
    jobs = {}
    with concurrent.futures.ThreadPoolExecutor(os.cpu_count()) as pool:
        if not picked or 'engine' in picked:
            jobs['engine'] = pool.submit(engine)
        for s in SUITES:
            if not picked or s in picked:
                jobs[s] = pool.submit(suite, s, jobs['deps'] if s == 'nbimport' else None)
        failed = []
        for name, job in jobs.items():
            line, ok, shown = job.result()
            print(line, flush=True)
            if not ok:
                failed.append(name)
                print('\n'.join('    ' + l for l in shown)[-3000:])
    print('\nALL PASSED' if not failed else f'\nFAILED: {", ".join(failed)}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
