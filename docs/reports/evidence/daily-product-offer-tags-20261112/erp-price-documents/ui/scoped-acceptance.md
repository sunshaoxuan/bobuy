# Final scoped UI acceptance

Candidate 2124f4df66cdce193373e94f49e0d7955eb2ac75. Actual built frontend, released core image and isolated PostgreSQL V35; synthetic account/products only. Desktop 1440x1080, mobile 360x800.

Function PASS: existing product price entry opens its related documents; new document is fixed to the current product; reason/amount/unit/period save and reload; permanent selection omits the end field. Independent route/navigation removed. The unchanged canonical pricing/approval/cancellation rules retain prior real-PG and API evidence.

Environment exceptions: the local core-only application returns 403 for unrelated AI-onboarding endpoints, and seeded external images have DNS failures. The actual errors remain in resumed-result.json. All changed pricing calls succeeded. These exceptions were not presented as a clean whole-product network result. Toasts expire; screenshots wait for their disappearance. Resizing can retrigger the unrelated parent requests. No product code or authorization was changed to hide the exceptions.

Geometry PASS: glyph-measurements.json locates ink in real screenshot pixels for 21 visible controls using the existing fixed margin/center budgets. Prior unchanged input/action measurements remain applicable. Mobile primary buttons are 44px high with 8px gap. The new disabled product selection preserves its existing control geometry.

Visual PASS: scoped-desktop.png shows the existing outer product drawer; scoped-desktop-form.png and scoped-form-detail.png show the full form and original-size detail. scoped-mobile-form.png and scoped-mobile-actions.png establish the scrollable mobile form and reachable grouped buttons. The table has intentional horizontal scrolling. Drawer frames, headers, common baselines and spacing were checked in the final screenshots. Gemini initially flagged toast occlusion and a missing bottom-state screenshot; those evidence gaps were corrected, and its final review found no blocking layout defect. The main agent independently accepts the scoped UI with the environment exceptions above. No redesign or extra functionality was added.
