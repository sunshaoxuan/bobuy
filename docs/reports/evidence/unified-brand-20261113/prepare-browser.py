from pathlib import Path
import shutil
e=Path(__file__).parent;r=e.parents[3];shutil.copy2(r/'docs/reports/evidence/inclusive-offer-dates-20261113/run-browser.py',e/'run-browser.py')
