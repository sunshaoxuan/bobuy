"""Server-side daily offer badges. Credentials stay inside the existing PostgreSQL container."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='Evaluate the real transaction and roll it back')
    args = parser.parse_args()
    sql = Path(__file__).with_suffix('.sql').read_bytes()
    executed = sql.replace(b'COMMIT;', b'ROLLBACK;') if args.dry_run else sql
    command = ['docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c',
               'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate']
    sqlstate = None
    try:
        result = subprocess.run(command, input=executed, capture_output=True, timeout=90)
        if result.returncode:
            codes = re.findall(rb'(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b', result.stderr)
            sqlstate = codes[-1].decode('ascii') if codes else None
            # PostgreSQL diagnostics can include row contents. Keep them out of public logs.
            raise RuntimeError('Database transaction failed; inspect protected service diagnostics')
        report = json.loads(result.stdout)
        assert report['scanned'] == sum(report[k] for k in ('added', 'removed', 'unchanged', 'uncertain', 'disabled'))
        report['sqlSha256'] = hashlib.sha256(sql).hexdigest()
        report['dryRun'] = args.dry_run
        # The root-only state directory retains scoped before/after marker receipts for recovery.
        directory = Path('/var/lib/bobuy-offer-markers')
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        prefix = 'dry-run-' if args.dry_run else 'run-'
        path = directory / (prefix + report['at'].replace(':', '') + '.json')
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        path.chmod(0o600)
        temporary = directory / 'latest.tmp'
        temporary.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
        temporary.chmod(0o600)
        temporary.replace(directory / ('dry-run-latest.json' if args.dry_run else 'latest.json'))
        summary = {k: v for k, v in report.items() if k != 'changes'}
        print(json.dumps(summary, ensure_ascii=False))
    except (subprocess.TimeoutExpired, RuntimeError, ValueError, OSError, AssertionError) as error:
        print(json.dumps({'result': 'FAIL', 'errorType': type(error).__name__, 'sqlstate': sqlstate,
                          'detail': 'Inspect database and receipt state before retrying; no database restore.'}))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
