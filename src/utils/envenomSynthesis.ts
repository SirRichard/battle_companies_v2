/**
 * Envenom weapon synthesis utilities.
 *
 * Extracts `poisoned_attacks` parameterised entries from a member's specialRules
 * and synthesizes them into `envenom_weapon::<weapon_id>` wargear chip IDs.
 * Also provides a filter to remove those entries from the special rules display.
 */

type SpecialRuleEntry = string | { id: string; parameter: string | number }

/**
 * Given a member's specialRules array, extracts all parameterised
 * `poisoned_attacks` entries and returns synthesized wargear chip IDs
 * in the format `envenom_weapon::<weapon_id>`.
 */
export function synthesizeEnvenomChips(
  specialRules: SpecialRuleEntry[],
): string[] {
  const chips: string[] = []
  for (const rule of specialRules) {
    if (
      typeof rule === 'object' &&
      rule.id === 'poisoned_attacks' &&
      rule.parameter != null
    ) {
      chips.push(`envenom_weapon::${rule.parameter}`)
    }
  }
  return chips
}

/**
 * Returns a new specialRules array with all parameterised `poisoned_attacks`
 * entries removed. Plain string entries and other parameterised entries are
 * preserved unchanged.
 */
export function filterEnvenomFromRules(
  specialRules: SpecialRuleEntry[],
): SpecialRuleEntry[] {
  return specialRules.filter((rule) => {
    if (typeof rule === 'object' && rule.id === 'poisoned_attacks' && rule.parameter != null) {
      return false
    }
    return true
  })
}
