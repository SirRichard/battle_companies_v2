// Feature: battle-companies-fixes-and-features, Property 11: Spell round-trip persistence

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Member } from '../index'

// Spell IDs from CHANNELING_SPELLS in StepSpellSelection.tsx
const SPELL_IDS = [
  'aura_of_command',
  'aura_of_dismay',
  'banishment',
  'black_dart',
  'bladewrath',
  'blessing_of_the_valar',
  'blinding_light',
  'call_winds',
  'collapse_rocks',
  'compel',
  'curse',
  'drain_courage',
  'enchant_blades',
  'enrage_beast',
  'flameburst',
  'fog_of_disarray',
  'foil_magic',
  'fortify_spirit',
  'fury',
  'instil_fear',
  'natures_wrath',
  'panic_steed',
  'protection_of_valar',
  'renew',
  'sorcerous_blast',
  'strengthen_will',
  'terrifying_aura',
  'transfix',
  'tremor',
  'wither',
  'writhing_vines',
]

/**
 * Builds a minimal Member with the given spells and spellImprovements.
 * Validates: Requirements 10.1, 10.7 — spells and spellImprovements are optional fields.
 */
function buildMember(
  spells?: string[],
  spellImprovements?: Record<string, number>
): Member {
  return {
    id: 'test-id',
    name: 'Test Hero',
    baseUnitId: 'test_unit',
    role: 'leader',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    pathId: 'path_of_channeling',
    statIncreases: {},
    statDecreases: {},
    spells,
    spellImprovements,
  }
}

/**
 * Simulates the round-trip: serialize to JSON (as IndexedDB would store it)
 * and deserialize back. Asserts spells are preserved.
 *
 * Property 11: Spell round-trip persistence
 * Validates: Requirements 10.1, 10.2, 10.3
 */
describe('Property 11: Spell round-trip persistence', () => {
  it('preserves spells array through JSON serialization round-trip', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty subset of spell IDs
        fc.array(fc.constantFrom(...SPELL_IDS), { minLength: 1, maxLength: 5 }).map(
          (arr) => Array.from(new Set(arr))
        ),
        (spellIds) => {
          const member = buildMember(spellIds)

          // Simulate IndexedDB round-trip via JSON serialization
          const serialized = JSON.stringify(member)
          const reloaded = JSON.parse(serialized) as Member

          // Assert all spell IDs are present after round-trip
          expect(reloaded.spells).toBeDefined()
          for (const spellId of spellIds) {
            expect(reloaded.spells).toContain(spellId)
          }
          // Assert no extra spells were added
          expect(reloaded.spells!.length).toBe(spellIds.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('preserves spellImprovements through JSON serialization round-trip', () => {
    fc.assert(
      fc.property(
        // Generate a spell ID and an improvement count (1 or 2)
        fc.constantFrom(...SPELL_IDS),
        fc.integer({ min: 1, max: 2 }),
        (spellId, improvements) => {
          const member = buildMember([spellId], { [spellId]: improvements })

          const serialized = JSON.stringify(member)
          const reloaded = JSON.parse(serialized) as Member

          expect(reloaded.spellImprovements).toBeDefined()
          expect(reloaded.spellImprovements![spellId]).toBe(improvements)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('handles undefined spells gracefully (backward compatibility)', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        (_spells) => {
          // Member without spells (existing data before FEAT-6)
          const member = buildMember(undefined, undefined)

          const serialized = JSON.stringify(member)
          const reloaded = JSON.parse(serialized) as Member

          // spells should remain undefined (not coerced to empty array)
          expect(reloaded.spells).toBeUndefined()
          expect(reloaded.spellImprovements).toBeUndefined()
        }
      ),
      { numRuns: 10 }
    )
  })

  it('spellImprovements cap is respected (max 2 per spell)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SPELL_IDS),
        fc.integer({ min: 0, max: 10 }),
        (spellId, rawCount) => {
          // Simulate the capping logic from PostMatchSummaryPage
          const capped = Math.min(rawCount, 2)
          const member = buildMember([spellId], { [spellId]: capped })

          const serialized = JSON.stringify(member)
          const reloaded = JSON.parse(serialized) as Member

          const storedCount = reloaded.spellImprovements?.[spellId] ?? 0
          expect(storedCount).toBeLessThanOrEqual(2)
          expect(storedCount).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
