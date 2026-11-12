import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT=Path(__file__).with_name('sync-product-offer-markers.py')
spec=importlib.util.spec_from_file_location('offer_runner',SCRIPT)
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTest(unittest.TestCase):
    def invoke(self, result, dry=False):
        # Temporary receipt files remain under this task's checkout.
        owned=SCRIPT.parents[1]/'.task-tmp/offer-runner-tests'
        owned.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=owned) as temporary:
            real_path=Path
            def path(value):
                return real_path(temporary) if value=='/var/lib/bobuy-offer-markers' else real_path(value)
            output=io.StringIO()
            with patch.object(runner,'Path',side_effect=path),patch.object(runner.subprocess,'run',side_effect=result if isinstance(result,Exception) else None,return_value=result) as run,patch('sys.argv',[str(SCRIPT)]+(['--dry-run'] if dry else [])),contextlib.redirect_stdout(output):
                code=runner.main()
            receipts={p.name:json.loads(p.read_text(encoding='utf-8')) for p in real_path(temporary).glob('*.json')}
            return code,json.loads(output.getvalue()),receipts,run

    def test_commit_receipt_and_no_secrets_in_command(self):
        report={'at':'2026-11-12T16:00:00Z','scanned':1,'added':1,'removed':0,'unchanged':0,'uncertain':0,'disabled':0,'changes':[{'before':[],'after':['discount']}]}
        code,summary,receipts,run=self.invoke(subprocess.CompletedProcess([],0,json.dumps(report).encode(),b''))
        self.assertEqual(code,0);self.assertIn('latest.json',receipts);self.assertNotIn('changes',summary)
        self.assertIn(b'COMMIT;',run.call_args.kwargs['input']);self.assertEqual(run.call_args.kwargs['timeout'],90)
        self.assertIn('$POSTGRES_USER',run.call_args.args[0][-1]);self.assertFalse(summary['dryRun'])

    def test_dry_run_uses_rollback_and_separate_receipt(self):
        report={'at':'2026-11-12T16:00:00Z','scanned':0,'added':0,'removed':0,'unchanged':0,'uncertain':0,'disabled':0,'changes':[]}
        code,summary,receipts,run=self.invoke(subprocess.CompletedProcess([],0,json.dumps(report).encode(),b''),True)
        self.assertEqual(code,0);self.assertIn('dry-run-latest.json',receipts);self.assertNotIn('latest.json',receipts)
        self.assertIn(b'ROLLBACK;',run.call_args.kwargs['input']);self.assertNotIn(b'COMMIT;',run.call_args.kwargs['input'])

    def test_database_failure_timeout_and_invalid_output_never_record_success(self):
        for result in (subprocess.CompletedProcess([],1,b'',b'SECRET row contents'),subprocess.TimeoutExpired('psql',90),subprocess.CompletedProcess([],0,b'invalid',b'')):
            with self.subTest(result=type(result).__name__):
                code,summary,receipts,_=self.invoke(result)
                self.assertEqual(code,1);self.assertEqual(summary['result'],'FAIL');self.assertEqual(receipts,{})
                self.assertNotIn('SECRET',json.dumps(summary))


if __name__=='__main__':unittest.main()
