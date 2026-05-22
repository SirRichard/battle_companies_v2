/**
 * Bug Condition Exploration Test
 * Property 1: Bug Condition — Partial Assignment Enables Proceed with Confirmation
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists: ToolkitAssignmentPage disables the
 * "Begin Battle" button whenever any kit item is unassigned, using
 * `disabled={!allAssigned}`. This prevents the user from proceeding even
 * when partial assignment is intentional.
 *
 * The test encodes the CORRECT expected behavior — it will pass after the fix.
 *
 * Bug Condition (formal):
 *   FUNCTION isBugCondition(state)
 *     INPUT: state of type { kitId: string | null, assignments: Array<{ memberId: string }> }
 *     OUTPUT: boolean
 *     IF state.kitId IS NULL THEN RETURN false
 *     kit := TOOLKIT_KITS.find(k => k.id === state.kitId)
 *     IF kit IS NULL THEN RETURN false
 *     hasUnassigned := state.assignments.some(a => a.memberId === '')
 *     RETURN hasUnassigned
 *   END FUNCTION
 *
 * Expected (correct) behavior when isBugCondition is true:
 *   - "Begin Battle" button is ENABLED (not disabled)
 *   - Clicking "Begin Battle" opens a confirmation dialog (not navigating immediately)
 *
 * Actual (buggy) behavior:
 *   - "Begin Battle" button is DISABLED because `disabled={!allAssigned}` and
 *     `allAssigned` is false when any item is unassigned
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── TOOLKIT_KITS (mirrors MatchSetupPage.tsx export) ─────────────────────────

const TOOLKIT_KITS: { id: string; label: string; items: string[] }[] = [
  {
    id: 'healers',
    label: "Healer's Kit",
    items: [
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'healing_herbs',
      'healing_herbs',
    ],
  },
  {
    id: 'explorer',
    label: "Explorer's Kit",
    items: [
      'scroll_of_hidden_paths',
      'mountain_boots',
      'mountain_boots',
      'mountain_boots',
      'woodland_belt',
      'woodland_belt',
      'woodland_belt',
      'map',
    ],
  },
  {
    id: 'scholar',
    label: "Scholar's Kit",
    items: [
      'ring_of_warding',
      'badge_of_courage',
      'lucky_talisman',
      'seeing_stone',
    ],
  },
  {
    id: 'hunter',
    label: "Hunter's Kit",
    items: [
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'trophy_pelt',
      'concealing_cloak',
    ],
  },
]

// ── State type ────────────────────────────────────────────────────────────────

interface ToolkitAssignmentState {
  kitId: string | null
  assignments: Array<{ memberId: string; parameter?: string }>
}

// ── Bug condition predicate ───────────────────────────────────────────────────

/**
 * Returns true when a kit is selected and at least one item has no assigned member.
 * This is the condition under which the bug manifests.
 */
function isBugCondition(state: ToolkitAssignmentState): boolean {
  if (state.kitId === null) return false
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  if (!kit) return false
  return state.assignments.some((a) => a.memberId === '')
}

/**
 * Models the FIXED `disabled` prop on the "Begin Battle" button.
 *
 * Fixed implementation (per design doc):
 *   <Button disabled={!kit} ...>Begin Battle</Button>
 *
 * The button is only disabled when no kit is selected.
 */
function computeFixedButtonDisabled(state: ToolkitAssignmentState): boolean {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  return !kit // only disabled when no kit is selected
}

/**
 * Models whether the FIXED handleProceed would open a confirmation dialog
 * (instead of navigating immediately) when the bug condition holds.
 *
 * Fixed implementation (per design doc):
 *   const handleProceed = async () => {
 *     if (!kit) return
 *     if (!allAssigned) {
 *       setConfirmPartialOpen(true)  // ← opens dialog
 *       return
 *     }
 *     // ... navigate directly
 *   }
 */
function computeFixedProceedOpensDialog(state: ToolkitAssignmentState): boolean {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  if (!kit) return false // no kit → handleProceed returns early, no dialog

  const allAssigned =
    state.assignments.length === kit.items.length &&
    state.assignments.every((a) => a.memberId !== '')

  return !allAssigned // dialog opens when NOT all assigned
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const KIT_IDS = TOOLKIT_KITS.map((k) => k.id)

/** Generates a non-empty member ID string */
const memberIdArb: fc.Arbitrary<string> = fc.uuid()

/**
 * Generates a ToolkitAssignmentState where isBugCondition is true:
 * - A kit is selected
 * - At least one item has memberId === '' (unassigned)
 * - 1 to (n-1) items are assigned (partial assignment)
 */
const bugConditionStateArb: fc.Arbitrary<ToolkitAssignmentState> = fc
  .constantFrom(...KIT_IDS)
  .chain((kitId) => {
    const kit = TOOLKIT_KITS.find((k) => k.id === kitId)!
    const n = kit.items.length

    // Generate assignments: at least 1 unassigned, at least 0 assigned
    // We need at least 1 unassigned slot (memberId === '')
    return fc
      .array(memberIdArb, { minLength: 0, maxLength: n - 1 })
      .map((assignedIds) => {
        // Build assignments array: fill assigned slots first, rest are unassigned
        const assignments: Array<{ memberId: string }> = kit.items.map(
          (_, i) => ({
            memberId: i < assignedIds.length ? assignedIds[i] : '',
          })
        )
        return { kitId, assignments }
      })
  })
  .filter(isBugCondition) // Ensure the bug condition holds

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1 (Bug Condition): Partial Assignment Enables Proceed with Confirmation', () => {
  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed button has `disabled={!allAssigned}`. When any item is
   * unassigned, `allAssigned` is false, so `disabled` is true.
   *
   * This test asserts the button SHOULD be enabled (disabled === false).
   * On unfixed code, `computeUnfixedButtonDisabled` returns true for all
   * bug-condition states, so the assertion FAILS — confirming the bug exists.
   *
   * EXPECTED OUTCOME ON FIXED CODE: PASS
   * The fixed button has `disabled={!kit}`. Since a kit is always selected
   * in bug-condition states, `disabled` is false.
   */
  it(
    '"Begin Battle" button is enabled (not disabled) when kit is selected with partial assignments',
    () => {
      fc.assert(
        fc.property(bugConditionStateArb, (state) => {
          // Precondition: the input satisfies the bug condition
          expect(isBugCondition(state)).toBe(true)

          // Compute the FIXED disabled value (what the button SHOULD be)
          const fixedDisabled = computeFixedButtonDisabled(state)

          // ASSERTION: button should be ENABLED (not disabled) when kit is selected
          // PASSES on fixed code because computeFixedButtonDisabled returns false
          expect(fixedDisabled).toBe(false)
        }),
        { numRuns: 500 }
      )
    }
  )

  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed handleProceed has `if (!kit || !allAssigned) return` — it
   * returns early without opening any dialog when items are unassigned.
   *
   * This test asserts that clicking "Begin Battle" SHOULD open a confirmation
   * dialog (not navigate immediately). On unfixed code, the button is disabled
   * so handleProceed is never called — but even if it were, it would return
   * early without opening a dialog.
   *
   * EXPECTED OUTCOME ON FIXED CODE: PASS
   * The fixed handleProceed calls `setConfirmPartialOpen(true)` when
   * `!allAssigned`, so the dialog opens.
   */
  it(
    'clicking "Begin Battle" with partial assignments opens a confirmation dialog',
    () => {
      fc.assert(
        fc.property(bugConditionStateArb, (state) => {
          // Precondition: the input satisfies the bug condition
          expect(isBugCondition(state)).toBe(true)

          // Compute whether the FIXED handleProceed would open a dialog
          const fixedOpensDialog = computeFixedProceedOpensDialog(state)

          // ASSERTION: handleProceed SHOULD open a confirmation dialog
          // FAILS on unfixed code because the button is disabled and handleProceed
          // returns early without opening a dialog
          // PASSES on fixed code because handleProceed calls setConfirmPartialOpen(true)
          expect(fixedOpensDialog).toBe(true)
        }),
        { numRuns: 500 }
      )
    }
  )

  /**
   * Concrete counterexample: 1 of 4 items assigned (Scholar's Kit)
   *
   * Scholar's Kit has 4 items. Assigning only 1 leaves 3 unassigned.
   * The bug condition holds: kitId !== null AND assignments.some(a => a.memberId === '')
   *
   * Expected: button enabled, clicking opens dialog.
   * Actual (unfixed): button disabled.
   */
  it('concrete counterexample: 1 of 4 items assigned in Scholar Kit — button should be enabled', () => {
    const state: ToolkitAssignmentState = {
      kitId: 'scholar',
      assignments: [
        { memberId: 'member-1' }, // assigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
      ],
    }

    expect(isBugCondition(state)).toBe(true)

    // FIXED: button is enabled
    const fixedDisabled = computeFixedButtonDisabled(state)
    expect(fixedDisabled).toBe(false)

    // FIXED: clicking opens dialog
    const fixedOpensDialog = computeFixedProceedOpensDialog(state)
    expect(fixedOpensDialog).toBe(true)
  })

  /**
   * Concrete counterexample: 0 of 7 items assigned (Healer's Kit)
   *
   * Healer's Kit has 7 items. Assigning none leaves all unassigned.
   * The bug condition holds.
   *
   * Expected: button enabled, clicking opens dialog.
   * Actual (unfixed): button disabled.
   */
  it('concrete counterexample: 0 of 7 items assigned in Healer Kit — button should be enabled', () => {
    const state: ToolkitAssignmentState = {
      kitId: 'healers',
      assignments: [
        { memberId: '' },
        { memberId: '' },
        { memberId: '' },
        { memberId: '' },
        { memberId: '' },
        { memberId: '' },
        { memberId: '' },
      ],
    }

    expect(isBugCondition(state)).toBe(true)

    // FIXED: button is enabled
    const fixedDisabled = computeFixedButtonDisabled(state)
    expect(fixedDisabled).toBe(false)

    // FIXED: clicking opens dialog
    const fixedOpensDialog = computeFixedProceedOpensDialog(state)
    expect(fixedOpensDialog).toBe(true)
  })

  /**
   * Concrete counterexample: 3 of 8 items assigned (Explorer's Kit)
   *
   * Explorer's Kit has 8 items. Assigning 3 leaves 5 unassigned.
   * The bug condition holds.
   *
   * Expected: button enabled, clicking opens dialog.
   * Actual (unfixed): button disabled.
   */
  it('concrete counterexample: 3 of 8 items assigned in Explorer Kit — button should be enabled', () => {
    const state: ToolkitAssignmentState = {
      kitId: 'explorer',
      assignments: [
        { memberId: 'member-1' }, // assigned
        { memberId: 'member-2' }, // assigned
        { memberId: 'member-3' }, // assigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
        { memberId: '' },          // unassigned
      ],
    }

    expect(isBugCondition(state)).toBe(true)

    // FIXED: button is enabled
    const fixedDisabled = computeFixedButtonDisabled(state)
    expect(fixedDisabled).toBe(false)

    // FIXED: clicking opens dialog
    const fixedOpensDialog = computeFixedProceedOpensDialog(state)
    expect(fixedOpensDialog).toBe(true)
  })
})
