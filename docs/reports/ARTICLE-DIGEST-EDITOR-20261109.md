# Published article revision candidate

Published product recommendations can be revised through the normal owner UI
without withdrawing or republishing the post. One reviewed request contains all
four language titles and bodies. The server checks the owning principal, post
version and previous article hash before applying it atomically.

The existing immutable article history retains the old full text, translations
and hashes. A request UUID and payload digest in that history provide durable
replay; reuse with another payload conflicts. Published state, publication time,
URL, item associations, quote facts and galleries are not assigned by this path.
No database migration is added.

Stored translation hashes retain their real Japanese source binding for the old
reader. A completely reviewed atomic bundle has a separate canonical whole-text
hash; API views bind all four translations to it without mutating stored maps.
Ordinary draft translation edits deterministically leave the atomic-bundle state.
This preserves the old hash algorithm for legacy articles. Pure old-reader checks
are not a substitute for starting the exact old application against PostgreSQL.

The editor retains all language drafts on errors, conflicts and stale responses.
An explicit fresh read rebases version/hash while preserving the draft and requiring
review again. Identity/session/post changes invalidate old responses. Published
text renders as escaped plain text with safe HTTP(S) links; truncated excerpts do
not turn incomplete URL fragments into links. No HTML or Markdown engine is added.

Source validation: 12 backend pure tests passed on Java 22 with Java17 target
bytecode; the six PostgreSQL integration methods compiled but have not run locally.
The frontend has 38 unique focused passes plus type and four-language checks.
Existing failures and original-source negative controls remain in local evidence.
CI-tool guards have 15 Python and seven Node pure passes.

Required next gates are actual remote Java17 and isolated PostgreSQL transactions,
complete artifact binding, independent review, and a formal nonproduction browser
save/reopen journey. Production content is not edited by this candidate preparation.
Source drafts and operational receipts remain private local evidence, not repo data.

First remote CI `42640911961` on `f1bfbadb` passed all six new real PostgreSQL
article scenarios and the populated V27-to-V28 preservation step. The combined
35-case PostgreSQL group failed with 17 later fixture setup errors: synthetic
article posts retained a user FK while existing compatibility/storefront tests
reseeded users. The original XML/logs are retained. Fix1 changes only this test
class's fixture ownership and teardown: random per-case markers, exact item/post/
user identities, completed worker checks, foreign-FK refusal, and inverse cleanup
in one transaction. Immutable article history remains retained; no constraint,
seed routine, product code or original assertion is weakened. The same six
scenarios plus the full original PostgreSQL group require a real remote rerun.
No local JVM, PostgreSQL or Docker run was performed for Fix1.
