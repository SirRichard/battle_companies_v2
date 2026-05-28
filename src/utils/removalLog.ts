import { v4 as uuidv4 } from 'uuid'
import type { Member, RemovalEntry } from '../models'
import { wouldExceedCapacity } from './equipmentCapacity'

export type { RemovalEntry } from '../models'

const MAX_LOG_SIZE = 200

/**
 * Append a removal entry, enforcing 200-entry cap (FIFO).
 * If log is at or above capacity, oldest entries are discarded first.
 */
export function appendRemoval(
  log: RemovalEntry[],
  entry: Omit<RemovalEntry, 'id'>
): RemovalEntry[] {
  const newEntry: RemovalEntry = {
    ...entry,
    id: uuidv4(),
  }

  const updated = [...log, newEntry]

  // Trim from front (oldest) if over cap
  if (updated.length > MAX_LOG_SIZE) {
    return updated.slice(updated.length - MAX_LOG_SIZE)
  }

  return updated
}

/**
 * Restore an entry: returns updated members and updated log, or an error.
 *
 * - Wargear: append itemId to member.equipment
 * - Equipment: append itemId to member.ownedEquipment
 * - Envenom_weapon: append "envenom_weapon" to ownedEquipment and add poisoned_attacks special rule
 *
 * Returns error if member not found or capacity would be exceeded.
 */
export function restoreEntry(
  log: RemovalEntry[],
  entryId: string,
  members: Member[]
): { members: Member[]; log: RemovalEntry[] } | { error: 'member_not_found' | 'capacity_exceeded' } {
  const entry = log.find((e) => e.id === entryId)
  if (!entry) {
    return { error: 'member_not_found' }
  }

  const memberIndex = members.findIndex((m) => m.id === entry.memberId)
  if (memberIndex === -1) {
    return { error: 'member_not_found' }
  }

  const member = members[memberIndex]

  // Check capacity for equipment items
  if (entry.itemType === 'equipment') {
    const restoreItemId = entry.itemId === 'envenom_weapon' ? 'envenom_weapon' : entry.itemId
    if (wouldExceedCapacity(member, restoreItemId, 'equipment')) {
      return { error: 'capacity_exceeded' }
    }
  }

  // Perform restore
  let updatedMember: Member

  if (entry.itemType === 'wargear') {
    updatedMember = {
      ...member,
      equipment: [...member.equipment, entry.itemId],
    }
  } else if (entry.itemId === 'envenom_weapon' && entry.poisonedWeaponId) {
    // Envenom weapon: add to ownedEquipment and add poisoned_attacks special rule
    updatedMember = {
      ...member,
      ownedEquipment: [...(member.ownedEquipment ?? []), 'envenom_weapon'],
      specialRules: [
        ...member.specialRules,
        { id: 'poisoned_attacks', parameter: entry.poisonedWeaponId },
      ],
    }
  } else {
    // Regular equipment
    updatedMember = {
      ...member,
      ownedEquipment: [...(member.ownedEquipment ?? []), entry.itemId],
    }
  }

  const updatedMembers = [...members]
  updatedMembers[memberIndex] = updatedMember

  const updatedLog = log.filter((e) => e.id !== entryId)

  return { members: updatedMembers, log: updatedLog }
}

/**
 * Group and sort log for display:
 * - Groups ordered alphabetically by memberName (case-insensitive)
 * - Within each group, entries sorted by removedAt descending (newest first)
 */
export function groupRemovalLog(
  log: RemovalEntry[]
): Array<{ memberName: string; entries: RemovalEntry[] }> {
  if (log.length === 0) return []

  // Group by memberName
  const groups = new Map<string, RemovalEntry[]>()
  for (const entry of log) {
    const existing = groups.get(entry.memberName)
    if (existing) {
      existing.push(entry)
    } else {
      groups.set(entry.memberName, [entry])
    }
  }

  // Sort entries within each group by removedAt descending
  for (const entries of groups.values()) {
    entries.sort((a, b) => b.removedAt.localeCompare(a.removedAt))
  }

  // Sort groups alphabetically by memberName (case-insensitive)
  const sortedKeys = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )

  return sortedKeys.map((name) => ({
    memberName: name,
    entries: groups.get(name)!,
  }))
}
