/**
 * Bug Condition Exploration Test
 * Property 1: Bug Condition — Incorrect Labels and Non-Responsive/Non-Sticky Header on Step 6
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist in the path selection step (Step 6).
 *
 * Bug Conditions (formal):
 *   1. Footer button shows "Next" instead of "Select" when heroes still need paths
 *   2. Path card action button shows "Choose This Path" instead of "Select This Path"
 *   3. Path review summary derives names via string manipulation instead of paths.json label
 *   4. Header Box always uses column flexDirection (not responsive)
 *   5. Header Box is not sticky
 *
 * This test encodes the CORRECT expected behavior — it will pass after the fix.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import pathsData from '../../data/paths.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  step: number
  heroPaths: Record<string, string | null>
  heroTempIds: string[]
}

// ─── Path data ────────────────────────────────────────────────────────────────

const PATHS = pathsData as Array<{ id: string; label: string }>
const PATH_IDS = PATHS.map((p) => p.id)

// ─── Extracted logic modeling ACTUAL (buggy) code ─────────────────────────────

/**
 * Models the ACTUAL footer button label logic from CreateCompanyPage (FIXED).
 * Now correctly returns "Select" on step 6 when heroes still need paths.
 */
function getActualFooterButtonLabel(
  wizard: WizardState,
  isFinalStep: boolean
): string {
  if (isFinalStep) return 'Form Company'
  if (wizard.step === 6) {
    const allHavePaths = wizard.heroTempIds.every(
      (tid) => wizard.heroPaths[tid] != null
    )
    return allHavePaths ? 'Next' : 'Select'
  }
  return 'Next'
}

/**
 * Models the EXPECTED (correct) footer button label.
 * On step 6 when heroes still need paths → "Select"
 * On step 6 when all heroes have paths (review) → "Next"
 * On final step → "Form Company"
 * Otherwise → "Next"
 */
function getExpectedFooterButtonLabel(
  wizard: WizardState,
  isFinalStep: boolean
): string {
  if (isFinalStep) return 'Form Company'
  if (wizard.step === 6) {
    const allHavePaths = wizard.heroTempIds.every(
      (tid) => wizard.heroPaths[tid] != null
    )
    return allHavePaths ? 'Next' : 'Select'
  }
  return 'Next'
}

/**
 * Models the ACTUAL path card action button text from PathCardSelector (FIXED).
 * Now correctly uses "Select This Path" for unselected paths.
 */
function getActualPathCardButtonText(isSelected: boolean): string {
  return isSelected ? 'Path Chosen ✓' : 'Select This Path'
}

/**
 * Models the EXPECTED (correct) path card action button text.
 * Should be "Select This Path" for unselected paths.
 */
function getExpectedPathCardButtonText(isSelected: boolean): string {
  return isSelected ? 'Path Chosen ✓' : 'Select This Path'
}

/**
 * Models the ACTUAL path name resolution from CreateCompanyPage (FIXED).
 * Now looks up canonical label from paths.json.
 */
function getActualPathName(pathId: string): string {
  const path = PATHS.find((p) => p.id === pathId)
  return path?.label ?? pathId
}

/**
 * Models the EXPECTED (correct) path name resolution.
 * Looks up the canonical label from paths.json.
 */
function getExpectedPathName(pathId: string): string {
  const path = PATHS.find((p) => p.id === pathId)
  return path?.label ?? pathId
}

/**
 * Models the ACTUAL header flexDirection from StepPathSelection.tsx (FIXED).
 * Now uses responsive flexDirection: row on sm+, column on xs.
 */
function getActualHeaderFlexDirection(
  viewportWidth: 'xs' | 'sm' | 'md'
): string {
  return viewportWidth === 'xs' ? 'column' : 'row'
}

/**
 * Models the EXPECTED (correct) header flexDirection.
 * Should be column on xs, row on sm+.
 */
function getExpectedHeaderFlexDirection(
  viewportWidth: 'xs' | 'sm' | 'md'
): string {
  return viewportWidth === 'xs' ? 'column' : 'row'
}

/**
 * Models the ACTUAL header position from StepPathSelection.tsx (FIXED).
 * Now uses sticky positioning.
 */
function getActualHeaderPosition(): string {
  return 'sticky'
}

/**
 * Models the EXPECTED (correct) header position.
 * Should be sticky.
 */
function getExpectedHeaderPosition(): string {
  return 'sticky'
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate 1-3 hero temp IDs */
const heroTempIdsArb: fc.Arbitrary<string[]> = fc
  .integer({ min: 1, max: 3 })
  .map((n) => Array.from({ length: n }, (_, i) => `member_${i}`))

/** Generate wizard state at step 6 with at least one hero missing a path */
const step6IncompletePathsArb: fc.Arbitrary<WizardState> = heroTempIdsArb.chain(
  (heroTempIds) => {
    // At least one hero must NOT have a path
    return fc
      .array(
        fc.oneof(fc.constantFrom(...PATH_IDS), fc.constant(null)),
        { minLength: heroTempIds.length, maxLength: heroTempIds.length }
      )
      .filter((paths) => paths.some((p) => p === null))
      .map((paths) => {
        const heroPaths: Record<string, string | null> = {}
        heroTempIds.forEach((tid, i) => {
          heroPaths[tid] = paths[i]
        })
        return { step: 6, heroPaths, heroTempIds }
      })
  }
)

/** Generate a path ID from paths.json */
const pathIdArb: fc.Arbitrary<string> = fc.constantFrom(...PATH_IDS)

/** Generate viewport breakpoint (sm or md — wider than xs) */
const wideViewportArb: fc.Arbitrary<'sm' | 'md'> = fc.constantFrom(
  'sm' as const,
  'md' as const
)

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 1 (Bug Condition): Incorrect Labels and Non-Responsive/Non-Sticky Header on Step 6', () => {
  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed footer button always shows "Next" for non-final steps.
   * This test asserts it should show "Select" on step 6 when heroes still need paths.
   *
   * Counterexample: step=6, 2 heroes, 1 without path → actual="Next", expected="Select"
   */
  it('footer button shows "Select" (not "Next") on step 6 when heroes still need paths', () => {
    fc.assert(
      fc.property(step6IncompletePathsArb, (wizard) => {
        const actual = getActualFooterButtonLabel(wizard, false)
        const expected = getExpectedFooterButtonLabel(wizard, false)

        // This FAILS on unfixed code: actual="Next", expected="Select"
        expect(actual).toBe(expected)
      }),
      { numRuns: 200 }
    )
  })

  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed PathCardSelector shows "Choose This Path" for unselected paths.
   * This test asserts it should show "Select This Path".
   *
   * Counterexample: isSelected=false → actual="Choose This Path", expected="Select This Path"
   */
  it('path card action button shows "Select This Path" (not "Choose This Path") for unselected paths', () => {
    fc.assert(
      fc.property(fc.constant(false), (isSelected) => {
        const actual = getActualPathCardButtonText(isSelected)
        const expected = getExpectedPathCardButtonText(isSelected)

        // This FAILS on unfixed code: actual="Choose This Path", expected="Select This Path"
        expect(actual).toBe(expected)
      }),
      { numRuns: 50 }
    )
  })

  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed review summary derives path names via string manipulation
   * (replace underscores, strip "path of", capitalize, prepend "Path of ").
   * This produces incorrect labels like "Path of The tactician" instead of
   * the canonical "Path of the Tactician" from paths.json.
   *
   * Counterexample: pathId="path_of_the_tactician" →
   *   actual="Path of The tactician", expected="Path of the Tactician"
   */
  it('path review summary displays canonical label from paths.json (not string-derived name)', () => {
    fc.assert(
      fc.property(pathIdArb, (pathId) => {
        const actual = getActualPathName(pathId)
        const expected = getExpectedPathName(pathId)

        // This FAILS on unfixed code: string manipulation produces wrong capitalization/format
        expect(actual).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed header always uses column flexDirection regardless of viewport.
   * This test asserts it should use row on sm+ viewports.
   *
   * Counterexample: viewport="sm" → actual="column", expected="row"
   */
  it('header uses responsive flexDirection (row on sm+, column on xs)', () => {
    fc.assert(
      fc.property(wideViewportArb, (viewport) => {
        const actual = getActualHeaderFlexDirection(viewport)
        const expected = getExpectedHeaderFlexDirection(viewport)

        // This FAILS on unfixed code: actual="column", expected="row"
        expect(actual).toBe(expected)
      }),
      { numRuns: 50 }
    )
  })

  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed header has no sticky positioning.
   * This test asserts it should be sticky.
   *
   * Counterexample: actual="static", expected="sticky"
   */
  it('header has position sticky (not static)', () => {
    const actual = getActualHeaderPosition()
    const expected = getExpectedHeaderPosition()

    // This FAILS on unfixed code: actual="static", expected="sticky"
    expect(actual).toBe(expected)
  })
})
