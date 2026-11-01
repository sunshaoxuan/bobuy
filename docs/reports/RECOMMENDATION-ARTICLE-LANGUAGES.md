# Recommendation article languages: local delivery

Based on `2ce3aef9f42b481b9a61fe0c4849785f239e1d19`, retaining the V23 quotation changes and upload fix ancestry. No AI candidate, production deployment, credential/security change or real content write is included.

## Behavior and source retention

The verified production issue was mixed-language text in the single shared article body, reproduced in Simplified/Traditional Chinese, English and Japanese on `/recommendations/5`. It was not the required Japanese original name suffix. Article title/body now have real language-aware storage and selection; topic titles also use current reviewed translations.

New articles use Japanese source fields. Existing title/body remain byte-for-byte in migration, with source language unconfirmed; mixed legacy text is never automatically declared Japanese. Normal editor tabs keep independent drafts for zh-CN/zh-TW/en-US. A legacy article requires explicit Japanese-source review before translations. Source and translation saves retain immutable application-level revision snapshots, including earlier manual translations. A changed source invalidates translation use by source hash without erasing it. Re-review is explicit; no unverified AI service is called or claimed to have generated text.

Missing/stale article title and body are checked separately. Retained source is shown visibly with a missing-translation/source-language notice, not silently substituted or hidden. The Japanese source stays intact. Product name, specification, description and offer notes now determine missing translations independently; a translated product name cannot suppress the notice for Japanese description fallback. Valid translated names retain the Japanese original suffix; ja-JP does not duplicate it. Whitespace-only translated fields count as missing.

Normal editor path: `/admin/recommendations?post=<id>` -> article language tabs. Save Japanese source with Save Draft; edit and explicitly review each translation with its own save button. Unsaved translated drafts survive tab changes, block publication/leaving without the existing confirmation, and must be saved before changing source. History is available in the same article editor. Published content must follow the existing withdraw/edit/publish flow. Server writes require merchant ownership, current post version, current source hash and explicit review; history rejects foreign merchants, customers/anonymous access. Other languages cannot be overwritten by saving one locale.

## V24 and rollback

V24 adds nullable `article_source_locale`, default-empty JSONB `article_translations`, and retained article revision records. It does not update existing text, infer language, delete images, change quote windows, prices, stock or purchase/publication states. Old title/body columns remain for compatibility. New translations are not bulk-generated or backfilled.

Actual existing local PG18.6 and packaged Flyway migrated a synthetic V23 database to V24. Every old post column matched its pre-migration fingerprint, unknown legacy locale stayed null, original/translated text and article history restored from a post-migration dump, and earlier quote history survived. A pre-migration dump restored V23 and unchanged old content. No production data/backup was used. Evidence: `evidence/article-languages/migration-proof.json`.

Before new writes, verified pre-cutover backup/app rollback remains possible. After source/translation writes, do not restore a pre-V24 database over them or drop columns/history. Freeze affected writes and preserve/export the new revision state for a forward-compatible correction. An old frontend ignores the new translations/notices and would regress language behavior; it is not an acceptable unnoticed rollback after adoption. No destructive down migration is supplied. Production release must include V23/V24 dependencies and a fresh cutover backup; neither was executed here.

## Actual validation

- 16 recommendation HTTP cases and 6 product-master reuse cases passed. Added source/three-language preservation, stale-source rejection, legacy-language review, retained history and public filtering. A final focused ownership case separately verified foreign merchant 404 and customer 403 for the new write endpoint, plus anonymous/foreign history rejection.
- 24 affected frontend cases passed; 6 pure article/product text cases rechecked after the final whitespace-field fix. Locale validation passed 1,221 keys; TypeScript/Vite and common/core production packaging passed. Existing vendor chunk-size warning remains.
- Real local normal-login UI, real PG backend, normal form/upload writes: independently saved all three translations; tab drafts and reopened values retained; all four public titles/bodies selected correctly, with locale retained after refresh. Product-master Japanese description plus translated name was maintained via normal UI and showed the precise missing-translation notice in list/detail.
- Source modification retained old translations, made public display explicitly fall back to retained source, and required manual re-review. Real 390x844 mobile/touch save/reopen and article history preserved Japanese and manual English text. Tested runtime SHA256s are in `evidence/article-languages/ui-proof.json`.
- Harness-only failures were corrected from actual visible state: field label wording, login/navigation readiness, a still-open drawer, and waiting for withdraw controls before editing. They did not require weakening access or product validation, and the unique synthetic article/profile were reused rather than recreated. Temporary failure logs remain under `.task-tmp/article-language-acceptance`.
- Existing shared Bobuy services only were used, preserving original data volumes. Three isolated synthetic databases were removed and six original service states/images restored; see `cleanup-proof.json`. Other projects were not operated.

## Not delivered to production

This is a local, independently committed language correction. No push/remote CI or production V24 migration/deployment was attempted. The prior production SSH Permission denied has not been retried or bypassed. The real post 5 mixed-language body remains unchanged until this feature is deployed and its reviewed translations are saved through the normal UI. Automatic AI translation connectivity remains unverified; the delivered explicit manual workflow works without it.
