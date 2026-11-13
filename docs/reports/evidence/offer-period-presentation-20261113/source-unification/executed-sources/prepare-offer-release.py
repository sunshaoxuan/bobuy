from pathlib import Path
import subprocess,shutil
root=Path(__file__).parent
e=root/'docs/reports/evidence/offer-period-presentation-20261113';e.mkdir(exist_ok=True,parents=True)
old=(root/'docs/reports/evidence/card-heat-release-20261113/executed-sources/release-heat.py').read_text(encoding='utf-8');source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();assert source.startswith('217a486')
old=old.replace("E=ROOT/'docs/reports/evidence/card-heat-release-20261113'","E=ROOT/'docs/reports/evidence/offer-period-presentation-20261113'").replace('20261113.heat-top-right.2','20261113.offer-period-friendly.1').replace("assert source=='2160266d9a9f864274e62003b7bd1d1c093c376f'","assert source=='"+source+"'").replace("'78'","'79'").replace('817675d60c1d712c979f999f895da592fd188487','2160266d9a9f864274e62003b7bd1d1c093c376f').replace('heat-build.log','offer-build.log')
(root/'release-offer.py').write_text(old,encoding='utf-8')
prior=e/'local/rejected-first-attempt';prior.mkdir(exist_ok=True,parents=True)
for name in ['hint-1440.png','hint-text-1440.png','detail-1440.png','detail-period-1440.png']:
 p=e/'local'/name
 if p.exists() and not (prior/name).exists():shutil.copy2(p,prior/name)
