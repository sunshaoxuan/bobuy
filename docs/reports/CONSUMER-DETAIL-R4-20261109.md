# Consumer detail R4: source/bundle candidate ready for independent QA

The only application delta from frozen R3 is one reference-heading rule in consumer-detail.css: padding-inline-end:calc(1em + 1px). Original twelve inputs and the46-file R3 package were hash-verified before editing. The old6PASS/1FAIL/9NOT_RUN browser result and exact original source/bundle are preserved. No facts, prices, permissions, API/DTOs, purchasing or administrative OfferInfo logic changed.

Original375px Japanese heading: computed18px type,339px border box,0padding, closing glyph18.015625px, text range340.921875px and1.921875px overflow. R4 reserves19px at that same font, preserving the text/type and allowing a legal wrap. It does not hide or clip overflow or reduce the strict assertion. Current375px Japanese heading is 18px/600, outer339px, inline-end padding19px, height54px and measured text overflow0.

## Actual validation

- Affected component suite7/7PASS (candidate-r4-1794233535714.log).40unchanged relevant source cases are reused from the frozen47-case suite, not counted again. TypeScript and i18n1388keys are reused because their source inputs are byte-identical; no new TypeScript/i18n run is claimed for the CSS-only R4.
- One complete production-mode Vite build plus home prerender PASS;46files, finished2026-11-09T14:14:52.186Z. Formal asset manifest SHA256 68c4838ecdb0a95be25618583d4a69bb1c020d3e27595df7c16c719aa05a2152. Current source and every formal asset are hash-guarded before preview.
- Exact original16combinations (358/375/390/1440 × zh-CN/zh-TW/ja-JP/en-US) now16/16PASS. All measured detail text ranges have0horizontal overflow. The matrix retained every original price/source/date/unknown-unit/medical-unavailable/image/two-level-Escape/card-return-focus assertion. A copy of the original driver only adds read-only heading computed evidence; its assertions and case set are unchanged.
- 176loaded static responses match formal-file hashes;28real anonymous public GET captures. No blocked requests, browser/replay errors, authentication/user profile or production writes. Preview uses configFile:false, empty server/preview proxies and strict127.0.0.1:4189;APIprobe501 proves no8080backend.

## Handoff and scope limits

The temporary native headless Edge and4189preview closed normally at2026-11-09T14:16:57.586Z; no build/test/browser/service remains in flight. Single768MiBVite was coordinated with menu and released at2026-11-09T14:14:52.186Z. NoJVM/Docker/PG, shared index/stage/commit, user/operator Edge, deployment or transaction action occurred.

This is developer acceptance of the exact independent R4full bundle, not the original independent QA or a deployed release. OriginalQA, merged CI/package, actual non-JPY public-price GUI, additional87406/87702 browser cases and Library reference pixels remain NOT_RUN/NOT_MATERIALIZED as before; no missing business data is fabricated. Root can immediately hand this source/delta/full candidate and exact assets to originalQA without waiting for date/article/C3.
