// Feature: battle-companies-fixes-and-features, Property 31: Envenom Weapon options are a subset of the member's carried weapons

/**
 * Property 31: Envenom Weapon options are a subset of the member's carried weapons
 * Validates: Requirements 36.1, 36.3, 36.7
 *
 * For any member, the weapon options presented in the Envenom Weapon dialog SHALL be
 * a subset of the union of `baseWargear` (from `baseUnits.json`) and `member.equipment`,
 * filtered to items whose `category` in `wargear.json` is not `armour_*`, `mount`, `shield`,
 * or `special`. Already-envenomed weapons SHALL be excluded from subsequent options.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import wargearData from '../../data/wargear.json'
import baseUnitsData from '../../data/baseUnits.json'

// ── Data ──────────────────────────────────────────────────────────────────────

const WARGEAR_RAW = wargearData as Array<{
  id: string
  label: string
  category?: string
}>

const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  label: string
  baseWargear?: string[]
}>

const ALL_WARGEAR_IDS = WARGEAR_RAW.map((w) => w.id)

/**
 * Categories that are NOT weapons — mirrors the NON_WEAPON_CATEGORIES set in
 * ToolkitAssignmentPage.tsx.
 */
const NON_WEAPON_CATEGORIES = new Set([
  'armour_1',
  'armour_2',
  'armour_3',
  'armour_4',
  'mount',
  'shield',
  'special',
])

// ── Logic under test (mirrors ToolkitAssignmentPage.tsx) ──────────────────────

/**
 * Returns all weapon-category items carried by a member (union of baseWargear
 * and member.equipment, filtered to weapon categories from wargear.json).
 */
function getMemberWeapons(
  baseUnitId: string,
  memberEquipment: string[]
): string[] {
  const baseUnit = BASE_UNITS_RAW.find((u) => u.id === baseUnitId)
  const baseWargear = baseUnit?.baseWargear ?? []
  const allEquipment = Array.from(new Set([...baseWargear, ...memberEquipment]))
  return allEquipment.filter((itemId) => {
    const wgEntry = WARGEAR_RAW.find((w) => w.id === itemId)
    if (!wgEntry) return false
    return !NON_WEAPON_CATEGORIES.has(wgEntry.category ?? '')
  })
}

/**
 * Returns the weapon options available for a new Envenom Weapon assignment to
 * a member, excluding weapons already envenomed for that member.
 */
function getAvailableEnvenomOptions(
  baseUnitId: string,
  memberEquipment: string[],
  alreadyEnvenomed: string[]
): string[] {
  const allWeapons = getMemberWeapons(baseUnitId, memberEquipment)
  const envenomedSet = new Set(alreadyEnvenomed)
  return allWeapons.filter((w) => !envenomedSet.has(w))
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generate a valid baseUnitId from the real data */
const validBaseUnitIdArb = fc.constantFrom(...BASE_UNITS_RAW.map((u) => u.id))

/** Generate a subset of wargear IDs (simulating member.equipment) */
const equipmentArrayArb = fc.array(
  fc.constantFrom(...ALL_WARGEAR_IDS),
  { minLength: 0, maxLength: 8 }
)

/** Generate a subset of weapon IDs (simulating already-envenomed weapons) */
const envenomedWeaponsArb = fc.array(
  fc.constantFrom(...ALL_WARGEAR_IDS),
  { minLength: 0, maxLength: 5 }
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 31: Envenom Weapon options are a subset of the member\'s carried weapons', () => {
  /**
   * Property 39 (design): getMemberWeapons returns only weapon-category items
   * from the member's combined equipment.
   * Validates: Requirements 36.1, 36.7
   */
  it('getMemberWeapons returns only weapon-category items from combined equipment', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const weapons = getMemberWeapons(baseUnitId, memberEquipment)

        // Every returned item must be in the combined equipment
        const baseUnit = BASE_UNITS_RAW.find((u) => u.id === baseUnitId)
        const baseWargear = baseUnit?.baseWargear ?? []
        const combinedEquipment = new Set([...baseWargear, ...memberEquipment])

        for (const weaponId of weapons) {
          expect(combinedEquipment.has(weaponId)).toBe(true)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('getMemberWeapons never returns armour, mount, shield, or special items', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const weapons = getMemberWeapons(baseUnitId, memberEquipment)

        for (const weaponId of weapons) {
          const wgEntry = WARGEAR_RAW.find((w) => w.id === weaponId)
          // Every returned item must exist in wargear.json
          expect(wgEntry).toBeDefined()
          // And must NOT be in a non-weapon category
          expect(NON_WEAPON_CATEGORIES.has(wgEntry!.category ?? '')).toBe(false)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('getMemberWeapons result is a subset of the member\'s combined equipment', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const weapons = getMemberWeapons(baseUnitId, memberEquipment)
        const baseUnit = BASE_UNITS_RAW.find((u) => u.id === baseUnitId)
        const baseWargear = baseUnit?.baseWargear ?? []
        const combinedEquipment = new Set([...baseWargear, ...memberEquipment])

        // Weapons must be a subset of combined equipment
        for (const w of weapons) {
          expect(combinedEquipment.has(w)).toBe(true)
        }
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Property 40 (design): Already-envenomed weapons are excluded from subsequent options.
   * Validates: Requirements 36.3
   */
  it('getAvailableEnvenomOptions excludes already-envenomed weapons', () => {
    fc.assert(
      fc.property(
        validBaseUnitIdArb,
        equipmentArrayArb,
        envenomedWeaponsArb,
        (baseUnitId, memberEquipment, alreadyEnvenomed) => {
          const available = getAvailableEnvenomOptions(
            baseUnitId,
            memberEquipment,
            alreadyEnvenomed
          )
          const envenomedSet = new Set(alreadyEnvenomed)

          // No already-envenomed weapon should appear in the result
          for (const weaponId of available) {
            expect(envenomedSet.has(weaponId)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('getAvailableEnvenomOptions result is a subset of getMemberWeapons', () => {
    fc.assert(
      fc.property(
        validBaseUnitIdArb,
        equipmentArrayArb,
        envenomedWeaponsArb,
        (baseUnitId, memberEquipment, alreadyEnvenomed) => {
          const allWeapons = new Set(getMemberWeapons(baseUnitId, memberEquipment))
          const available = getAvailableEnvenomOptions(
            baseUnitId,
            memberEquipment,
            alreadyEnvenomed
          )

          // Available options must be a subset of all member weapons
          for (const weaponId of available) {
            expect(allWeapons.has(weaponId)).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('getAvailableEnvenomOptions returns empty when all weapons are already envenomed', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const allWeapons = getMemberWeapons(baseUnitId, memberEquipment)
        // Envenom all weapons
        const available = getAvailableEnvenomOptions(
          baseUnitId,
          memberEquipment,
          allWeapons
        )
        expect(available).toHaveLength(0)
      }),
      { numRuns: 200 }
    )
  })

  it('getAvailableEnvenomOptions never returns armour, mount, shield, or special items', () => {
    fc.assert(
      fc.property(
        validBaseUnitIdArb,
        equipmentArrayArb,
        envenomedWeaponsArb,
        (baseUnitId, memberEquipment, alreadyEnvenomed) => {
          const available = getAvailableEnvenomOptions(
            baseUnitId,
            memberEquipment,
            alreadyEnvenomed
          )

          for (const weaponId of available) {
            const wgEntry = WARGEAR_RAW.find((w) => w.id === weaponId)
            expect(wgEntry).toBeDefined()
            expect(NON_WEAPON_CATEGORIES.has(wgEntry!.category ?? '')).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: company-creation-enhancements, Property 2: Envenom weapon options are valid weapons minus already-envenomed

/**
 * Property 2: Envenom weapon options are valid weapons minus already-envenomed
 * Validates: Requirements 3.2, 3.5
 *
 * For any member with any combination of base equipment and purchased wargear,
 * the available envenom weapon options SHALL be a subset of the member's combined
 * equipment filtered to weapon categories (excluding armour, mount, shield, special),
 * minus any weapons already envenomed for that member in the current gold purchases.
 *
 * This block tests the ACTUAL exported getMemberWeapons and NON_WEAPON_CATEGORIES
 * from StepGoldEquipment.tsx.
 */

import {
  getMemberWeapons as getMemberWeaponsReal,
  NON_WEAPON_CATEGORIES as NON_WEAPON_CATEGORIES_REAL,
  parseGoldEntry,
} from '../../components/wizard/StepGoldEquipment'

// ── Helpers using real exports ────────────────────────────────────────────────

const WARGEAR_MAP_REAL = Object.fromEntries(
  (wargearData as Array<{ id: string; category?: string }>).map((w) => [w.id, w])
)

/**
 * Mirrors the envenom eligibility logic in EquipmentTabContent using real exports.
 */
function getEligibleEnvenomWeaponsReal(
  baseUnitId: string,
  memberEquipment: string[],
  currentPurchases: string[]
): string[] {
  const alreadyEnvenomedWeapons = currentPurchases
    .filter((p) => p.startsWith('envenom_weapon::'))
    .map((p) => parseGoldEntry(p).parameter!)

  const allWeapons = getMemberWeaponsReal(baseUnitId, [
    ...memberEquipment,
    ...currentPurchases.map((p) => parseGoldEntry(p).itemId),
  ])

  return allWeapons.filter((wId) => !alreadyEnvenomedWeapons.includes(wId))
}

// ── Arbitraries for Property 2 ───────────────────────────────────────────────

/** Weapon-category IDs only (for generating envenom targets) */
const WEAPON_IDS = (wargearData as Array<{ id: string; category?: string }>)
  .filter((w) => !NON_WEAPON_CATEGORIES_REAL.has(w.category ?? ''))
  .map((w) => w.id)

/** Generate arbitrary subset of wargear as purchased items (plain IDs) */
const purchasedWargearArb = fc.array(
  fc.constantFrom(...ALL_WARGEAR_IDS),
  { minLength: 0, maxLength: 6 }
)

/** Generate arbitrary envenom purchases as parameterised entries */
const envenomPurchasesArb = WEAPON_IDS.length > 0
  ? fc.array(
      fc.constantFrom(...WEAPON_IDS).map((wId) => `envenom_weapon::${wId}`),
      { minLength: 0, maxLength: 3 }
    )
  : fc.constant([] as string[])

/** Combined purchases: plain wargear + envenom entries */
const combinedPurchasesArb = fc.tuple(purchasedWargearArb, envenomPurchasesArb)
  .map(([plain, envenom]) => [...plain, ...envenom])

// ── Property 2 tests ─────────────────────────────────────────────────────────

describe('Property 2: Envenom weapon options are valid weapons minus already-envenomed', () => {
  /**
   * Validates: Requirement 3.2
   * getMemberWeapons (real export) returns only weapon-category items from combined equipment.
   */
  it('real getMemberWeapons returns only items whose category is NOT in NON_WEAPON_CATEGORIES', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const weapons = getMemberWeaponsReal(baseUnitId, memberEquipment)

        for (const weaponId of weapons) {
          const entry = WARGEAR_MAP_REAL[weaponId]
          expect(entry).toBeDefined()
          expect(NON_WEAPON_CATEGORIES_REAL.has(entry.category ?? '')).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 3.2
   * getMemberWeapons result is subset of member's combined equipment (base + purchased).
   */
  it('real getMemberWeapons result is subset of combined equipment', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const weapons = getMemberWeaponsReal(baseUnitId, memberEquipment)

        const baseUnit = BASE_UNITS_RAW.find((u) => u.id === baseUnitId)
        const baseWargear = baseUnit?.baseWargear ?? []
        const combined = new Set([...baseWargear, ...memberEquipment])

        for (const w of weapons) {
          expect(combined.has(w)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 3.5
   * Already-envenomed weapons are excluded from eligible options.
   */
  it('eligible envenom weapons exclude already-envenomed weapons from purchases', () => {
    fc.assert(
      fc.property(
        validBaseUnitIdArb,
        equipmentArrayArb,
        combinedPurchasesArb,
        (baseUnitId, memberEquipment, purchases) => {
          const eligible = getEligibleEnvenomWeaponsReal(baseUnitId, memberEquipment, purchases)

          const alreadyEnvenomed = new Set(
            purchases
              .filter((p) => p.startsWith('envenom_weapon::'))
              .map((p) => parseGoldEntry(p).parameter!)
          )

          for (const wId of eligible) {
            expect(alreadyEnvenomed.has(wId)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 3.2, 3.5
   * Eligible envenom weapons are subset of getMemberWeapons minus already-envenomed.
   */
  it('eligible envenom weapons = getMemberWeapons minus already-envenomed', () => {
    fc.assert(
      fc.property(
        validBaseUnitIdArb,
        equipmentArrayArb,
        combinedPurchasesArb,
        (baseUnitId, memberEquipment, purchases) => {
          const eligible = getEligibleEnvenomWeaponsReal(baseUnitId, memberEquipment, purchases)

          // Compute expected set
          const allWeapons = getMemberWeaponsReal(baseUnitId, [
            ...memberEquipment,
            ...purchases.map((p) => parseGoldEntry(p).itemId),
          ])
          const alreadyEnvenomed = new Set(
            purchases
              .filter((p) => p.startsWith('envenom_weapon::'))
              .map((p) => parseGoldEntry(p).parameter!)
          )
          const expected = allWeapons.filter((w) => !alreadyEnvenomed.has(w))

          // Sets should be equal
          expect(new Set(eligible)).toEqual(new Set(expected))
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 3.5
   * When all weapons are envenomed, eligible list is empty.
   */
  it('eligible envenom weapons empty when all weapons already envenomed', () => {
    fc.assert(
      fc.property(validBaseUnitIdArb, equipmentArrayArb, (baseUnitId, memberEquipment) => {
        const allWeapons = getMemberWeaponsReal(baseUnitId, memberEquipment)
        // Create purchases that envenom every weapon
        const envenomAll = allWeapons.map((w) => `envenom_weapon::${w}`)

        const eligible = getEligibleEnvenomWeaponsReal(baseUnitId, memberEquipment, envenomAll)
        expect(eligible).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })
})
