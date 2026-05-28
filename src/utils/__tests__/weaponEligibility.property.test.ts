// Feature: parameterized-special-rules, Property 4: Weapon eligibility filter

/**
 * Property 4: Weapon eligibility filter
 * Validates: Requirements 3.1
 *
 * For any member with a combined wargear set (baseWargear ∪ equipment, deduplicated)
 * and existing specialRules, `getEligibleWeapons` SHALL return only wargear items
 * whose category is in {weapon, bow, throwing} AND whose id does not appear as the
 * parameter of an existing `{ id: "poisoned_attacks", parameter: <weapon_id> }` entry
 * in the member's specialRules.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getEligibleWeapons } from '../parameterizedRules'
import type { WargearEntry } from '../parameterizedRules'
import type { Member } from '../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const ELIGIBLE_CATEGORIES = ['weapon', 'bow', 'throwing'] as const
const INELIGIBLE_CATEGORIES = ['armour', 'shield', 'banner', 'mount', 'misc'] as const
const ALL_CATEGORIES = [...ELIGIBLE_CATEGORIES, ...INELIGIBLE_CATEGORIES]

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    name: 'Test Member',
    baseUnitId: 'base-1',
    role: 'warrior',
    equipment: [],
    experience: 20,
    lifetimeExperience: 20,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ...overrides,
  }
}

// ── Generators ────────────────────────────────────────────────────────────────

// Fixed pool of wargear IDs for deterministic generation
const WARGEAR_POOL = [
  'sword', 'axe', 'mace', 'dagger', 'spear', 'lance', 'flail',
  'bow', 'elf_bow', 'orc_bow', 'crossbow',
  'throwing_daggers', 'throwing_spears', 'throwing_axes',
  'heavy_armour', 'light_armour', 'shield', 'buckler',
  'banner', 'war_horn', 'mount_horse', 'mount_warg',
] as const

// Generate a wargear catalog with unique IDs from pool, each with random category
const arbWargearData: fc.Arbitrary<WargearEntry[]> = fc
  .subarray([...WARGEAR_POOL], { minLength: 3, maxLength: WARGEAR_POOL.length })
  .chain((ids) =>
    fc.tuple(...ids.map((id) =>
      fc.constantFrom(...ALL_CATEGORIES).map((cat): WargearEntry => ({
        id,
        label: `${id} label`,
        category: cat,
      }))
    ))
  )

// Full scenario: wargear catalog + baseWargear + equipment + specialRules
interface TestScenario {
  wargearData: WargearEntry[]
  baseWargear: string[]
  equipment: string[]
  specialRules: Array<string | { id: string; parameter: string | number }>
}

const arbScenario: fc.Arbitrary<TestScenario> = arbWargearData.chain((wargearData) => {
  const allIds = wargearData.map((w) => w.id)
  const eligibleIds = wargearData
    .filter((w) => (ELIGIBLE_CATEGORIES as readonly string[]).includes(w.category))
    .map((w) => w.id)

  const arbBaseWargear = fc.subarray(allIds, { minLength: 0, maxLength: allIds.length })
  const arbEquipment = fc.subarray(allIds, { minLength: 0, maxLength: allIds.length })

  // Some string rules + some poisoned_attacks object rules
  const arbStringRules = fc.array(
    fc.constantFrom('strike', 'woodland_creature', 'stalk', 'resistant_to_magic'),
    { minLength: 0, maxLength: 3 }
  )

  const arbPoisonedRules =
    eligibleIds.length > 0
      ? fc.array(
          fc.constantFrom(...eligibleIds).map((wId) => ({
            id: 'poisoned_attacks' as const,
            parameter: wId as string | number,
          })),
          { minLength: 0, maxLength: Math.min(eligibleIds.length, 4) }
        )
      : fc.constant([] as Array<{ id: string; parameter: string | number }>)

  return fc
    .tuple(arbBaseWargear, arbEquipment, arbStringRules, arbPoisonedRules)
    .map(([baseWargear, equipment, strings, poisoned]) => ({
      wargearData,
      baseWargear,
      equipment,
      specialRules: [...strings, ...poisoned],
    }))
})

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Property 4: Weapon eligibility filter', () => {
  it('result only contains items with eligible categories (weapon, bow, throwing)', () => {
    fc.assert(
      fc.property(arbScenario, ({ wargearData, baseWargear, equipment, specialRules }) => {
        const member = makeMember({ equipment, specialRules })
        const result = getEligibleWeapons(member, baseWargear, wargearData)

        for (const item of result) {
          expect((ELIGIBLE_CATEGORIES as readonly string[]).includes(item.category)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('result never contains weapons already assigned poisoned_attacks', () => {
    fc.assert(
      fc.property(arbScenario, ({ wargearData, baseWargear, equipment, specialRules }) => {
        const member = makeMember({ equipment, specialRules })
        const result = getEligibleWeapons(member, baseWargear, wargearData)

        // Collect already-poisoned weapon IDs
        const alreadyPoisoned = new Set(
          specialRules
            .filter(
              (sr): sr is { id: string; parameter: string | number } =>
                typeof sr === 'object' && sr !== null && sr.id === 'poisoned_attacks'
            )
            .map((sr) => String(sr.parameter))
        )

        for (const item of result) {
          expect(alreadyPoisoned.has(item.id)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('result is a subset of the merged wargear set (baseWargear ∪ equipment)', () => {
    fc.assert(
      fc.property(arbScenario, ({ wargearData, baseWargear, equipment, specialRules }) => {
        const member = makeMember({ equipment, specialRules })
        const result = getEligibleWeapons(member, baseWargear, wargearData)

        // Merged set of all wargear IDs the member has access to
        const mergedIds = new Set([...baseWargear, ...equipment])

        for (const item of result) {
          expect(mergedIds.has(item.id)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})
