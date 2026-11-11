# Final production acceptance

Production Core: `b8b7158054e855a3bc52eb6a41f966dc804e9dac`, release 20261111.4. Frontend: unchanged accepted `8bfb479e520c391e6ab1485e87be4ce55c9dca3e`, release 20261111.3. Database V32, no new migration. Final Core writers reopened 2026-11-11 11:43:31 UTC.

Functional, geometry, visual, performance and stability acceptance: PASS. [Final identity and health](final-result.json), [source-bound gates](accepted-gates.json), [performance](performance-summary.json), [native visual matrix](native-visual-matrix.json), [glyph and review dispositions](visual-observation-disposition.json).

| Page | Desktop 1440x900 | Phone 390x844 | Narrow 360x800 |
| --- | --- | --- | --- |
| Trip finds | [Overall](production-catalog-desktop.png), [original-pixel cards](production-catalog-desktop-cards.png) | [Overall](production-catalog-phone.png), [cards](production-catalog-phone-cards.png) | [Overall](production-catalog-narrow.png), [cards](production-catalog-narrow-cards.png) |
| Product picks | [Overall](production-recommendations-desktop.png), [cards](production-recommendations-desktop-cards.png) | [Initial layout](production-recommendations-phone-top.png), [scrolled viewport](production-recommendations-phone.png), [cards](production-recommendations-phone-cards.png) | [Overall](production-recommendations-narrow.png), [cards](production-recommendations-narrow-cards.png) |

Screenshots are native production pixels with real public product data. Crops preserve resolution. Reference prices keep their source/window labels. A discount-only product retains unknown sale price. No production review, customer order or invented sale amount was created. Local synthetic extremes, review roles/mean, issue/history/preview and independent row proofs remain in the linked main task record.

Gemini reviewed the original screenshots. Its brand/title and scrolled-header observations were independently checked: brand slots are 18px and same-row title top spread is 0.015625px; initial heading is 57.875px below the fixed header, and heading/directory centers match exactly. Narrow title ink margins are at least 4px horizontally and 7px vertically. Blank offscreen images loaded on real keyboard navigation. Raw advice is retained in `gemini-final-native-review.txt`; the primary agent made the final visual judgement from screenshots and measured evidence.

Backend: 660 tests, 636 passed and 24 conditional skips, zero failures/errors, configured JaCoCo checks passed. Frontend: exact reused 114 files/757 passed tests; TypeScript/i18n/build and 79 running frontend files are bound to the existing accepted manifest. Real PostgreSQL projection and image HTTP were verified with three deleted products in the isolated local copy. Production health passed 601.7 seconds/14 samples, zero restarts. Exact obsolete Core image removal retained running services and database backups.
