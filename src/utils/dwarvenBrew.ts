/**
 * Dwarven Brew utility functions.
 *
 * Pure helpers for courage bonus calculation and intelligence test outcome
 * used by MatchTrackingPage when temporary or permanent dwarven_brew is present.
 */

import type { ToolkitItem } from '../models/match'
import type { Member } from '../models/index'

const DWARVEN_BREW_ID = 'dwarven_brew'

/**
 * Determines if a temporary dwarven_brew is present in toolkit items.
 * Returns true if any toolkit item has itemId === 'dwarven_brew'.
 */
export function hasTemporaryDwarvenBrew(toolkitItems: ToolkitItem[]): boolean {
  return toolkitItems.some((item) => item.itemId === DWARVEN_BREW_ID)
}

/**
 * Calculates the courage bonus from dwarven brew (temporary or permanent used).
 * Returns 1 if either temporary dwarven_brew is present OR permanent brew has
 * been elected for use, 0 otherwise.
 */
export function getDwarvenBrewCourageBonus(
  toolkitItems: ToolkitItem[],
  permanentBrewUsed: boolean
): number {
  if (permanentBrewUsed || hasTemporaryDwarvenBrew(toolkitItems)) {
    return 1
  }
  return 0
}

/**
 * Determines if a member permanently owns dwarven_brew.
 */
export function memberOwnsDwarvenBrew(member: Member): boolean {
  return (member.ownedEquipment ?? []).includes(DWARVEN_BREW_ID)
}

/**
 * Determines the outcome of an intelligence test for dwarven brew.
 * @param rollResult - D6 roll result (1-6)
 * @param intelligenceStat - The model's Intelligence stat value (target number, e.g. 4+)
 * @returns true if test passes (roll >= intelligenceStat), false if fails (keg runs dry)
 */
export function dwarvenBrewIntelligenceTestPasses(
  rollResult: number,
  intelligenceStat: number
): boolean {
  return rollResult >= intelligenceStat
}
