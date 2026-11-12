# Editor and rating delivery

Production: 20261112.editor-rating, source 012013ad330f81f8c293148564860ed31fd7178c.
Only frontend changed. artifact.json binds every built file, image ID, prior frontend and unchanged core. production-verify.json confirms protected services unchanged and no database writes by the release operator.

production-matrix.json covers four locales and 360/390/1440px, draft/date disclosure, language switch, synthetic save/reload, cancel navigation, long fields, published toolbar and absence on the list. Every API in these editor cases was intercepted; no live article was saved. production-control-pixels.json covers 132 native image ink regions against the original budgets. Default/expanded/published/long screenshots and native header/article crops remain separately available.

production-public.json uses real public catalog data with no API interception: 24 rating rows, 16 exact loaded assets and successful public API reads. production-rating-colors.json covers synthetic full/empty/half scores in real catalog components and the review dialog at all three widths. Raw native crops show the half-star split. The editor matrix records Cloudflare /cdn-cgi/rum ERR_ABORTED during intentional reloads separately; application failures remain rejected.

tests.json records 78 passes at e4c3f83. The final toolbar visibility predicate changes only Recommendations.tsx; tests-toolbar.json records its 12 passes, with 66 unchanged rating/date tests reused. Counts overlap. build-final.log is the final production build. ci-source.json and ci-main-integration.json are successful exact runtime-source and integration checks; the former Java job retried after Maven Central returned 429.

Gemini advice remains in gemini-final.txt. visual-acceptance.json records the primary review and adjudication, including a scaled-image half-star misreading corrected from native pixels. All 36 corresponding default editor screenshots/crops from production and local build match byte-for-byte in production-screenshot-binding.json. Published screenshots wait for tab motion to settle.

Replay browser validators by copying the archived .mjs into frontend after installing the pinned dependencies; execute there with EDITOR_BASE and EDITOR_PREFIX. They require Edge via Playwright. The Python validator runs from the repository root, taking the screenshot prefix and optional output filename. The archived frontend operator and stage-release.py are version-specific release evidence, not generic deployment commands.
