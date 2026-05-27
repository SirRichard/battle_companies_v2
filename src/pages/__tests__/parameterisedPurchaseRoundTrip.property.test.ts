// Feature: company-creation-enhancements, Property 3: Parameterised purchase round-trip

/**
 * Property 3: Parameterised purchase round-trip
 * Validates: Requirements 3.3
 *
 * For any envenom weapon purchase with a valid weapon ID, encoding as
 * "envenom_weapon::<weaponId>" and then parsing with parseGoldEntry SHALL
 * recover both the item ID "envenom_weapon" and the original weapon ID parameter.
 *
 * Additionally, plain entries (no "::") parse correctly with itemId = entry
 * and no parameter.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import wargearData from '../../data/wargear.json'
import { parseGoldEntry } from '../../components/wizard/StepGoldEquipment'

// ── Data ──────────────────────────────────────────────────────────────────────

const WARGEAR_RAW = wargearData as Array<{ id: string; label: string; category?: string }>
const ALL_WARGEAR_IDS = WARGEAR_RAW.map((w) => w.id)

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Any valid weapon ID from wargear.json */
const validWeaponIdArb = fc.constantFrom(...ALL_WARGEAR_IDS)

/** Any plain wargear ID (no :: delimiter) — used for plain entry test */
const plainEntryArb = fc.constantFrom(...ALL_WARGEAR_IDS)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 3: Parameterised purchase round-trip', () => {
  /**
   * Validates: Requirement 3.3
   * Encoding "envenom_weapon::<weaponId>" then parsing recovers both itemId and parameter.
   */
  it('encoding envenom_weapon::<weaponId> then parsing recovers itemId and parameter', () => {
    fc.assert(
      fc.property(validWeaponIdArb, (weaponId) => {
        const encoded = `envenom_weapon::${weaponId}`
        const parsed = parseGoldEntry(encoded)

        expect(parsed.itemId).toBe('envenom_weapon')
        expect(parsed.parameter).toBe(weaponId)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 3.3
   * Plain entries (no "::") parse with itemId = entry and no parameter.
   */
  it('plain entries without :: parse with itemId equal to entry and no parameter', () => {
    fc.assert(
      fc.property(plainEntryArb, (entry) => {
        const parsed = parseGoldEntry(entry)

        expect(parsed.itemId).toBe(entry)
        expect(parsed.parameter).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })
})
