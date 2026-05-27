/**
 * Kit eligibility utilities for duplicate item assignment prevention
 * and permanent ownership conflict detection.
 *
 * Pure functions used by ToolkitAssignmentPage to determine whether
 * a member can receive a specific kit item assignment.
 */

/**
 * Returns true if assigning itemId to memberId would create a duplicate
 * (same item already assigned to same member in currentAssignments).
 */
export function hasDuplicateAssignment(
  memberId: string,
  itemId: string,
  currentAssignments: Array<{ memberId: string; itemId: string }>
): boolean {
  return currentAssignments.some(
    (a) => a.memberId === memberId && a.itemId === itemId
  )
}

/**
 * Returns true if the member permanently owns the given item.
 */
export function hasPermanentOwnership(
  itemId: string,
  memberOwnedEquipment: string[]
): boolean {
  return memberOwnedEquipment.includes(itemId)
}

/**
 * Determines if a member is eligible to receive a specific kit item assignment.
 * Returns null if eligible, or a reason string if ineligible.
 */
export function getItemIneligibilityReason(
  memberId: string,
  itemId: string,
  currentAssignments: Array<{ memberId: string; itemId: string }>,
  memberOwnedEquipment: string[]
): string | null {
  if (hasDuplicateAssignment(memberId, itemId, currentAssignments)) {
    return 'Already assigned'
  }

  if (hasPermanentOwnership(itemId, memberOwnedEquipment)) {
    return 'Permanently owned'
  }

  return null
}
