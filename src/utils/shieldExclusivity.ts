/**
 * Shield Mutual Exclusivity — prevents equipping small_shield alongside
 * any wargear with category "shield", and vice versa.
 *
 * Logic:
 * 1. If itemToAdd has category "shield" in wargear.json AND "small_shield"
 *    is in memberOwnedEquipment → violation (return true)
 * 2. If itemToAdd is "small_shield" AND any item in memberEquipment has
 *    category "shield" in wargear.json → violation (return true)
 * 3. Otherwise → no violation (return false)
 *
 * Error handling: If item ID not found in wargear.json, return false
 * (permissive fallback per design doc).
 */

import wargearData from '../data/wargear.json'

interface WargearEntry {
  id: string
  label: string
  category: string
}

const WARGEAR = wargearData as WargearEntry[]

const SMALL_SHIELD_ID = 'small_shield'

/**
 * Returns true if adding the given item would violate shield mutual
 * exclusivity for the member.
 */
export function isShieldExclusive(
  itemToAdd: string,
  memberEquipment: string[],
  memberOwnedEquipment: string[]
): boolean {
  // Case 1: Adding a shield-category wargear while member owns small_shield
  if (memberOwnedEquipment.includes(SMALL_SHIELD_ID)) {
    const wargearEntry = WARGEAR.find((w) => w.id === itemToAdd)
    if (!wargearEntry) return false
    if (wargearEntry.category === 'shield') return true
  }

  // Case 2: Adding small_shield while member has a shield-category wargear equipped
  if (itemToAdd === SMALL_SHIELD_ID) {
    for (const equipId of memberEquipment) {
      const wargearEntry = WARGEAR.find((w) => w.id === equipId)
      if (wargearEntry && wargearEntry.category === 'shield') return true
    }
  }

  return false
}
