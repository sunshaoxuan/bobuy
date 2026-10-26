"""One backend test/coverage gate; fail rather than accept a missing agent output."""
from pathlib import Path
import csv, json, shutil, subprocess, tempfile

root = Path(__file__).resolve().parents[1]
maven = shutil.which('mvn') or shutil.which('mvn.cmd')
if not maven:
    daemon = shutil.which('mvnd.exe')
    bundled = Path(daemon).parent.parent/'mvn/bin/mvn.cmd' if daemon else None
    maven = str(bundled) if bundled and bundled.is_file() else daemon
if not maven:
    raise SystemExit('Maven is required')
with tempfile.TemporaryDirectory(prefix='bobuy-coverage-') as temporary:
    data = Path(temporary) / 'coverage.exec'
    subprocess.run([maven, '-B', '-f', str(root/'backend/pom.xml'),
                    '-DjacocoDataFile='+str(data), 'verify'], cwd=root, check=True)
    if not data.is_file() or data.stat().st_size == 0:
        raise SystemExit('Coverage data was not generated; the gate cannot pass')
    shutil.copyfile(data, root/'backend/target/jacoco.exec')
    with (root/'backend/target/site/jacoco/jacoco.csv').open() as source:
        row = next(row for row in csv.DictReader(source) if row['CLASS']=='BobbuyStore')
    result = {}
    for counter, minimum in [('LINE',0.90),('BRANCH',0.70)]:
        covered, missed = int(row[counter+'_COVERED']), int(row[counter+'_MISSED'])
        ratio = covered/(covered+missed)
        if ratio < minimum:
            raise SystemExit(counter+' coverage is below its unchanged threshold')
        result[counter] = {'covered':covered,'missed':missed,'ratio':ratio,'minimum':minimum}
    (root/'backend/target/release-coverage.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'coverage':'PASS','class':'BobbuyStore','counters':result}))
