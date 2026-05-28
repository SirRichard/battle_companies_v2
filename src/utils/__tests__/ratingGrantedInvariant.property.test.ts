// Feature: member-detail-enhancements, Property 3: Rating Invariant Under Granted Rules

/**
 * Property 3: Rating Invariant Under Granted Rules
 * **Validates: Requirements 3.1, 3.2, 3.3, 5.3**
 *
 * For any member with equipment that grants special rules, calcMemberRating
 * SHALL produce the same rating as if those granted rules were completely
 * absent from the member's specialRules array — the equipment's own rating
 * value is the only contribution from that equipment.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import equipmentData from '../../data/equipment.json'
import specialRulesData from '../../data/specialRules.json'
import baseUnitsData from '../../data/baseUnits.json'
import { calcMemberRating } from '../rating'
import type { Member, StoredBaseUnitStats } from '../../models'

// ── Data setup ────────────────────────────────────────────────────────────────

interface EquipmentEntry {
  id: string
  label: string
  rating?: number | [number, number]
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

interface SpecialRuleEntry {
  id: string
  label: string
  minor: boolean
  parameterised?: boolean
}

interface BaseUnitEntry {
  id: string
  pointsCost: number
  baseWargear?: string[]
  wargearOptions?: { options: Array<{ wargear: string[] }> }
}

const EQUIPMENT = equipmentData as EquipmentEntry[]
const SPECIAL_RULES = specialRulesData as SpecialRuleEntry[]
const BASE_UNITS = baseUnitsData as BaseUnitEntry[]

// Equipment items that grant special rules
const EQUIPMENT_WITH_GRANTS = EQUIPMENT.filter(
  (e) => e.grantsSpecialRules && e.grantsSpecialRules.length > 0
)

// Map from rule ID → label for converting granted rule IDs to labels
const RULE_ID_TO_LABEL = new Map(SPECIAL_RULES.map((r) => [r.id, r.label]))

// Base unit IDs for generating realistic members
const BASE_UNIT_IDS = BASE_UNITS.map((u) => u.id)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a granted rule entry to the format stored in member.specialRules.
 * Plain rules → label string; parameterised rules → { id, parameter } object.
 */
function grantedRuleToSpecialRuleEntry(
  rule: string | { id: string; parameter: string | number }
): string | { id: string; parameter: string | number } {
  if (typeof rule === 'string') {
    return RULE_ID_TO_LABEL.get(rule) ?? rule
  }
  return { id: rule.id, parameter: rule.parameter }
}

/**
 * Build a hero Member with given equipment and optional granted rules injected
 * into specialRules.
 */
function makeHeroMember(
  baseUnitId: string,
  ownedEquipment: string[],
  grantedRulesInSpecialRules: Array<string | { id: string; parameter: string | number }>
): Member {
  return {
    id: 'test-hero',
    name: 'Test Hero',
    baseUnitId,
    role: 'leader',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: grantedRulesInSpecialRules,
    heroStats: { might: 1, will: 1, fate: 1 },
    statIncreases: {},
    statDecreases: {},
    ownedEquipment,
  }
}

/**
 * Get base stats for a unit (used by calcMemberRating).
 */
function getBaseStats(baseUnitId: string): StoredBaseUnitStats | undefined {
  const unit = BASE_UNITS.find((u) => u.id === baseUnitId)
  if (!unit) return undefined
  // Return minimal stats structure — rating calc only needs stats for stat increase logic
  return {
    baseUnitId,
    stats: {
      move: 6,
      fight: 3,
      shoot: 4,
      strength: 3,
      defence: 3,
      attacks: 1,
      wounds: 1,
      courage: 3,
      intelligence: 3,
    },
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary: pick a non-empty subset of equipment items that grant rules */
const arbGrantingEquipment = fc.shuffledSubarray(
  EQUIPMENT_WITH_GRANTS.map((e) => e.id),
  { minLength: 1, maxLength: EQUIPMENT_WITH_GRANTS.length }
)

/** Arbitrary: pick a base unit ID */
const arbBaseUnitId = fc.constantFrom(...BASE_UNIT_IDS)

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 3: Rating Invariant Under Granted Rules', () => {
  it('rating is the same whether granted rules are in specialRules or not', () => {
    fc.assert(
      fc.property(
        arbGrantingEquipment,
        arbBaseUnitId,
        (equipIds, baseUnitId) => {
          // Collect all granted rules from selected equipment
          const grantedRuleEntries: Array<string | { id: string; parameter: string | number }> = []
          for (const equipId of equipIds) {
            const entry = EQUIPMENT.find((e) => e.id === equipId)
            if (!entry?.grantsSpecialRules) continue
            for (const rule of entry.grantsSpecialRules) {
              grantedRuleEntries.push(grantedRuleToSpecialRuleEntry(rule))
            }
          }

          // Member WITH granted rules in specialRules (simulating app behavior)
          const memberWithRules = makeHeroMember(baseUnitId, equipIds, grantedRuleEntries)

          // Member WITHOUT granted rules in specialRules
          const memberWithoutRules = makeHeroMember(baseUnitId, equipIds, [])

          const baseStats = getBaseStats(baseUnitId)

          const ratingWith = calcMemberRating(memberWithRules, baseStats)
          const ratingWithout = calcMemberRating(memberWithoutRules, baseStats)

          // The rating should be identical — granted rules don't inflate rating
          expect(ratingWith).toBe(ratingWithout)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('torching_brand granted rules (Terror Beast, Terror Cavalry, Dominant 2) do not inflate rating', () => {
    fc.assert(
      fc.property(arbBaseUnitId, (baseUnitId) => {
        const torchingBrandRules: Array<{ id: string; parameter: string | number }> = [
          { id: 'terror_x', parameter: 'Beast' },
          { id: 'terror_x', parameter: 'Cavalry' },
          { id: 'dominant', parameter: 2 },
        ]

        // Member with torching_brand owned and its rules in specialRules
        const memberWithRules = makeHeroMember(
          baseUnitId,
          ['torching_brand'],
          torchingBrandRules
        )

        // Member with torching_brand owned but no granted rules in specialRules
        const memberWithoutRules = makeHeroMember(
          baseUnitId,
          ['torching_brand'],
          []
        )

        const baseStats = getBaseStats(baseUnitId)

        const ratingWith = calcMemberRating(memberWithRules, baseStats)
        const ratingWithout = calcMemberRating(memberWithoutRules, baseStats)

        expect(ratingWith).toBe(ratingWithout)
      }),
      { numRuns: 100 }
    )
  })
})
