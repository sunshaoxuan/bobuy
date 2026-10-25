"""Read only the deployment identity and bounded migration inventory."""
import json
import subprocess
from pathlib import Path

query = """
select version from flyway_schema_history where success order by installed_rank;
select 'trips='||count(*) from bb_trip;
select 'orders='||count(*) from bb_order_header;
select 'users='||count(*) from bb_user;
select 'products='||count(*) from bb_product;
select id,status,depart_date from bb_trip order by id limit 100;
"""
result = subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c',
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1'],
    input=query, text=True, capture_output=True)
print(result.stdout)
if result.returncode:
    print(result.stderr)
    raise SystemExit(result.returncode)
print(subprocess.check_output(['df','-h','/opt/bobuy'], text=True))
print(subprocess.check_output(['docker','image','ls','--format','{{.Repository}}:{{.Tag}} {{.ID}}'], text=True))
print('release_directories=' + json.dumps(sorted(p.name for p in Path('/opt/bobuy/releases').iterdir())))
