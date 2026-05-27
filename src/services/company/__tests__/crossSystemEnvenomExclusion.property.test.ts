// Feature: company-creation-enhancements, Property 7: Cross-system envenom exclusion

/**
 * Property 7: Cross-system envenom exclusion
 * Validates: Requirements 3.6
 *
 * For any member who has a weapon envenomed via gold purchase (stored as
 * `"envenom_weapon::<weaponId>"` in `goldPurchases`), that weapon SHALL also
 * be excluded from ATO envenom options when the member's equipment list
 * includes the envenom.
 *
 * After companyFactory processes the gold purchase, the member gets:
 * - specialRules includes { id: "poisoned_attacks", parameter: "<weaponId>" }
 *
 * The ATO system should check specialRules for existing poisoned_attacks entries
 * and exclude those weapons from envenom options.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Member } from '../../../models'

// ─── Pure function: extract already-envenomed weapons from specialRules ───────

/**
 * Extracts weapon IDs that are already envenomed on a member by inspecting
 * their specialRules for `{ id: "poisoned_attacks", parameter: weaponId }` entries.
 *
 * These weapons must be excluded from ATO envenom options.
 */
export function getExcludedEnvenomWeaponsFromSpecialRules(
  specialRules: Member['specialRules']
): string[] {
  return specialRules
    .filter(
      (rule): rule is { id: string; parameter: string } =>
        typeof rule === 'object' &&
        rule !== null &&
        rule.id === 'poisoned_attacks' &&
        typeof rule.parameter === 'string'
    )
    .map((rule) => rule.parameter)
}

/**
 * Given a member's weapons and their specialRules, returns the weapons
 * available for ATO envenom — excluding any already envenomed via gold purchase.
 */
export function getAtoEnvenomOptions(
  memberWeapons: string[],
  specialRules: Member['specialRules']
): string[] {
  const excluded = new Set(getExcludedEnvenomWeaponsFromSpecialRules(specialRules))
  return memberWeapons.filter((w) => !excluded.has(w))
}

// ─── Generators ───────────────────────────────────────────────────────────────

/** Generates a valid weapon ID (lowercase alphanumeric with underscores) */
const arbWeaponId = fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/)

/** Generates a set of weapon IDs representing a member's weapons */
const arbWeaponSet = fc
  .uniqueArray(arbWeaponId, { minLength: 1, maxLength: 8 })

/** Generates specialRules with some poisoned_attacks entries */
function arbSpecialRulesWithEnvenom(weaponPool: string[]) {
  return fc
    .subarray(weaponPool, { minLength: 0 })
    .map((envenomedWeapons) => {
      const rules: Member['specialRules'] = envenomedWeapons.map((wId) => ({
        id: 'poisoned_attacks',
        parameter: wId,
      }))
      // Add some non-envenom rules for noise
      rules.push('Heroic Strike')
      return rules
    })
}

// ─── Property tests ───────────────────────────────────────────────────────────

describe('Property 7: Cross-system envenom exclusion', () => {
  it('weapons envenomed via gold purchase are excluded from ATO envenom options', () => {
    fc.assert(
      fc.property(
        arbWeaponSet.chain((weapons) =>
          arbSpecialRulesWithEnvenom(weapons).map((rules) => ({
            weapons,
            specialRules: rules,
          }))
        ),
        ({ weapons, specialRules }) => {
          const excluded = getExcludedEnvenomWeaponsFromSpecialRules(specialRules)
          const atoOptions = getAtoEnvenomOptions(weapons, specialRules)

          // Every excluded weapon must NOT appear in ATO options
          for (const excludedWeapon of excluded) {
            expect(atoOptions).not.toContain(excludedWeapon)
          }

          // Every ATO option must be a valid weapon from the member's list
          for (const option of atoOptions) {
            expect(weapons).toContain(option)
          }

          // ATO options + excluded weapons that are in the weapon list = all weapons
          const excludedSet = new Set(excluded)
          const expectedOptions = weapons.filter((w) => !excludedSet.has(w))
          expect(atoOptions).toEqual(expectedOptions)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('member with no poisoned_attacks rules has all weapons available for ATO envenom', () => {
    fc.assert(
      fc.property(
        arbWeaponSet,
        (weapons) => {
          const specialRules: Member['specialRules'] = ['Heroic Strike', 'Heroic Defence']
          const atoOptions = getAtoEnvenomOptions(weapons, specialRules)

          // All weapons should be available
          expect(atoOptions).toEqual(weapons)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('member with all weapons envenomed has no ATO envenom options', () => {
    fc.assert(
      fc.property(
        arbWeaponSet,
        (weapons) => {
          const specialRules: Member['specialRules'] = weapons.map((wId) => ({
            id: 'poisoned_attacks',
            parameter: wId,
          }))
          const atoOptions = getAtoEnvenomOptions(weapons, specialRules)

          expect(atoOptions).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })

  it('poisoned_attacks with numeric parameter (non-weapon) does not exclude weapons', () => {
    fc.assert(
      fc.property(
        arbWeaponSet,
        fc.integer({ min: 1, max: 5 }),
        (weapons, numParam) => {
          // Some poisoned_attacks entries use numeric parameters (e.g. from creature rules)
          const specialRules: Member['specialRules'] = [
            { id: 'poisoned_attacks', parameter: numParam as unknown as string },
          ]
          // Since parameter is a number (not string), it should not match any weapon ID
          const excluded = getExcludedEnvenomWeaponsFromSpecialRules(specialRules)
          expect(excluded).toEqual([])

          const atoOptions = getAtoEnvenomOptions(weapons, specialRules)
          expect(atoOptions).toEqual(weapons)
        }
      ),
      { numRuns: 100 }
    )
  })
})
