# Secret decryption staging review fix

Scope: only `scripts/secrets-decrypt.sh` and `scripts/secrets-decrypt.ps1`, plus this task record. Do not commit or deploy.

Requirement: decrypt all three inputs into unique temporary files in their target directories with restrictive permissions before replacing any target. On decryption or staging failure, remove all temporary files and preserve existing targets. Never print plaintext.

Method: register temporary files for cleanup, restrict access before decryption, then use a separate promotion loop after every input succeeds. Multi-file atomic promotion against filesystem failures is outside this review fix.

Frozen verification scope: Bash syntax and ShellCheck if available, PowerShell parser, and isolated synthetic fixtures for success, later decryption failure and missing later input. Check cleanup, unchanged targets on failure and temporary permissions. Expected duration: a few minutes. No product build or full suite. Stop when these checks complete.

Validation: PASS for `bash -n scripts/secrets-decrypt.sh`, PowerShell 7.6.10 parser and `git diff --check`. ShellCheck unavailable in PATH (Windows and WSL). Both scripts passed isolated synthetic success, final-input decryption failure and missing-final-input cases. Fixtures checked that all targets remained original during decryption, failures preserved every target, temporary files were removed, plaintext was absent from captured output, and staging permissions were mode 600 (Bash) or protected current-user-only ACL (PowerShell). No real encrypted inputs were decrypted. Bash runtime fixtures were removed by their trap. Cleanup of `.task-tmp/decrypt-review` was rejected by automatic approval review with `blocked by policy`; synthetic PowerShell fixtures and test runners remain there. No commit or deployment.
