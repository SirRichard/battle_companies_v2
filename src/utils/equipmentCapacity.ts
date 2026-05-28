/**
 * Equipment capacity validation.
 *
 * Capacity rules (from equipment.json item sizes):
 *   - A member may carry at most 1 large equipment item.
 *   - A member may carry at most 1 small equipment item by default.
 *   - If the member owns a backpack (large item), they may carry up to 4 small items.
 *   - Wargear items (stored in member.equipment) do NOT count toward equipment capacity.
 */

import equipmentData from '../data/equipment.json'
import type { Member } from '../models'

interface EquipmentDef {
  id: string
  size: 'large' | 'small'
}

const EQUIPMENT = equipmentData as EquipmentDef[]

function getEquipmentSize(itemId: string): 'large' | 'small' | undefined {
  return EQUIPMENT.find((e) => e.id === itemId)?.size
}

/**
 * Check whether restoring an item would exceed the member's equipment capacity.
 * Capacity rules: max 1 large + 1 small, OR up to 4 small with backpack.
 *
 * Wargear items never exceed equipment capacity — they use a separate slot system.
 */
export function wouldExceedCapacity(
  member: Member,
  itemId: string,
  itemType: 'wargear' | 'equipment'
): boolean {
  // Wargear doesn't count toward equipment capacity limits
  if (itemType === 'wargear') return false

  const owned = member.ownedEquipment ?? []
  const itemSize = getEquipmentSize(itemId)

  // If item isn't in equipment data (unknown), allow it — don't block on missing data
  if (!itemSize) return false

  const currentLarge = owned.filter((id) => getEquipmentSize(id) === 'large').length
  const currentSmall = owned.filter((id) => getEquipmentSize(id) === 'small').length
  const hasBackpack = owned.includes('backpack')
  const maxSmall = hasBackpack ? 4 : 1

  if (itemSize === 'large' && currentLarge >= 1) return true
  if (itemSize === 'small' && currentSmall >= maxSmall) return true

  return false
}
