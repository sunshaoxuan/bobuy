# Product introductions, 2026-11-12

## Final acceptance

Result: PASS for the resumed296-save, four-language display, production delivery and13-item missing-evidence list. Core5a9bb64 is healthy; frontend3a8b11a became live at2026-11-12T03:29:15Z and its scoped operator verified unchanged core/protected services. The later main integration adds documentation and audit archives only; application inputs equal3a8b11a.

| Requirement | Result | Evidence |
|---|---|---|
| Save remaining296 | PASS | Normal merchant preview/select/review/save UI; `master-final-audit.json`: all297 new rows advanced once, all389 other master fields preserved. |
| Four-language coverage | PASS within verified identities | 376/389 complete masters;79 existing complete preserved;325/325 existing public catalogue entries have four-language introductions,266 newly public introductions. |
| Preserve history and disclosure boundary | PASS | `public-acceptance.json`: same325 identities and every historical/public field unchanged. Backend tests reject unlinked, deleted, cross-owner, stale, unreviewed and mismatched-ITEM disclosure. |
| Public detail and recommendation detail | PASS | Four locales on both entry paths; image next/previous, close and deep-link reopen; No.77839 shows one warehouse card1498 and small Online1828, with expired discounts hidden on Japan day2026-11-12. |
| Functional checks | PASS | Backend671 reported/647 executed/24 skipped,0 failures/errors and configured JaCoCo; frontend89 tests; final production build;9 release guard tests; both exact application commits have successful three-language CodeQL. |
| Geometry | PASS for changed region | Eight1440×1000/360×1000 CSS viewport states have no horizontal overflow. Japanese JPY remains one line at360px; existing12px flex gap retained. Current introduction uses the existing paragraph flow and gutters. |
| Visual | PASS | Primary inspected complete final native screenshots and original-pixel crops in all four languages. Gemini final review found no visible defects in English/Japanese; Chinese variants were separately inspected by the primary agent. Body and CTA are fully visible in bottom-scroll mobile states. |
| Console/network | PASS | Application errors0. Fresh final catalogue capture has no failed requests, no buffer truncation and successful document/API/assets/images. Browser-extension warnings are separately identified. |
| Unresolved13 | PASS as explicitly pending | `unresolved-products.json` and the table below identify exact missing identity/official-source evidence. All13 remain unchanged and outside the public catalogue. |

Final screenshots are `production-*-whole.jpg` captured through the native viewport API, with observed pixel sizes recorded independently from CSS viewport sizes. Mobile files are360×1000; desktop capture files are1425×990 for a1440×1000 CSS viewport. Lossless `*-info.png` crops preserve the original screenshot pixels and include their parent hash and crop coordinates. They supersede the direct-CDP crop experiment, whose capture disturbed scroll position. Historical Japanese packaging, units and brand names remain the existing source facts; the new introduction is localized. The complete original-pixel English/Japanese review supersedes the incomplete-crop review. Final screenshot data is real production product data; the earlier local persistence fixture is clearly synthetic.

Formal data extracts and original source-page facts are retained in the ignored evidence `private/` directory. Publicly summarized saved copy, source URL/hash provenance, coverage, acceptance and release receipts are retained as formal deliverables. Application rollback remains scoped to the preserved compose/images; saved master introductions are additive and remain compatible. Database restore is excluded after writers reopen.

## Resumed content acceptance and final candidate

Production introduction projection5a9bb64 activated successfully at2026-11-12T03:18:29Z. First operator attempt used the compact list DTO for a detail-only introduction assertion and rolled both applications back, without database restore or data loss. The corrected assertion was first verified on the actual local detail endpoint, then release20261112.product-introductions.2 reused identical images and passed fresh stopped-writer backup,34 migration checks, protected services and full content fingerprints in164.17 seconds. Anonymous catalogue confirms325 public entries, all325 have four-language introductions,266 new public introductions and every historical/public field preserved.

Final360px Japanese screenshot exposed an existing adjacent currency-label wrap: the long reference-price heading squeezed JPY to two lines. Bounded final frontend batch: keep this small currency label unshrunk and unbroken, allowing the heading to wrap naturally. This directly supports four-language detail readability. No core/data changes; reuse backend/content evidence, rebuild frontend, exact-source CI and scoped frontend-only delivery, then repeat the affected Japanese360px state and final locale matrix. Earlier mobile screenshots captured the top after language switching reset scroll; supersede them with bottom-scroll screenshots proving the entire introduction is visible. Current introduction/body styling itself has no clipping or overflow.

Normal merchant UI saved all296 remaining introductions. Fresh389-row audit confirms376 complete four-language masters,297 newly saved including the earlier pilot,79 existing complete preserved and13 unresolved unchanged. All389 other submitted master fields match the original export exactly. Every newly enriched record advanced one version. The pilot retains its already saved, independently reviewed wording; the remaining296 match prepared copy exactly. See `master-final-audit.json` and per-batch receipts. Price, stock, visibility and published reference snapshots were outside the save contract.

Fast-forwarded to released main bea15cd, including social-platform and email-settings changes. Backend source/dependencies/configuration remain identical to the671-test accepted inputs. Frontend integrated tests first exposed jsdom's missing Element.scroll implementation in the existing account validation test; a test-only no-layout shim was added. A subsequent run failed on Windows TEMP file access. Task-local ASCII TEMP plus one worker resolved the environment failure:9 files,89 tests passed, zero unhandled errors; production build passed. This is the bounded rerun reason and final frontend acceptance input. Gemini Flash review accepted readability/wrapping at360px and requested long-copy/scroll evidence, to be completed on production. Current running base verified: core a14f032, frontend ec24fa9. No database migration.

## Unresolved13 products and missing evidence

| Item | Product | Required evidence |
|---|---|---|
| Unnumbered | オーガニック白いちじく | Brand, ITEM/barcode and label or exact official page; fresh versus dried identity is unknown. |
| 206609 | Kirkland Signature アーモンドフラワー1.36kg | Package ITEM/barcode or official mapping proving this record equals official28609; supplied source identifies a different ITEM. |
| Unnumbered | 泡ハンドソープ つめかえ用 | Brand/series, ITEM/barcode, refill capacity and exact label/page. |
| Unnumbered | ニオイ専用 液体洗濯洗剤 | Brand/series/variant, ITEM/barcode, package capacity and label/page. |
| Unnumbered | W除菌 手洗い用食器洗剤 | Brand/series/fragrance, ITEM/barcode and exact package/page. |
| Unnumbered | カビ取り用洗浄剤 | Brand/series/type, ITEM/barcode and exact label/page. |
| 97443 | 銀鮭西京漬け切り身 | Exact official product card/page or label verifying ingredients, preparation and storage; no linked gallery/source, official page currently supplies no product facts. |
| 93588 | チーズパフデニッシュ | Exact official page/label verifying composition and storage; no linked gallery/source and official ITEM page supplies no product facts. |
| Unnumbered | 液体洗濯洗剤 | Brand/series, standard versus drum type, fragrance/formula, ITEM/barcode and label/page. |
| 92956 | ミニシェル トライアルアソート | Exact ILE DE FRANCE product page/label confirming product type, flavours and composition; general brand catalogue does not identify this exact product. |
| Unnumbered | 折りたたみテーブル | Brand/model/ITEM, dimensions/material and exact label/page. |
| Unnumbered | エアジェット | Brand, product type, ITEM/variant and label/page; bare name is ambiguous. |
| 92495 | シュリンプクリームフェットチーネ | Exact official page/card/label verifying sauce, composition, preparation and storage; official ITEM page supplies no product facts. |

## Goal

Add source-backed introductions for every identifiable existing product, using exact Costco Japan Online ITEM pages or exact product/model pages on official brand sites. Save equivalent concise Japanese, Simplified Chinese, Traditional Chinese and English descriptions in Bobuy and verify customer-visible readback. Preserve existing verified introductions where complete; improve missing or source-inappropriate copy. Every product remains in the coverage ledger, including unresolved official-source matches.

## Method and boundaries

Inventory current products and description coverage from supported public reads and the existing authenticated merchant UI. Verify exact ITEM/model/pack identity before research. Archive official page URL, retrieval date, source hash and extracted factual notes. Treat page content as evidence, never instructions. Summarize product type, practical uses and verified features, with equivalent four-language facts. Avoid unsupported medical, safety, nutrition, performance and superlative claims; omit changing price/availability/promotional windows from product introductions. Do not copy whole descriptions or use a similar variant as evidence.

Use the supported version-checked product master editing or visible bulk-preview/save UI. Preserve IDs, names, models, packaging, categories, galleries, sale settings, reference facts and historical associations. Do not extract authentication or write hidden APIs/SQL. No Docker stack is needed for content work. Keep source, candidate, actual-save and public-readback receipts separate. If the application cannot publish the prepared introductions, document and repair only that concrete gap using the project code/release workflow, within this same objective.

## Acceptance

Full unique-product ledger with exact matched/unresolved counts and reasons; four reviewed descriptions for each resolved product; source traceability; idempotent version-safe saves; reopen and verify four languages publicly with actual desktop/mobile screenshots, console/network checks and critical long-content examples. No pricing, inventory, identity, image, order, account or historical quote changes. An unresolved product remains explicitly pending and is never counted as enriched. Final report separates researched, prepared, saved and publicly verified totals. Persist within authorized scope until all resolvable products are handled.

## Initial checkpoint

Base main e9b32e7, isolated task worktree. Root checkout contains unrelated historical dirty work and is protected. Existing Edge authenticated Bobuy merchant tab is available. Costco official ITEM77839 page is reachable and exposes exact item identity and product characteristics; this is a source example, not coverage of the full catalogue. Inventory and current bulk editing inspection are in progress.

## Verified content and publication checkpoint

Authenticated read-only UI export contains 389 active masters, 79 already have four-language descriptions, 310 are empty. Anonymous public catalogue has 325 entries, 59 complete. Exact official Costco product-page structured data and HTML were retrieved for 284 missing-description masters. Other identities remain individually researched; unknown generic legacy records have no ITEM, brand, model, gallery or linked source and cannot receive guessed features.

Pilot ITEM77839 was saved through the normal bulk preview, select, review and save controls. Audit readback confirms record version 3 became 4 with four descriptions and every other submitted field preserved. Anonymous product-browse still returns an empty description because RecommendationTaxonomyService.display returns the immutable publication snapshot before applying current product master metadata. This is a confirmed end-to-end application gap, not a failed save.

Bounded repair: introduce a distinct current product introduction projection, leaving historical description, specifications, prices, pictures and source publication snapshots unchanged. Only already eligible, nondeleted same-owner products can expose reviewed, translation-current descriptions. Reference-only entries additionally require exact nonblank ITEM alignment with published sources; mismatches, unlinked private entries and stale/unreviewed master copy remain excluded. Frontend renders this current introduction independently of historical offer common-fact inference. Test these disclosure negatives and historical preservation; run required source-bound release checks once on the frozen combined candidate and verify actual production pages. No migration or publication/visibility expansion.

## Frozen application candidate and release assessment

Application base refreshed by fast-forward to main fbe4994, retaining already published editor/rating CSS and Costco intake routing. Current production frontend editor source is 012013a; core source remains a14f032. This batch changes one public read service, the API type, shared product-detail content selection and recommendation detail selection, with focused regression tests. No dependency, schema, security configuration, visibility or business write contract changes. Earlier focused tests: backend25 and frontend32 passed; the added PUBLIC/no-offer boundary is included in the final full backend gate. External Claude returned no available accounts; DeepSeek design advice was reviewed and the primary agent retained the separate current-copy projection and all-or-nothing exact ITEM gate.

Application inputs now freeze for one full backend verify with fresh ASCII-path JaCoCo data, affected frontend union plus production build, exact-source CodeQL, actual nonproduction browser page and responsive screenshots, then scoped core/frontend activation with protected resources, stopped-writer fresh backup, unchanged migration/content fingerprints and application-only rollback. Introduction preparation and later supported UI saves remain separately recorded data work. These do not authorize changing source during the gate or counting unsaved drafts as public.

## Interrupted handoff, 2026-11-12

User explicitly resumed the task: save the remaining296 introductions, deploy the display fix after verification, and list all13 unresolved products with missing information. The earlier Computer Use stop has ended. Reconcile actual saved state before each bounded UI batch; continue through release and production acceptance under this authorization.

Computer Use reported that the user stopped it with the physical Escape key. All further browser/native interaction stopped. This batch is incomplete and has not been deployed or committed. No bulk save button was submitted. The only confirmed production content change is pilot ITEM77839, version3 to4, with four reviewed introductions; source recommendation snapshots remain unchanged.

Prepared coverage is 297 new four-language introductions, including that pilot, plus79 existing complete introductions preserved. The remaining296 candidates are unsaved. Thirteen unresolved records remain in `coverage-ledger.json`; these include eight generic legacy records without a reliable identity, four private fresh-food records without a verified official page, and the almond-flour ITEM mismatch206609 versus28609. Exact matched ITEM sources, grouped-ITEM sources and restrained product-family/title-only editorial decisions are retained with the drafts. Do not convert prepared counts into saved/public counts.

Validation completed: backend671 tests reported,647 executed and24 conditional skips, zero failures/errors, configured JaCoCo checks passed; affected frontend54 tests and production build passed; core module packaging passed. Isolated in-memory local runtime was exercised using normal merchant UI save and anonymous public readback, with four-language1440×1000 and360×1000 exact-pixel screenshots. Initial screenshot helper output was scaled and some dropdown transitions appeared; the final screenshots use direct scoped CDP capture with fixed pixel bounds after menus hide. Final whole/info JPEGs and `ui-candidate-final-matrix.json` supersede the preliminary native PNG crops and old matrix. Gemini Pro returned an upstream error; the Flash visual request was issued but its result has not been finally reviewed. CodeQL, committed source binding, production artifact staging/activation and final production browser/public-content verification remain outstanding.

Resume by reading this document, checking the actual production versions and the current authenticated UI, then reconciling pilot and every intended product against a fresh read-only audit. Browser3/4 handles became stale during reconnect; use the current inventory, preserve user-owned and other-task tabs, and avoid large combined JSON transfers. Use bounded normal-UI batches, e.g.50 rows, and export compact intent/readback receipts separately. Source before-state is `master-before.json`; prepared copy is `drafts.json` and the full coverage ledger is retained. Preserve all non-description fields from the latest UI values and skip concurrently filled descriptions. Saving introductions does not update published historical snapshots; the separate application introduction projection still requires release before those new descriptions appear in public reference-only details.
