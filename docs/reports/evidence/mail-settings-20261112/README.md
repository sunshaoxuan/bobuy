# Mail settings acceptance, 2026-11-12

Final production: 20261112.mail-settings.3, activated 11:22:52 JST. Source f4fae3d05d61c2b697cba4f6ac62f07b55d58790. Frontend image sha256:8f4159e5441f03c1385b2988fe242ecef5a921ef63c7a38a5220eb60ff250307. PR66 and PR67 merged. Exact-source CodeQL run 43140249364 succeeded.

- accepted-zh-CN-1440.png: final live production overview, 1440x1000 viewport with full-page capture.
- accepted-zh-CN-390.png and accepted-zh-CN-320.png: final live narrow layouts, 1000px viewport height, full-page captures.
- accepted-form-native.png and accepted-test-native.png: unscaled crops from the final actual overview. No redraw or composite.
- accepted-matrix.json / accepted-glyph-pixels.json: final configured state, 36 actual-ink control checks passed with the unchanged centering and padding budget. Password is editable and empty; sole approved recipient is selected. No additional mail sent.
- final-matrix.json / glyph-pixels.json: four languages and three viewports, 144 control checks passed for the unconfigured state. Valid for unchanged placeholder, field and button inputs. production-matrix.json / production-glyph-pixels.json preserve the earlier selected-recipient failure; they are superseded by accepted evidence.
- ready-local-matrix.json / ready-local-glyph-pixels.json: final CSS in a real built browser page with explicitly synthetic readiness, 36 checks passed. Proxy contains no key/password, blocks mail writes and uses the existing local stack.
- tests.json: 10 focused mail-page behavior tests passed, zero failures. i18n (1665 keys), TypeScript and Vite build passed. Existing circular-chunk warnings remain unchanged.
- browser-functional.json: actual local draft cancellation, restore confirmation, form checking, settings HTTP200 and no application console errors. Final correction changes only selected-recipient CSS; these mail JS results remain valid. production-functional.json states the exact live/reuse boundary and the interrupted optional extra save.
- inbox.json: one fixed test mail verified in INBOX with normal TLS certificate validation, exact subject, sender/recipient and token-free body. Production audit recorded TEST_SUCCESS at 10:52:23 JST. Mail enabled=false; no customer, registration or external recipient test.
- production-activate.json / artifact.json / gates.json: exact assets, immutable source/image, previous frontend recovery image and scoped activation. Other containers and the database remained unchanged. Core's earlier key-mount activation kept its original image.
- gemini-final.md: independent Gemini review and primary-agent judgment. No blocking visual defect found.

Protected key material and SMTP credentials are absent from this evidence directory. Root-only keyring plus separate current-user DPAPI recovery were verified. Restore the prior frontend image/config for application rollback; retain the keyring and encrypted DB state. Do not restore an old business database over new writes.

For the original request, editable configuration and password entry, safe persistence, controlled real delivery, visible status/feedback and responsive layout are accepted. Existing business-delivery and registration gates remain independently controlled.
