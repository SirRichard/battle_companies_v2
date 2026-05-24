# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Responsive Layout Overflow on Narrow Viewports
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate layout overflow at narrow viewport widths
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: viewport widths 320px, 360px, 375px with components that overflow
  - Test that MemberRow at 360px viewport does not produce horizontal overflow (from Bug Condition: viewportWidth < 600 AND component = MemberRow)
  - Test that the stat grid in MemberDetailsDrawer at 320px viewport does not overflow (from Bug Condition: viewportWidth < 400 AND component = StatGrid)
  - Test that HistoryMatchCard metadata at 400px viewport wraps without overflow (from Bug Condition: viewportWidth < 600 AND component = HistoryMetadata)
  - Test that the wizard stepper at 375px viewport does not overflow (from Bug Condition: viewportWidth < 600 AND component = WizardStepper)
  - Run test on UNFIXED code - expect FAILURE (this confirms the bug exists)
  - Document counterexamples found (e.g., "stat grid scrollWidth 310px exceeds clientWidth 280px at 320px viewport")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Desktop Layout and Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: At viewport widths ≥ 900px, content containers render with existing maxWidth values (700px for roster, 600px for wizard)
  - Observe: Theme colors (primary.main = #C9A84C), font families (Cinzel Decorative, IM Fell English), and spacing remain applied
  - Observe: MemberRow renders all content (name, role chip, hero stats, wargear chips, rating) in a single horizontal flex row at desktop widths
  - Observe: Stat grid renders all 9 columns in a single row with `flex: 1` per cell at widths ≥ 600px
  - Write property-based test: for all viewport widths ≥ 900px, existing layout structure is preserved (from Preservation Requirements in design)
  - Write property-based test: for all viewport widths ≥ 600px, stat grid renders 9 cells in a single row without wrapping
  - Verify tests pass on UNFIXED code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Implement responsive layout fixes

  - [x] 3.1 Add responsive stat grid layout to MemberDetailsDrawer
    - Change stat grid container from single-row flex to allow wrapping on narrow viewports
    - Add `flexWrap: 'wrap'` with responsive flex values: `flex: { xs: '0 0 20%', sm: 1 }` so stats wrap into 2 rows (5+4) on mobile
    - Ensure minimum cell width of 32px is maintained at all viewport sizes
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 400 AND component = StatGrid_
    - _Expected_Behavior: stat grid wraps into multiple rows, each cell ≥ 32px wide, no horizontal overflow_
    - _Preservation: At viewportWidth ≥ 600, stat grid renders identically as single row with flex: 1_
    - _Requirements: 2.1, 3.2_

  - [x] 3.2 Add responsive MemberRow layout to CompanyDetailsPage
    - Wrap MemberRow content: on mobile (< sm), stack secondary content (wargear chips, hero M/W/F stats, rating) below the name/role line
    - Use responsive `sx` props: `flexDirection: { xs: 'column', sm: 'row' }` for the outer container
    - Keep name + role chip on the first line; move hero stats, wargear, and rating to a second row on mobile
    - Ensure tap target remains the full card area for opening MemberDetailsDrawer
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 600 AND component = MemberRow_
    - _Expected_Behavior: secondary content stacks below name/role on mobile, no horizontal overflow_
    - _Preservation: At viewportWidth ≥ 600, MemberRow renders as single horizontal flex row_
    - _Requirements: 2.3, 3.1, 3.4_

  - [x] 3.3 Add compact wizard stepper for mobile in CreateCompanyPage
    - Use `useMediaQuery(theme.breakpoints.down('sm'))` to detect mobile viewport
    - On mobile: replace the full `<Stepper alternativeLabel>` with a compact indicator showing "Step X of 8" with a `<LinearProgress>` bar
    - On tablet/desktop: keep the existing `<Stepper alternativeLabel>` unchanged
    - Ensure backward navigation (clicking completed steps) still works via the compact indicator
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 600 AND component = WizardStepper_
    - _Expected_Behavior: compact progress indicator fits within viewport without overlap_
    - _Preservation: At viewportWidth ≥ 600, full alternativeLabel stepper renders unchanged_
    - _Requirements: 2.2, 3.3_

  - [x] 3.4 Add responsive MemberMatchCard layout to MatchTrackingPage
    - Ensure stat grid uses `flexWrap: 'wrap'` with responsive flex values for narrow viewports
    - Reduce M/W/F control button sizes on mobile using responsive `sx` props (smaller IconButton, tighter gap)
    - Stack card sections (name row, stat block, M/W/F controls, XP/casualty) vertically with appropriate spacing on mobile
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 600 AND component = MemberMatchCard_
    - _Expected_Behavior: all controls accessible without horizontal scrolling, stat grid wraps cleanly_
    - _Preservation: At viewportWidth ≥ 600, MemberMatchCard renders with current layout_
    - _Requirements: 2.4, 3.5_

  - [x] 3.5 Fix HistoryMatchCard metadata overflow on mobile
    - Change metadata item `minWidth: 100` to responsive value: `minWidth: { xs: 70, sm: 100 }`
    - Ensure flex-wrap container reflows items to new lines on narrow viewports
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 600 AND component = HistoryMetadata_
    - _Expected_Behavior: metadata items wrap to new lines without horizontal overflow_
    - _Preservation: At viewportWidth ≥ 600, metadata items render with minWidth 100 as before_
    - _Requirements: 2.8_

  - [x] 3.6 Increase content container maxWidth for tablet and desktop
    - CompanyDetailsPage roster: change `maxWidth: 700` to `maxWidth: { xs: '100%', sm: '100%', md: 900, lg: 1100 }`
    - CreateCompanyPage wizard content: increase maxWidth for tablet/desktop breakpoints
    - AppLayout: no changes needed (it uses flex column with no maxWidth constraint)
    - _Bug_Condition: isBugCondition(input) where viewportWidth >= 600 AND component = ContentContainer AND maxWidth too narrow_
    - _Expected_Behavior: content containers use more available space on tablet (800–900px) and desktop (960–1100px)_
    - _Preservation: On mobile (< 600px), content remains full-width as before_
    - _Requirements: 2.5, 2.6_

  - [x] 3.7 Fix FAB and fixed-position elements for very narrow viewports
    - Adjust FAB "Start Match" button: use responsive sizing `size: { xs: 'small', sm: 'medium' }` and reduce right/bottom margin on xs
    - Ensure sticky footer "End Match" button on MatchTrackingPage remains within viewport at 320px
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 360 AND component IN [FAB, StickyFooter]_
    - _Expected_Behavior: fixed elements remain fully visible within viewport, no overlap with critical content_
    - _Preservation: At viewportWidth ≥ 360, FAB and footer render with current sizing and positioning_
    - _Requirements: 2.7_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Responsive Layout Overflow on Narrow Viewports
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no overflow at narrow viewports)
    - When this test passes, it confirms the responsive fixes resolve the overflow bugs
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Desktop Layout and Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npm run build` to verify TypeScript compilation succeeds with no errors
  - Run `npm run test` to verify all existing and new tests pass
  - Ensure no regressions in existing property-based tests
  - Ask the user if questions arise
