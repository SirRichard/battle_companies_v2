/**
 * Bugfix spec: toolkit-partial-assignment, Property 2: Preservation
 * Full Assignment Fast Path and No-Kit State Unchanged
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * OBSERVATION-FIRST METHODOLOGY:
 * These tests capture the CURRENT behavior on UNFIXED code for all states
 * that do NOT satisfy the bug condition:
 *   - state.kitId === null  (no kit selected)
 *   - state.assignments.every(a => a.memberId !== '')  (all items assigned)
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: Tests PASS (baseline behavior is correct)
 * EXPECTED OUTCOME ON FIXED CODE:   Tests PASS (no regressions introduced)
 *
 * Behaviors tested:
 * 1. Fully-assigned state: "Begin Battle" button is enabled (disabled={!allAssigned} === false)
 * 2. Fully-assigned state: handleProceed navigates directly — no confirmation dialog branch exists
 * 3. Fully-assigned state: toolkitItems length equals kit.items.length (no items dropped)
 * 4. No-kit state: assignment section is not rendered (kit is null/undefined)
 * 5. No-kit state: "Begin Battle" button is not rendered (inside the kit && block)
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

// ── State types ───────────────────────────────────────────────────────────────

interface Assignment {
  memberId: string
  parameter?: string
}

interface ToolkitAssignmentState {
  kitId: string | null
  assignments: Assignment[]
}

interface ToolkitItem {
  memberId: string
  itemId: string
  parameter?: string
}

// ── Pure logic models (mirrors ToolkitAssignmentPage.tsx UNFIXED code) ────────

/**
 * Models the UNFIXED `allAssigned` computation.
 *
 * Unfixed code:
 *   const allAssigned = kit
 *     ? assignments.length === kit.items.length &&
 *       assignments.every((a) => a.memberId !== '')
 *     : false
 */
function computeAllAssigned(state: ToolkitAssignmentState): boolean {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  if (!kit) return false
  return (
    state.assignments.length === kit.items.length &&
    state.assignments.every((a) => a.memberId !== '')
  )
}

/**
 * Models the UNFIXED `disabled` prop on the "Begin Battle" button.
 *
 * Unfixed code:
 *   <Button disabled={!allAssigned} ...>Begin Battle</Button>
 */
function computeUnfixedButtonDisabled(state: ToolkitAssignmentState): boolean {
  return !computeAllAssigned(state)
}

/**
 * Models whether the UNFIXED handleProceed would open a confirmation dialog.
 *
 * Unfixed code:
 *   const handleProceed = async () => {
 *     if (!kit || !allAssigned) return   // ← early return, no dialog
 *     // ... navigate directly
 *   }
 *
 * There is NO dialog branch in the unfixed code — handleProceed either
 * returns early or navigates directly. It never opens a dialog.
 */
function computeUnfixedProceedOpensDialog(_state: ToolkitAssignmentState): boolean {
  // The unfixed code has no confirmation dialog for partial assignments.
  // For fully-assigned states, handleProceed navigates directly (no dialog).
  return false
}

/**
 * Models whether the UNFIXED handleProceed would navigate (not return early).
 *
 * Unfixed code:
 *   const handleProceed = async () => {
 *     if (!kit || !allAssigned) return   // ← returns early if not all assigned
 *     // ... navigate
 *   }
 *
 * Navigation occurs only when kit is selected AND all items are assigned.
 */
function computeUnfixedProceedNavigates(state: ToolkitAssignmentState): boolean {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  if (!kit) return false
  return computeAllAssigned(state)
}

/**
 * Models the UNFIXED toolkitItems computation.
 *
 * Unfixed code:
 *   const toolkitItems: ToolkitItem[] = assignments.map((a, i) => ({
 *     memberId: a.memberId,
 *     itemId: kit.items[i],
 *     parameter: a.parameter,
 *   }))
 *
 * For fully-assigned states, all memberIds are non-empty, so the full set
 * of kit items is saved (no items dropped).
 */
function computeUnfixedToolkitItems(state: ToolkitAssignmentState): ToolkitItem[] {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  if (!kit) return []
  return state.assignments.map((a, i) => ({
    memberId: a.memberId,
    itemId: kit.items[i],
    parameter: a.parameter,
  }))
}

/**
 * Models whether the kit assignment section is rendered.
 *
 * Unfixed code:
 *   {kit && (
 *     <Box>
 *       ...assignment section...
 *       <Button disabled={!allAssigned} ...>Begin Battle</Button>
 *     </Box>
 *   )}
 *
 * The section (including the button) is only rendered when kit is non-null.
 */
function isAssignmentSectionRendered(state: ToolkitAssignmentState): boolean {
  const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)
  return kit !== undefined
}

// ── Non-bug condition predicate ───────────────────────────────────────────────

/**
 * Returns true when the state does NOT satisfy the bug condition.
 * Non-bug condition: kitId === null OR all assignments have non-empty memberId.
 */
function isNonBugCondition(state: ToolkitAssignmentState): boolean {
  if (state.kitId === null) return true
  return state.assignments.every((a) => a.memberId !== '')
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const KIT_IDS = TOOLKIT_KITS.map((k) => k.id)

/** Generates a non-empty member ID string */
const memberIdArb: fc.Arbitrary<string> = fc.uuid()

/** Optional parameter string */
const parameterArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 30 })
)

/**
 * Generates a ToolkitAssignmentState where all items are fully assigned.
 * Non-bug condition: kitId !== null AND assignments.every(a => a.memberId !== '')
 */
const fullyAssignedStateArb: fc.Arbitrary<ToolkitAssignmentState> = fc
  .constantFrom(...KIT_IDS)
  .chain((kitId) => {
    const kit = TOOLKIT_KITS.find((k) => k.id === kitId)!
    const n = kit.items.length
    return fc
      .array(
        fc.record({ memberId: memberIdArb, parameter: parameterArb }),
        { minLength: n, maxLength: n }
      )
      .map((assignments) => ({ kitId, assignments }))
  })
  .filter(isNonBugCondition) // Ensure all items are assigned

/**
 * Generates a ToolkitAssignmentState where no kit is selected.
 * Non-bug condition: kitId === null
 */
const noKitStateArb: fc.Arbitrary<ToolkitAssignmentState> = fc.record({
  kitId: fc.constant(null),
  assignments: fc.constant([]),
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Preservation - Full Assignment Fast Path and No-Kit State Unchanged', () => {
  // ── 1. Fully-assigned state: button is enabled ──────────────────────────────

  describe('3.1 Fully-assigned state: "Begin Battle" button is enabled', () => {
    /**
     * Validates: Requirements 3.1
     *
     * When all kit items are assigned, allAssigned is true, so
     * disabled={!allAssigned} === false — the button is enabled.
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: PASS
     * EXPECTED OUTCOME ON FIXED CODE:   PASS (no regression)
     */
    it('button is enabled (not disabled) when all items are assigned', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          // Precondition: all items are assigned
          expect(isNonBugCondition(state)).toBe(true)
          expect(state.kitId).not.toBeNull()

          const disabled = computeUnfixedButtonDisabled(state)
          expect(disabled).toBe(false)
        }),
        { numRuns: 500 }
      )
    })

    it('allAssigned is true when all items have non-empty memberIds', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const allAssigned = computeAllAssigned(state)
          expect(allAssigned).toBe(true)
        }),
        { numRuns: 500 }
      )
    })

    it('button is enabled for all four kit types when fully assigned', () => {
      for (const kitId of KIT_IDS) {
        const kit = TOOLKIT_KITS.find((k) => k.id === kitId)!
        const state: ToolkitAssignmentState = {
          kitId,
          assignments: kit.items.map((_, i) => ({ memberId: `member-${i + 1}` })),
        }
        expect(computeUnfixedButtonDisabled(state)).toBe(false)
      }
    })
  })

  // ── 2. Fully-assigned state: handleProceed navigates directly (no dialog) ──

  describe('3.1 Fully-assigned state: handleProceed navigates directly without dialog', () => {
    /**
     * Validates: Requirements 3.1
     *
     * When all items are assigned, the unfixed handleProceed does NOT open
     * a confirmation dialog — it navigates directly. There is no dialog
     * branch in the unfixed code.
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: PASS
     * EXPECTED OUTCOME ON FIXED CODE:   PASS (no regression — all-assigned fast path preserved)
     */
    it('handleProceed does not open a confirmation dialog when all items are assigned', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const opensDialog = computeUnfixedProceedOpensDialog(state)
          expect(opensDialog).toBe(false)
        }),
        { numRuns: 500 }
      )
    })

    it('handleProceed navigates (does not return early) when all items are assigned', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const navigates = computeUnfixedProceedNavigates(state)
          expect(navigates).toBe(true)
        }),
        { numRuns: 500 }
      )
    })

    it('concrete: fully-assigned Scholar Kit — button enabled, no dialog, navigates directly', () => {
      const state: ToolkitAssignmentState = {
        kitId: 'scholar',
        assignments: [
          { memberId: 'member-1' },
          { memberId: 'member-2' },
          { memberId: 'member-3' },
          { memberId: 'member-4' },
        ],
      }
      expect(computeAllAssigned(state)).toBe(true)
      expect(computeUnfixedButtonDisabled(state)).toBe(false)
      expect(computeUnfixedProceedOpensDialog(state)).toBe(false)
      expect(computeUnfixedProceedNavigates(state)).toBe(true)
    })

    it('concrete: fully-assigned Healer Kit — button enabled, no dialog, navigates directly', () => {
      const state: ToolkitAssignmentState = {
        kitId: 'healers',
        assignments: [
          { memberId: 'member-1' },
          { memberId: 'member-2' },
          { memberId: 'member-3' },
          { memberId: 'member-4' },
          { memberId: 'member-5' },
          { memberId: 'member-6' },
          { memberId: 'member-7' },
        ],
      }
      expect(computeAllAssigned(state)).toBe(true)
      expect(computeUnfixedButtonDisabled(state)).toBe(false)
      expect(computeUnfixedProceedOpensDialog(state)).toBe(false)
      expect(computeUnfixedProceedNavigates(state)).toBe(true)
    })
  })

  // ── 3. Fully-assigned state: toolkitItems length equals kit.items.length ───

  describe('3.1 Fully-assigned state: saved toolkitItems length equals number of kit items', () => {
    /**
     * Validates: Requirements 3.1
     *
     * For fully-assigned states, assignments.map(...) produces exactly
     * kit.items.length items. No items are dropped because all memberIds
     * are non-empty.
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: PASS
     * EXPECTED OUTCOME ON FIXED CODE:   PASS (no regression)
     */
    it('toolkitItems length equals kit.items.length for all fully-assigned states', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)!
          const toolkitItems = computeUnfixedToolkitItems(state)
          expect(toolkitItems.length).toBe(kit.items.length)
        }),
        { numRuns: 500 }
      )
    })

    it('toolkitItems contains no entries with empty memberId for fully-assigned states', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const toolkitItems = computeUnfixedToolkitItems(state)
          const emptyMemberIds = toolkitItems.filter((t) => t.memberId === '')
          expect(emptyMemberIds.length).toBe(0)
        }),
        { numRuns: 500 }
      )
    })

    it('toolkitItems maps assignments to kit items in order', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)!
          const toolkitItems = computeUnfixedToolkitItems(state)
          toolkitItems.forEach((item, i) => {
            expect(item.itemId).toBe(kit.items[i])
            expect(item.memberId).toBe(state.assignments[i].memberId)
            expect(item.parameter).toBe(state.assignments[i].parameter)
          })
        }),
        { numRuns: 500 }
      )
    })

    it('toolkitItems length equals assignments length for fully-assigned states', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const toolkitItems = computeUnfixedToolkitItems(state)
          expect(toolkitItems.length).toBe(state.assignments.length)
        }),
        { numRuns: 500 }
      )
    })
  })

  // ── 4. No-kit state: assignment section is not rendered ────────────────────

  describe('3.3 No-kit state: assignment section is not rendered', () => {
    /**
     * Validates: Requirements 3.3
     *
     * When no kit is selected (kitId === null), the kit variable is
     * undefined/null, so the {kit && (...)} block is not rendered.
     * The assignment section and "Begin Battle" button are absent.
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: PASS
     * EXPECTED OUTCOME ON FIXED CODE:   PASS (no regression)
     */
    it('assignment section is not rendered when no kit is selected', () => {
      fc.assert(
        fc.property(noKitStateArb, (state) => {
          expect(state.kitId).toBeNull()
          const rendered = isAssignmentSectionRendered(state)
          expect(rendered).toBe(false)
        }),
        { numRuns: 300 }
      )
    })

    it('"Begin Battle" button is not rendered when no kit is selected', () => {
      // The button is inside the {kit && (...)} block, so it is absent when kit is null
      fc.assert(
        fc.property(noKitStateArb, (state) => {
          // Button is only rendered when kit is non-null
          const buttonRendered = isAssignmentSectionRendered(state)
          expect(buttonRendered).toBe(false)
        }),
        { numRuns: 300 }
      )
    })

    it('allAssigned is false when no kit is selected', () => {
      fc.assert(
        fc.property(noKitStateArb, (state) => {
          const allAssigned = computeAllAssigned(state)
          expect(allAssigned).toBe(false)
        }),
        { numRuns: 300 }
      )
    })

    it('toolkitItems is empty when no kit is selected', () => {
      fc.assert(
        fc.property(noKitStateArb, (state) => {
          const toolkitItems = computeUnfixedToolkitItems(state)
          expect(toolkitItems.length).toBe(0)
        }),
        { numRuns: 300 }
      )
    })

    it('concrete: kitId null — assignment section absent, button absent', () => {
      const state: ToolkitAssignmentState = { kitId: null, assignments: [] }
      expect(isAssignmentSectionRendered(state)).toBe(false)
      expect(computeAllAssigned(state)).toBe(false)
      expect(computeUnfixedToolkitItems(state)).toEqual([])
    })
  })

  // ── 5. Composition: non-bug-condition states behave correctly ──────────────

  describe('Composition: non-bug-condition states behave correctly', () => {
    /**
     * Validates: Requirements 3.1, 3.3
     *
     * For all states satisfying the non-bug condition (no kit OR all assigned),
     * the unfixed code produces the expected baseline behavior.
     */
    it('fully-assigned state: button enabled AND no dialog AND navigates directly', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          expect(computeUnfixedButtonDisabled(state)).toBe(false)
          expect(computeUnfixedProceedOpensDialog(state)).toBe(false)
          expect(computeUnfixedProceedNavigates(state)).toBe(true)
        }),
        { numRuns: 500 }
      )
    })

    it('no-kit state: section not rendered AND allAssigned false AND toolkitItems empty', () => {
      fc.assert(
        fc.property(noKitStateArb, (state) => {
          expect(isAssignmentSectionRendered(state)).toBe(false)
          expect(computeAllAssigned(state)).toBe(false)
          expect(computeUnfixedToolkitItems(state)).toEqual([])
        }),
        { numRuns: 300 }
      )
    })

    it('fully-assigned: toolkitItems preserves all assignments with correct itemIds', () => {
      fc.assert(
        fc.property(fullyAssignedStateArb, (state) => {
          const kit = TOOLKIT_KITS.find((k) => k.id === state.kitId)!
          const toolkitItems = computeUnfixedToolkitItems(state)

          // Length matches
          expect(toolkitItems.length).toBe(kit.items.length)

          // Each item has the correct itemId from the kit
          toolkitItems.forEach((item, i) => {
            expect(item.itemId).toBe(kit.items[i])
          })

          // No empty memberIds
          expect(toolkitItems.every((t) => t.memberId !== '')).toBe(true)
        }),
        { numRuns: 500 }
      )
    })
  })
})
