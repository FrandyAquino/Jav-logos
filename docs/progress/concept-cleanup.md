# Concept cleanup and deletion — 2026-11-25

Removed the Shared Brand DNA sidebar explanation and its unused CSS. The typography specimen now separates the family name from two short character/number samples, preventing the full alphabet from wrapping a lone letter into another line. Gallery cards align artwork at the top consistently.

Both canvas thumbnails and gallery cards use `ConceptCard` with a separate, keyboard-accessible delete button. `DeleteConceptDialog` captures the stable concept ID/name, initially focuses Cancel, explains loss of versions/notes/artwork references, and keeps Cancel/Escape/outside dismissals inert. In-flight deletion cannot be submitted twice or dismissed. Failed saves retain the concept and dialog for retry. Successful deletion selects the next/previous sibling only if the deleted concept is still selected; it never changes another selected brand. Deleting the last concept returns to the generation empty state. Saved history for the removed concept is cleared only after persistence succeeds.

Deletion removes the workspace record through the existing serialized native/browser persistence path. It does not remove the parent brand or exported files. Content-addressed files may remain unreferenced on disk; safe garbage collection is still separate work. There is no undo after confirmed deletion. No existing customer/QA records were deleted by this implementation task; browser tests used isolated test storage.

## Executed checks

- `npm run check`: TypeScript, ESLint,32 tests in18 files and production build passed.
- `npm run test:e2e`:12 Chromium flows passed, including new deletion confirmation/cancellation, failure/retry, focus recovery, gallery deletion, reload persistence and last-concept empty state.
- After the final gallery alignment CSS adjustment, `npx playwright test tests/e2e/workspace-workflow.spec.ts tests/e2e/ui-quality.spec.ts`:7 passed. Inspected `artifacts/concept-deletion-gallery.png` showing aligned cards, delete actions and the compact type specimen.
- Formatting and `git diff --check`: passed. Rust/Python source and IPC schemas are unchanged; their suites were not rerun for this presentation/application change.
- Native build/inspection follow-up is recorded below. No Windows/Linux runtime acceptance or signing claim.

Final native follow-up: `npm run tauri -- build --debug --bundles app` passed (macOS arm64 debug31.60MiB). Quit the idle previous build and opened the final bundle. Native AX/screenshot confirmed the removed sidebar explanation, corrected Google Sans Flex sample and delete buttons on all five existing thumbnails. Opened the Orbit study deletion dialog, observed Cancel initially focused, cancelled, and verified all five concepts remained and focus returned to its delete button. Native destructive confirmation was not executed against existing user data; actual removal/failure/retry was exercised in isolated browser storage. Local AI health reported ready. The app remains open; the current user's selected workspace is archived, so starting generation requires creating or restoring a brand. Existing Vite chunk-size warnings remain; cross-platform release gates are unchanged.
