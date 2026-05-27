/**
 * Property-based tests for src/utils/kitEligibility.ts
 * Feature: ato-kit-enhancements
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  hasDuplicateAssignment,
  hasPermanentOwnership,
  getItemIneligibilityReason,
} from '../kitEligibility'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbItemId = fc.string({ minLength: 1, maxLength: 20 })

const arbMemberId = fc.uuid()

const arbAssignment = fc.record({
  memberId: arbMemberId,
  itemId: arbItemId,
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: No duplicate kit item assigned to same member
// Validates: Requirements 3.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 5: No duplicate kit item assigned to same member
 *
 * **Validates: Requirements 3.1**
 *
 * For any valid assignment state produced by the eligibility logic, no member
 * should have more than one instance of the same itemId assigned to them.
 *
 * Strategy:
 * 1. Generate random assignment sequences and a target (memberId, itemId)
 * 2. If the target pair already exists in assignments, hasDuplicateAssignment returns true
 * 3. If the target pair does NOT exist, hasDuplicateAssignment returns false
 * 4. getItemIneligibilityReason returns non-null when duplicate detected
 */
describe('Feature: ato-kit-enhancements, Property 5: No duplicate kit item assigned to same member', () => {
  it('hasDuplicateAssignment returns true when same (memberId, itemId) already exists in assignments', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        arbItemId,
        fc.array(arbAssignment, { maxLength: 10 }),
        (memberId, itemId, otherAssignments) => {
          // Inject the target pair into assignments
          const assignments = [
            ...otherAssignments,
            { memberId, itemId },
          ]

          expect(hasDuplicateAssignment(memberId, itemId, assignments)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('hasDuplicateAssignment returns false when (memberId, itemId) pair does not exist in assignments', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        arbItemId,
        fc.array(arbAssignment, { maxLength: 10 }),
        (memberId, itemId, assignments) => {
          // Filter out any existing match to guarantee pair is absent
          const filtered = assignments.filter(
            (a) => !(a.memberId === memberId && a.itemId === itemId)
          )

          expect(hasDuplicateAssignment(memberId, itemId, filtered)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('getItemIneligibilityReason returns non-null reason when duplicate assignment exists', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        arbItemId,
        fc.array(arbAssignment, { maxLength: 10 }),
        fc.array(arbItemId, { maxLength: 5 }),
        (memberId, itemId, otherAssignments, ownedEquipment) => {
          // Inject duplicate into assignments
          const assignments = [
            ...otherAssignments,
            { memberId, itemId },
          ]

          // Remove itemId from ownedEquipment to isolate duplicate check
          const cleanOwned = ownedEquipment.filter((e) => e !== itemId)

          const reason = getItemIneligibilityReason(memberId, itemId, assignments, cleanOwned)
          expect(reason).not.toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('building assignments via eligibility check never produces duplicates for same member', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        fc.array(arbItemId, { minLength: 1, maxLength: 8 }),
        (memberId, kitItems) => {
          // Simulate sequential assignment: only assign if eligible
          const assignments: Array<{ memberId: string; itemId: string }> = []

          for (const itemId of kitItems) {
            const reason = getItemIneligibilityReason(memberId, itemId, assignments, [])
            if (reason === null) {
              assignments.push({ memberId, itemId })
            }
          }

          // Verify: no member has duplicate itemId
          const seen = new Set<string>()
          for (const a of assignments) {
            if (a.memberId === memberId) {
              expect(seen.has(a.itemId)).toBe(false)
              seen.add(a.itemId)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: No kit item assigned to member with permanent ownership
// Validates: Requirements 3.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 6: No kit item assigned to member with permanent ownership
 *
 * **Validates: Requirements 3.2**
 *
 * For any member whose ownedEquipment contains item X, the eligibility function
 * should return an ineligibility reason (non-null) when attempting to assign
 * kit item X to that member.
 *
 * Strategy:
 * 1. Generate random ownedEquipment lists and pick an item from them
 * 2. hasPermanentOwnership returns true when item is in ownedEquipment
 * 3. hasPermanentOwnership returns false when item is NOT in ownedEquipment
 * 4. getItemIneligibilityReason returns non-null when permanent ownership detected
 */
describe('Feature: ato-kit-enhancements, Property 6: No kit item assigned to member with permanent ownership', () => {
  it('hasPermanentOwnership returns true when itemId exists in memberOwnedEquipment', () => {
    fc.assert(
      fc.property(
        arbItemId,
        fc.array(arbItemId, { maxLength: 10 }),
        (targetItem, otherItems) => {
          // Ensure target is in the list
          const ownedEquipment = [...otherItems, targetItem]

          expect(hasPermanentOwnership(targetItem, ownedEquipment)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('hasPermanentOwnership returns false when itemId does NOT exist in memberOwnedEquipment', () => {
    fc.assert(
      fc.property(
        arbItemId,
        fc.array(arbItemId, { maxLength: 10 }),
        (targetItem, items) => {
          // Filter out target to guarantee absence
          const ownedEquipment = items.filter((e) => e !== targetItem)

          expect(hasPermanentOwnership(targetItem, ownedEquipment)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('getItemIneligibilityReason returns non-null when member permanently owns the item', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        arbItemId,
        fc.array(arbItemId, { maxLength: 10 }),
        fc.array(arbAssignment, { maxLength: 5 }),
        (memberId, targetItem, otherOwned, assignments) => {
          // Ensure target is in ownedEquipment
          const ownedEquipment = [...otherOwned, targetItem]

          // Remove any existing duplicate assignment to isolate ownership check
          const cleanAssignments = assignments.filter(
            (a) => !(a.memberId === memberId && a.itemId === targetItem)
          )

          const reason = getItemIneligibilityReason(
            memberId,
            targetItem,
            cleanAssignments,
            ownedEquipment
          )
          expect(reason).not.toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('getItemIneligibilityReason returns null when member does NOT own item and no duplicate exists', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        arbItemId,
        fc.array(arbItemId, { maxLength: 10 }),
        fc.array(arbAssignment, { maxLength: 5 }),
        (memberId, targetItem, ownedItems, assignments) => {
          // Ensure target NOT in ownedEquipment
          const ownedEquipment = ownedItems.filter((e) => e !== targetItem)

          // Ensure no duplicate assignment exists
          const cleanAssignments = assignments.filter(
            (a) => !(a.memberId === memberId && a.itemId === targetItem)
          )

          const reason = getItemIneligibilityReason(
            memberId,
            targetItem,
            cleanAssignments,
            ownedEquipment
          )
          expect(reason).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('building assignments via eligibility check never assigns item to member who owns it', () => {
    fc.assert(
      fc.property(
        arbMemberId,
        fc.array(arbItemId, { minLength: 1, maxLength: 8 }),
        fc.array(arbItemId, { minLength: 1, maxLength: 5 }),
        (memberId, kitItems, ownedEquipment) => {
          // Simulate sequential assignment: only assign if eligible
          const assignments: Array<{ memberId: string; itemId: string }> = []

          for (const itemId of kitItems) {
            const reason = getItemIneligibilityReason(
              memberId,
              itemId,
              assignments,
              ownedEquipment
            )
            if (reason === null) {
              assignments.push({ memberId, itemId })
            }
          }

          // Verify: no assigned item is in ownedEquipment
          for (const a of assignments) {
            if (a.memberId === memberId) {
              expect(ownedEquipment).not.toContain(a.itemId)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
