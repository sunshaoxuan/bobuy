# Visual findings before final acceptance

The primary agent viewed the actual 1440px and320px screenshots before considering geometry. The real HTTP workflow passed, but the visual state remains unaccepted.

- gallery-partial-status-320.png: an unbounded bold filename consumes most of the visible status area and makes per-file state difficult to scan. Desktop has the same issue at a less severe scale. Replace the default raw list with compact per-file status rows and an explicit accessible details disclosure containing the complete filename and asset references. Full long text must remain available on mobile.
- The waiting, failed and confirmed states use plain inline text with little hierarchy. Use the existing maintained Ant Tag component to distinguish states, keep the filename and status in a common row, and preserve detailed errors in the disclosure. No automatic upload retry/save behavior changes.
- Keep original screenshots and the already valid functional result. Recheck the modified status layout, default/expanded long filename,320px scroll access, glyph budgets and mobile44px primary/disclosure targets before final visual PASS. Do not use the previous functional PASS as visual acceptance.

The native filechooser timeout was traced to the QA selector resolving to an opacity-zero1px file input, not the visible Ant button. The script now selects the visible button explicitly; the native input is hidden and the visible control remains the accessible action. Chromium omits multipart file bytes from Request.postDataBuffer, so the QA observer records the actual FormData File properties and digest and compares with the real server digest, while forwarding the original request unchanged.
