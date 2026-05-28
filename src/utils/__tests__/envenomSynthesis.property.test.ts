// Feature: match-tracking-responsive, Property 6: Envenom weapon synthesis and filtering

/**
 * Property 6: Envenom weapon synthesis and filtering
 * Validates: Requirements 9.1, 9.2
 *
 * For any member whose specialRules contain `{ id: "poisoned_attacks", parameter: weapon_id }`
 * entries, the system SHALL produce corresponding `envenom_weapon::<weapon_id>` wargear chip
 * entries AND those `poisoned_attacks` entries SHALL be absent from the special rules chip display.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  synthesizeEnvenomChips,
  filterEnvenomFromRules,
} from '../envenomSynthesis'

// ── Types ─────────────────────────────────────────────────────────────────────

type SpecialRuleEntry = string | { id: string; parameter: string | number }

// ── Generators ────────────────────────────────────────────────────────────────

const SAMPLE_WEAPON_IDS = [
  'sword',
  'dagger',
  'bow',
  'spear',
  'axe',
  'mace',
  'lance',
  'staff',
  'two_handed_weapon',
  'throwing_spears',
  'war_pick',
  'flail',
]

const SAMPLE_RULE_IDS = [
  'strike',
  'resistant_to_magic',
  'woodland_creature',
  'hatred',
  'terror',
  'fearless',
  'stalk_unseen',
  'backstabbers',
  'cave_dweller',
  'mountain_dweller',
]

// Plain string special rule
const arbPlainRule: fc.Arbitrary<string> = fc.constantFrom(...SAMPLE_RULE_IDS)

// Parameterised non-poisoned rule
const arbParamRule: fc.Arbitrary<{ id: string; parameter: string | number }> =
  fc.record({
    id: fc.constantFrom('hatred', 'terror', 'resistant_to_magic', 'cave_dweller'),
    parameter: fc.oneof(
      fc.constantFrom('elves', 'dwarves', 'orcs', 'men'),
      fc.integer({ min: 1, max: 10 }),
    ),
  })

// Poisoned attacks entry (the envenom rule)
const arbPoisonedAttacks: fc.Arbitrary<{ id: string; parameter: string | number }> =
  fc.record({
    id: fc.constant('poisoned_attacks'),
    parameter: fc.oneof(
      fc.constantFrom(...SAMPLE_WEAPON_IDS),
      fc.integer({ min: 1, max: 100 }),
    ),
  })

// Mixed special rules array with guaranteed poisoned_attacks entries
const arbSpecialRulesWithPoison: fc.Arbitrary<SpecialRuleEntry[]> = fc
  .tuple(
    fc.array(
      fc.oneof(
        { weight: 3, arbitrary: arbPlainRule },
        { weight: 2, arbitrary: arbParamRule },
      ),
      { minLength: 0, maxLength: 6 },
    ),
    fc.array(arbPoisonedAttacks, { minLength: 1, maxLength: 4 }),
  )
  .map(([others, poisons]) => fc.shuffledSubarray([...others, ...poisons], { minLength: others.length + poisons.length, maxLength: others.length + poisons.length }))
  .chain((arb) => arb)

// General special rules array (may or may not contain poisoned_attacks)
const arbSpecialRules: fc.Arbitrary<SpecialRuleEntry[]> = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: arbPlainRule },
    { weight: 2, arbitrary: arbParamRule },
    { weight: 2, arbitrary: arbPoisonedAttacks },
  ),
  { minLength: 0, maxLength: 10 },
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: Envenom weapon synthesis and filtering', () => {
  it('synthesizes envenom_weapon::<weapon_id> for every poisoned_attacks entry', () => {
    fc.assert(
      fc.property(arbSpecialRulesWithPoison, (rules) => {
        const chips = synthesizeEnvenomChips(rules)

        // Count poisoned_attacks entries in input
        const poisonEntries = rules.filter(
          (r): r is { id: string; parameter: string | number } =>
            typeof r === 'object' && r.id === 'poisoned_attacks' && r.parameter != null,
        )

        // Must produce one chip per poisoned_attacks entry
        expect(chips).toHaveLength(poisonEntries.length)

        // Each chip matches format envenom_weapon::<parameter>
        for (const entry of poisonEntries) {
          expect(chips).toContain(`envenom_weapon::${entry.parameter}`)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('filtered rules contain no poisoned_attacks parameterised entries', () => {
    fc.assert(
      fc.property(arbSpecialRules, (rules) => {
        const filtered = filterEnvenomFromRules(rules)

        // No remaining entry should be a poisoned_attacks parameterised object
        for (const rule of filtered) {
          if (typeof rule === 'object') {
            const isPoisoned = rule.id === 'poisoned_attacks' && rule.parameter != null
            expect(isPoisoned).toBe(false)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('filtered rules preserve all non-poisoned entries in original order', () => {
    fc.assert(
      fc.property(arbSpecialRules, (rules) => {
        const filtered = filterEnvenomFromRules(rules)

        // Manually compute expected: all entries that are NOT poisoned_attacks parameterised
        const expected = rules.filter((r) => {
          if (typeof r === 'object' && r.id === 'poisoned_attacks' && r.parameter != null) {
            return false
          }
          return true
        })

        expect(filtered).toEqual(expected)
      }),
      { numRuns: 100 },
    )
  })

  it('synthesis and filtering are complementary: synthesized chips correspond exactly to removed entries', () => {
    fc.assert(
      fc.property(arbSpecialRules, (rules) => {
        const chips = synthesizeEnvenomChips(rules)
        const filtered = filterEnvenomFromRules(rules)

        // Number of removed entries equals number of synthesized chips
        const removedCount = rules.length - filtered.length
        expect(chips).toHaveLength(removedCount)

        // Each synthesized chip corresponds to a removed poisoned_attacks entry
        const removedEntries = rules.filter(
          (r): r is { id: string; parameter: string | number } =>
            typeof r === 'object' && r.id === 'poisoned_attacks' && r.parameter != null,
        )
        for (const entry of removedEntries) {
          expect(chips).toContain(`envenom_weapon::${entry.parameter}`)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('empty specialRules produces no chips and no filtering changes', () => {
    fc.assert(
      fc.property(fc.constant([] as SpecialRuleEntry[]), (rules: SpecialRuleEntry[]) => {
        expect(synthesizeEnvenomChips(rules)).toEqual([])
        expect(filterEnvenomFromRules(rules)).toEqual([])
      }),
      { numRuns: 100 },
    )
  })
})
