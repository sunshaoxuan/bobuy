# Product detail layout acceptance

Final production release: **20261112.detail-layout.2**, source **a3b0d1796a8d44d25b65ffd673d3d7c8a2378039**. The first layout source is d158c0d; the final follow-up restores the catalog specification's original language attribute. It changes no CSS, text selection, pricing, or recommendation markup. `compatibility/unchanged-style-binding.json` proves identical CSS files, and the unchanged recommendation/geometry evidence is reused under that boundary.

The top fixed drawer bar contains the content-sized black No. badge before any media. Brand, localized title, Japanese source name and labeled product facts form distinct groups. A light reference-price panel retains currency, original amount, reduction, source channel, dates and HTTPS source. Offer conditions remain fully visible in their own section. No source facts, availability rules, histories, or customer data were rewritten.

`production-matrix.json` and production screenshots cover 360/390/510/1440px in four languages using published product 66517. `production-catalog-gallery.json` and `compatibility-production-catalog-gallery.json` cover the real catalog entry, next image, thumbnail restore, close and disabled purchasing. Synthetic boundary screenshots are explicitly marked synthetic in `synthetic-results.json`.

`glyph-pixels.json` covers 32 actual No./close regions; `action-glyph-pixels.json` covers 32 source/action regions. The original source-link optical failure is preserved in `source-action-glyph-before.json` and `source-control-before-390.png`. All final regions pass the original safety/centering budget. The validators are exact execution evidence and assume execution from frontend for JS and the task root for Python; preserve the relative working-directory context when replaying.

Related tests: 76, final structure: 52, language compatibility: 24; these sets overlap and must not be summed. Results, commands and log hashes are in `test-results.json`. CodeQL succeeded for both runtime sources; final exact-source result is in `compatibility/ci.json`.

`artifact.json` / `production-binding.json` bind the first layout image. **compatibility/artifact.json** and **compatibility/production-binding.json** bind the final image and all 79 frontend files. Only frontend changed; all other service identities remained unchanged and restart counts were zero. The account-layout baseline and first detail image remain recovery targets for application-only rollback. No database restore or schema operation was part of this task.
