// Feature: company-creation-enhancements, Property 4: Envenom display label format

/**
 * Property 4: Envenom display label format
 * Validates: Requirements 3.4
 *
 * For any weapon ID that exists in wargear data, `wargearLabel("envenom_weapon::<weaponId>")`
 * SHALL produce a string matching the pattern "Envenom Weapon (<label>)" where <label>
 * equals the weapon's label from wargear.json.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import wargearData from '../../data/wargear.json'
import { wargearLabel } from '../../components/wizard/StepGoldEquipment'

// ── Data ──────────────────────────────────────────────────────────────────────

const WARGEAR_RAW = wargearData as Array<{ id: string; label: string; category?: string }>
const WARGEAR_MAP = Object.fromEntries(WARGEAR_RAW.map((w) => [w.id, w]))
const ALL_WARGEAR_IDS = WARGEAR_RAW.map((w) => w.id)

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Any valid weapon ID from wargear.json */
const validWeaponIdArb = fc.constantFrom(...ALL_WARGEAR_IDS)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: Envenom display label format', () => {
  /**
   * Validates: Requirements 3.4
   * For any weapon ID in wargear data, formatted label matches "Envenom Weapon (<label>)"
   */
  it('wargearLabel("envenom_weapon::<weaponId>") produces "Envenom Weapon (<weaponLabel>)"', () => {
    fc.assert(
      fc.property(validWeaponIdArb, (weaponId) => {
        const result = wargearLabel(`envenom_weapon::${weaponId}`)
        const expectedLabel = WARGEAR_MAP[weaponId].label

        expect(result).toBe(`Envenom Weapon (${expectedLabel})`)
      }),
      { numRuns: 100 }
    )
  })
})
