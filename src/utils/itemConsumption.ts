/**
 * Post-match item consumption logic for Wondrous Cram and Healing Herbs.
 *
 * These items trigger at end-of-game based on casualty status — never during battle.
 * - Wondrous Cram: casualty skips injury roll → automatic Full Recovery. Item consumed.
 * - Healing Herbs: non-casualty hero grants +1 modifier to ALL company injury rolls. Always removed.
 */

import type { Member } from '../models'
import type { PostMatchCasualty } from '../models/postmatch'
import type { ToolkitItem } from '../models/match'

/** Items that are consumable but only at post-match, never during battle */
export const POST_MATCH_ONLY_ITEMS = new Set(['wondrous_cram', 'healing_herbs'])

export interface ItemConsumptionCandidate {
  memberId: string
  memberName: string
  itemId: 'wondrous_cram' | 'healing_herbs'
  source: 'temporary' | 'permanent'
}

/**
 * Returns true if the given item ID is a post-match-only consumable
 * (should not have a "Use" button during battle).
 */
export function isPostMatchOnlyItem(itemId: string): boolean {
  return POST_MATCH_ONLY_ITEMS.has(itemId)
}

/**
 * Identify all Wondrous Cram eligible members.
 * A member is eligible if they are a casualty AND possess wondrous_cram
 * (via toolkit assignment or ownedEquipment).
 *
 * Toolkit items produce source: 'temporary', ownedEquipment produces source: 'permanent'.
 */
export function findWondrousCramCandidates(
  casualties: PostMatchCasualty[],
  toolkitItems: ToolkitItem[],
  companyMembers: Member[]
): ItemConsumptionCandidate[] {
  const casualtyIds = new Set(casualties.map((c) => c.memberId))
  const candidates: ItemConsumptionCandidate[] = []

  // Check toolkit items (temporary source)
  for (const ti of toolkitItems) {
    if (ti.itemId === 'wondrous_cram' && casualtyIds.has(ti.memberId)) {
      const casualty = casualties.find((c) => c.memberId === ti.memberId)
      if (casualty) {
        candidates.push({
          memberId: ti.memberId,
          memberName: casualty.memberName,
          itemId: 'wondrous_cram',
          source: 'temporary',
        })
      }
    }
  }

  // Check ownedEquipment (permanent source)
  for (const member of companyMembers) {
    if (
      casualtyIds.has(member.id) &&
      member.ownedEquipment?.includes('wondrous_cram')
    ) {
      const casualty = casualties.find((c) => c.memberId === member.id)
      if (casualty) {
        candidates.push({
          memberId: member.id,
          memberName: casualty.memberName,
          itemId: 'wondrous_cram',
          source: 'permanent',
        })
      }
    }
  }

  return candidates
}

/**
 * Identify all Healing Herbs eligible heroes.
 * A member is eligible if they are a hero (role !== 'warrior'),
 * were NOT removed as a casualty, participated in the match,
 * AND possess healing_herbs (via toolkit or ownedEquipment).
 */
export function findHealingHerbsCandidates(
  casualties: PostMatchCasualty[],
  toolkitItems: ToolkitItem[],
  companyMembers: Member[],
  allMatchMembers: string[]
): ItemConsumptionCandidate[] {
  const casualtyIds = new Set(casualties.map((c) => c.memberId))
  const matchMemberIds = new Set(allMatchMembers)
  const candidates: ItemConsumptionCandidate[] = []

  // Check toolkit items (temporary source)
  for (const ti of toolkitItems) {
    if (ti.itemId === 'healing_herbs' && !casualtyIds.has(ti.memberId)) {
      const member = companyMembers.find((m) => m.id === ti.memberId)
      if (
        member &&
        member.role !== 'warrior' &&
        matchMemberIds.has(ti.memberId)
      ) {
        candidates.push({
          memberId: ti.memberId,
          memberName: member.name,
          itemId: 'healing_herbs',
          source: 'temporary',
        })
      }
    }
  }

  // Check ownedEquipment (permanent source)
  for (const member of companyMembers) {
    if (
      member.role !== 'warrior' &&
      !casualtyIds.has(member.id) &&
      matchMemberIds.has(member.id) &&
      member.ownedEquipment?.includes('healing_herbs')
    ) {
      candidates.push({
        memberId: member.id,
        memberName: member.name,
        itemId: 'healing_herbs',
        source: 'permanent',
      })
    }
  }

  return candidates
}

/**
 * Remove an item from a member's ownedEquipment, returning a new Member object.
 * If the item appears multiple times, only the first occurrence is removed.
 * If the member has no ownedEquipment or item not found, returns member unchanged.
 */
export function removeOwnedEquipment(member: Member, itemId: string): Member {
  if (!member.ownedEquipment || !member.ownedEquipment.includes(itemId)) {
    return member
  }

  const idx = member.ownedEquipment.indexOf(itemId)
  const newEquipment = [
    ...member.ownedEquipment.slice(0, idx),
    ...member.ownedEquipment.slice(idx + 1),
  ]

  return {
    ...member,
    ownedEquipment: newEquipment,
  }
}
