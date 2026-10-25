# Runs every test: engine_test.js (the engine, in Node; "engine") and the browser suites
# (Playwright). Name suites to run just those: python run_tests.py engine text scaffold. Some
# suites need files others make: mkdeps.js makes deps-tools.json for deps.py, and deps.py makes
# deps-lesson.json for nbimport.py, so those run first when needed.
import os, pathlib, subprocess, sys

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


def main():
    picked = sys.argv[1:]
    if 'nbimport' in picked and 'deps' not in picked:
        picked.append('deps')
    failed = []
    code, out = run(['node', 'mkdeps.js'])
    if code:
        sys.exit('mkdeps.js failed:\n' + out)
    if not picked or 'engine' in picked:
        code, out = run(['node', 'engine_test.js'])
        last = out.strip().splitlines()[-1] if out.strip() else ''
        print(f'engine: {last}')
        if code or 'FAIL' in out:
            failed.append('engine')
            print('\n'.join(l for l in out.splitlines() if 'FAIL' in l or 'Error' in l))
    for s in SUITES:
        if picked and s not in picked:
            continue
        code, out = run([sys.executable, s + '.py'])
        lines = out.splitlines()
        ok = code == 0 and 'ALL PASSED' in out
        print(f'{s}: {"ok" if ok else "FAILED"}')
        if not ok:
            failed.append(s)
            print(
                '\n'.join(
                    '    ' + l
                    for l in lines
                    if l.startswith('FAIL') or 'Error' in l or 'errors [' in l
                )[-3000:]
            )
    print('\nALL PASSED' if not failed else f'\nFAILED: {", ".join(failed)}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
