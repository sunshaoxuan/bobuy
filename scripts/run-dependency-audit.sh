#!/usr/bin/env bash
set -euo pipefail

# 12.2.2 fixes the upstream long-CVE-reference URL database defect (#8466).
# Updating the data cache remains enabled; cached data is not a substitute scan.
report_dir="${BOBUY_AUDIT_REPORT_DIR:-backend/target/dependency-audit}"
mkdir -p "$report_dir"
report_dir="$(cd "$report_dir" && pwd)"
args=(-B org.owasp:dependency-check-maven:12.2.2:check
  -Dformats=HTML,JSON "-Dodc.outputDirectory=$report_dir" -DfailOnError=true
  "-DdataDirectory=${BOBUY_AUDIT_DATA_DIR:-backend/target/dependency-data-v12.2.2}"
  -DnvdValidForHours=4 --file backend/pom.xml)
if [[ "${BOBUY_AUDIT_RUNTIME_ONLY:-false}" == true ]]; then
  args+=(-DskipProvidedScope=true -DskipTestScope=true)
fi
if [[ -n "${NVD_API_KEY:-}" ]]; then
  args+=(-DnvdApiKeyEnvironmentVariable=NVD_API_KEY)
fi
if [[ -n "${NVD_DATAFEED_URL:-}" ]]; then
  args+=("-DnvdDatafeedUrl=$NVD_DATAFEED_URL")
fi
if [[ -n "${KNOWN_EXPLOITED_URL:-}" ]]; then
  args+=("-DknownExploitedUrl=$KNOWN_EXPLOITED_URL")
fi
mvn "${args[@]}" 2>&1 | tee "$report_dir/scan.log"
# Some scanner versions can continue after a per-CVE DB write error. A report
# produced from incomplete data must not be presented as a successful audit.
if grep -Eq '\[ERROR\] Failed to process CVE-|Value too long for column' "$report_dir/scan.log"; then
  echo 'Dependency data processing failed; report is incomplete.' >&2
  exit 1
fi
test -s "$report_dir/dependency-check-report.json"
test -s "$report_dir/dependency-check-report.html"
