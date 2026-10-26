from pathlib import Path
import os,shutil,subprocess,tempfile,unittest

ROOT=Path(__file__).resolve().parents[1]
BASH='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else shutil.which('bash')

@unittest.skipUnless(BASH,'Bash is required for the audit runner behavior checks')
class AuditRunnerTest(unittest.TestCase):
    def posix(self,path):
        if os.name!='nt':return str(path)
        return subprocess.check_output([BASH,'-c','cygpath -u "$1"','audit-test',str(path)],text=True,encoding='utf-8').strip()

    def run_case(self,scenario='success',runtime=False):
        base=ROOT/'.task-tmp';base.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='bobuy-audit-test-',dir=base) as directory:
            temporary=Path(directory);binary=temporary/'bin';binary.mkdir();capture=temporary/'args.txt';report=temporary/'report'
            self.assertTrue(temporary.resolve().is_relative_to(base.resolve()))
            fake=binary/'mvn';fake.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$@" > "$BOBUY_TEST_CAPTURE"
for argument in "$@"; do case "$argument" in -Dodc.outputDirectory=*) report="${argument#-Dodc.outputDirectory=}";; esac; done
mkdir -p "$report"
if [[ "$BOBUY_TEST_SCENARIO" != missing ]]; then printf '{}' > "$report/dependency-check-report.json"; printf '<html>report</html>' > "$report/dependency-check-report.html"; fi
if [[ "$BOBUY_TEST_SCENARIO" == partial ]]; then echo '[ERROR] Failed to process CVE-2026-6785'; fi
if [[ "$BOBUY_TEST_SCENARIO" == failed ]]; then exit 7; fi
''',encoding='utf-8');fake.chmod(0o755)
            env=os.environ.copy();env.update(BOBUY_TEST_BIN=self.posix(binary),BOBUY_TEST_SCRIPT=self.posix(ROOT/'scripts/run-dependency-audit.sh'),BOBUY_TEST_CAPTURE=self.posix(capture),BOBUY_TEST_SCENARIO=scenario,BOBUY_AUDIT_REPORT_DIR=self.posix(report),BOBUY_AUDIT_DATA_DIR=self.posix(temporary/'data'),BOBUY_AUDIT_RUNTIME_ONLY=str(runtime).lower(),NVD_API_KEY='test-secret-never-argv')
            result=subprocess.run([BASH,'-c','export PATH="$BOBUY_TEST_BIN:$PATH"; exec bash "$BOBUY_TEST_SCRIPT"'],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8')
            arguments=capture.read_text(encoding='utf-8') if capture.exists() else ''
            self.assertNotIn(env['NVD_API_KEY'],arguments+result.stdout+result.stderr)
            return result,arguments

    def test_complete_report_passes_and_key_is_environment_reference(self):
        result,args=self.run_case();self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('-DnvdApiKeyEnvironmentVariable=NVD_API_KEY',args)
        self.assertNotIn('-DskipTestScope',args)

    def test_runtime_only_scope_is_explicit(self):
        result,args=self.run_case(runtime=True);self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('-DskipTestScope=true',args);self.assertIn('-DskipProvidedScope=true',args)

    def test_maven_failure_is_not_hidden_by_tee(self):
        result,_=self.run_case('failed');self.assertEqual(result.returncode,7)

    def test_incomplete_cve_data_is_rejected_even_if_engine_exits_zero(self):
        result,_=self.run_case('partial');self.assertNotEqual(result.returncode,0)
        self.assertIn('report is incomplete',result.stderr)

    def test_missing_report_is_not_success(self):
        result,_=self.run_case('missing');self.assertNotEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
