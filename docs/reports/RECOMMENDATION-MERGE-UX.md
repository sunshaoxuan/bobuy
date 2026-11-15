# Recommendation merge UX scope and acceptance

Authorized scope: the source-repair and missing-locale confirmation modal, related business copy, confirmation controls, focused service/UI tests, and §14 of the UI/UX guideline. This change does not alter publication gates, hashing, historical data, or production data.

Minimal verification: the repair component tests cover readable business labels, DOM/ARIA redaction, reject/edit/accept-all, cancellation, AI failure, and conflict draft retention; the focused repair service tests cover blank-only writes, conflict handling, translation provenance, and private artifact redaction; type checking covers the adjusted response projection. UI acceptance follows §8 and §9 at 390×844 and 1280×800.
