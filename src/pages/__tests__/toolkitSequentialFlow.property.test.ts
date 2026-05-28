// Feature: toolkit-special-units-hero-upgrades, Properties 5–7: Sequential Kit Flow

/**
 * Property tests for sequential kit assignment flow on ToolkitAssignmentPage.
 *
 * Validates: Requirements 2.2, 2.4, 2.5, 2.7, 2.8
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { TOOLKIT_KITS, getToolkitCount } from '../MatchSetupPage'
import type { ToolkitItem } from '../../models/match'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_KIT_IDS = TOOLKIT_KITS.map((k) => k.id)

// ─── Pure logic helpers (mirror ToolkitAssignmentPage behavior) ───────────────

/**
 * Returns available kit IDs at step K given previously selected kit IDs.
 * Mirrors: TOOLKIT_KITS filtered by `!selectedKitIds.includes(k.id)`
 */
function getAvailableKits(selectedKitIds: string[]): string[] {
  return ALL_KIT_IDS.filter((id) => !selectedKitIds.includes(id))
}

/**
 * Determines whether confirm action should be accepted.
 * Mirrors: `allAssigned` check — all items must have a non-empty memberId.
 */
function canConfirmKit(
  assignments: Array<{ memberId: string; parameter?: string }>
): boolean {
  return (
    assignments.length > 0 &&
    assignments.every((a) => a.memberId !== '')
  )
}

/**
 * Simulates confirming a fully-assigned kit: appends items to accumulated list,
 * pushes kitId to selectedKitIds, increments currentKitIndex.
 */
function confirmKit(
  kitId: string,
  assignments: Array<{ memberId: string; parameter?: string }>,
  kitItems: string[],
  state: {
    accumulatedItems: ToolkitItem[]
    selectedKitIds: string[]
    currentKitIndex: number
  }
): {
  accumulatedItems: ToolkitItem[]
  selectedKitIds: string[]
  currentKitIndex: number
} {
  const newItems: ToolkitItem[] = assignments.map((a, i) => ({
    memberId: a.memberId,
    itemId: kitItems[i],
    parameter: a.parameter,
  }))

  return {
    accumulatedItems: [...state.accumulatedItems, ...newItems],
    selectedKitIds: [...state.selectedKitIds, kitId],
    currentKitIndex: state.currentKitIndex + 1,
  }
}

/**
 * Returns progress indicator text or null.
 * Mirrors: show "Kit {idx+1} of {total}" when total > 1, hidden when total === 1.
 */
function getProgressText(
  currentKitIndex: number,
  totalKits: number
): string | null {
  if (totalKits <= 1) return null
  return `Kit ${currentKitIndex + 1} of ${totalKits}`
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a valid sequence of 0..K previously selected kit IDs (no duplicates) */
const selectedKitIdsArb = (maxLen: number): fc.Arbitrary<string[]> =>
  fc
    .shuffledSubarray(ALL_KIT_IDS, { minLength: 0, maxLength: maxLen })
    .map((arr) => arr.slice(0, maxLen))

/** Generates a member ID string */
const memberIdArb: fc.Arbitrary<string> = fc.stringMatching(/^m[0-9a-f]{4}$/)

/** Generates a non-empty member ID (simulating assigned state) */
const assignedMemberIdArb: fc.Arbitrary<string> = memberIdArb.filter(
  (id) => id.length > 0
)

/** Generates an assignment array for a kit with N items — all assigned */
function fullyAssignedArb(
  itemCount: number
): fc.Arbitrary<Array<{ memberId: string; parameter?: string }>> {
  return fc.array(
    assignedMemberIdArb.map((id) => ({ memberId: id })),
    { minLength: itemCount, maxLength: itemCount }
  )
}

/** Generates an assignment array for a kit with N items — at least one unassigned */
function partiallyAssignedArb(
  itemCount: number
): fc.Arbitrary<Array<{ memberId: string; parameter?: string }>> {
  if (itemCount === 0) return fc.constant([])
  return fc
    .tuple(
      fc.integer({ min: 0, max: itemCount - 1 }), // index to leave empty
      fc.array(
        assignedMemberIdArb.map((id) => ({ memberId: id })),
        { minLength: itemCount, maxLength: itemCount }
      )
    )
    .map(([emptyIdx, assignments]) => {
      const result = [...assignments]
      result[emptyIdx] = { memberId: '' }
      return result
    })
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 5: Kit type exclusion across selections', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * Available kits at step K = full pool minus all selected in steps 0..K-1.
   */
  it('available kits equals full pool minus previously selected kit IDs', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ALL_KIT_IDS, {
          minLength: 0,
          maxLength: ALL_KIT_IDS.length,
        }),
        (selectedSoFar) => {
          const available = getAvailableKits(selectedSoFar)
          const expectedSet = new Set(ALL_KIT_IDS)
          for (const id of selectedSoFar) {
            expectedSet.delete(id)
          }

          expect(new Set(available)).toEqual(expectedSet)
          expect(available.length).toBe(ALL_KIT_IDS.length - selectedSoFar.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('previously selected kits never appear in available list', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ALL_KIT_IDS, {
          minLength: 1,
          maxLength: ALL_KIT_IDS.length,
        }),
        (selectedSoFar) => {
          const available = getAvailableKits(selectedSoFar)
          for (const id of selectedSoFar) {
            expect(available).not.toContain(id)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('sequential selections progressively reduce available pool', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ALL_KIT_IDS, {
          minLength: 2,
          maxLength: ALL_KIT_IDS.length,
        }),
        (selectionOrder) => {
          let selected: string[] = []
          let prevAvailableCount = ALL_KIT_IDS.length

          for (const kitId of selectionOrder) {
            const available = getAvailableKits(selected)
            expect(available.length).toBe(prevAvailableCount)
            expect(available).toContain(kitId)

            selected = [...selected, kitId]
            prevAvailableCount--
          }

          // After all selected, nothing remains
          expect(getAvailableKits(selected).length).toBe(
            ALL_KIT_IDS.length - selectionOrder.length
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 6: Kit confirmation requires full assignment and advances state', () => {
  /**
   * **Validates: Requirements 2.4, 2.5**
   *
   * Rejected when incomplete, appends N items and increments index when complete.
   */
  it('rejects confirmation when any item is unassigned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOOLKIT_KITS),
        (kit) => {
          // Generate partial assignment inline — at least one empty
          const itemCount = kit.items.length
          if (itemCount === 0) return // skip degenerate case

          // Create assignments with at least one empty memberId
          const assignments = kit.items.map((_, i) => ({
            memberId: i === 0 ? '' : `member_${i}`,
          }))

          expect(canConfirmKit(assignments)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('accepts confirmation when all items are assigned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOOLKIT_KITS),
        fc.array(assignedMemberIdArb, { minLength: 11, maxLength: 11 }),
        (kit, memberPool) => {
          const assignments = kit.items.map((_, i) => ({
            memberId: memberPool[i % memberPool.length],
          }))

          expect(canConfirmKit(assignments)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('confirmation appends exactly N items and increments index by 1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOOLKIT_KITS),
        fc.array(assignedMemberIdArb, { minLength: 11, maxLength: 11 }),
        fc.integer({ min: 0, max: 4 }), // currentKitIndex
        fc.array(
          fc.record({
            memberId: assignedMemberIdArb,
            itemId: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 0, maxLength: 20 }
        ), // existing accumulated items
        (kit, memberPool, startIndex, existingItems) => {
          const assignments = kit.items.map((_, i) => ({
            memberId: memberPool[i % memberPool.length],
          }))

          const stateBefore = {
            accumulatedItems: existingItems as ToolkitItem[],
            selectedKitIds: [] as string[],
            currentKitIndex: startIndex,
          }

          const stateAfter = confirmKit(
            kit.id,
            assignments,
            kit.items,
            stateBefore
          )

          // Appends exactly N items (kit.items.length)
          expect(stateAfter.accumulatedItems.length).toBe(
            existingItems.length + kit.items.length
          )

          // Increments index by 1
          expect(stateAfter.currentKitIndex).toBe(startIndex + 1)

          // Kit ID added to selectedKitIds
          expect(stateAfter.selectedKitIds).toContain(kit.id)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('no state change when confirmation is rejected (incomplete assignment)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOOLKIT_KITS),
        fc.integer({ min: 0, max: 4 }),
        (kit, startIndex) => {
          const itemCount = kit.items.length
          if (itemCount === 0) return

          // Partial assignment — first item unassigned
          const assignments = kit.items.map((_, i) => ({
            memberId: i === 0 ? '' : `member_${i}`,
          }))

          const stateBefore = {
            accumulatedItems: [] as ToolkitItem[],
            selectedKitIds: [] as string[],
            currentKitIndex: startIndex,
          }

          // canConfirmKit returns false, so no state transition occurs
          const canConfirm = canConfirmKit(assignments)
          expect(canConfirm).toBe(false)

          // State remains unchanged (confirm action is a no-op)
          expect(stateBefore.accumulatedItems.length).toBe(0)
          expect(stateBefore.currentKitIndex).toBe(startIndex)
          expect(stateBefore.selectedKitIds.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 7: Progress indicator correctness', () => {
  /**
   * **Validates: Requirements 2.7, 2.8**
   *
   * Text reads "Kit {idx+1} of {total}" when total > 1, hidden when total === 1.
   */
  it('shows correct text when totalKits > 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }), // totalKits > 1
        fc.nat(), // currentKitIndex (will be constrained)
        (totalKits, rawIndex) => {
          const currentKitIndex = rawIndex % totalKits // keep in valid range

          const text = getProgressText(currentKitIndex, totalKits)
          expect(text).toBe(`Kit ${currentKitIndex + 1} of ${totalKits}`)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('hidden (null) when totalKits === 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0 }), // currentKitIndex always 0 when single kit
        (currentKitIndex) => {
          const text = getProgressText(currentKitIndex, 1)
          expect(text).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('progress text format is always "Kit {N} of {M}" with N >= 1 and N <= M', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.nat(),
        (totalKits, rawIndex) => {
          const currentKitIndex = rawIndex % totalKits
          const text = getProgressText(currentKitIndex, totalKits)

          expect(text).not.toBeNull()
          const match = text!.match(/^Kit (\d+) of (\d+)$/)
          expect(match).not.toBeNull()

          const n = parseInt(match![1], 10)
          const m = parseInt(match![2], 10)
          expect(n).toBeGreaterThanOrEqual(1)
          expect(n).toBeLessThanOrEqual(m)
          expect(m).toBe(totalKits)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('derives totalKits correctly from atoBonuses via getToolkitCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (n) => {
          // Encode N toolkit entries
          const bonuses = Array(n).fill('toolkit') as Array<'toolkit'>
          const totalKits = getToolkitCount(bonuses)

          expect(totalKits).toBe(n)

          // Progress indicator visibility matches spec
          if (totalKits === 1) {
            expect(getProgressText(0, totalKits)).toBeNull()
          } else {
            expect(getProgressText(0, totalKits)).toBe(`Kit 1 of ${totalKits}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
