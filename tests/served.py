# The page's URL for the browser suites, on a server of their own (serve.py) so the page can fetch
# its lessons.
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import serve

URL = serve.start()
