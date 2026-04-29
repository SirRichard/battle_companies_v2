// Feature: derived-unit-stats, Property 4: stat overrides are applied correctly

/**
 * Property 4: Stat overrides are applied correctly
 * Validates: Requirements 2.1, 2.2
 *
 * For any MemberStats record (representing parent stats) and for any
 * statOverrides map, applyStatOverrides must return a stats record where:
 * - Every key present in statOverrides has the override value
 * - Every key absent from statOverrides retains the parent's value
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyStatOverrides } from '../derivedUnits'
import type { MemberStats } from '../../models'

// All nine stat keys defined in MemberStats
const STAT_KEYS: Array<keyof Required<MemberStats>> = [
  'move',
  'fight',
  'shoot',
  'strength',
  'defence',
  'attacks',
  'wounds',
  'courage',
  'intelligence',
]

// Arbitrary: a valid stat value (integer 1–10)
const statValue = fc.integer({ min: 1, max: 10 })

// Arbitrary: a full Required<MemberStats> with all nine keys populated
const fullMemberStats: fc.Arbitrary<Required<MemberStats>> = fc.record({
  move: statValue,
  fight: statValue,
  shoot: statValue,
  strength: statValue,
  defence: statValue,
  attacks: statValue,
  wounds: statValue,
  courage: statValue,
  intelligence: statValue,
})

// Arbitrary: a random subset of stat keys with random valid override values
const statOverrides: fc.Arbitrary<Partial<MemberStats>> = fc
  .shuffledSubarray(STAT_KEYS, { minLength: 0, maxLength: STAT_KEYS.length })
  .chain((keys) => {
    if (keys.length === 0) return fc.constant({})
    const entries = keys.map((key) => fc.tuple(fc.constant(key), statValue))
    return fc.tuple(...entries).map((pairs) =>
      Object.fromEntries(pairs) as Partial<MemberStats>
    )
  })

describe('Property 4: Stat overrides are applied correctly', () => {
  it('overridden keys equal the override value; non-overridden keys retain parent value', () => {
    fc.assert(
      fc.property(fullMemberStats, statOverrides, (parentStats, overrides) => {
        const unitDef = {
          id: 'test',
          label: 'Test',
          statOverrides: overrides,
        }

        const result = applyStatOverrides(parentStats, unitDef)

        for (const key of STAT_KEYS) {
          if (key in overrides) {
            // Key was overridden — result must equal the override value
            expect(result[key]).toBe(overrides[key])
          } else {
            // Key was not overridden — result must equal the parent value
            expect(result[key]).toBe(parentStats[key])
          }
        }
      }),
      { numRuns: 500 }
    )
  })

  it('with no overrides, result equals parent stats for all keys', () => {
    fc.assert(
      fc.property(fullMemberStats, (parentStats) => {
        const unitDef = { id: 'test', label: 'Test' }
        const result = applyStatOverrides(parentStats, unitDef)

        for (const key of STAT_KEYS) {
          expect(result[key]).toBe(parentStats[key])
        }
      }),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 5: derived stats are saved under the derived unit's own ID

/**
 * Property 5: Derived stats are saved under the derived unit's own ID
 * Validates: Requirements 2.3
 *
 * For any derived unit definition (with a random id, label, and optional
 * statOverrides) and any random parent stats, buildDerivedUnitStats must
 * return a StoredBaseUnitStats record whose baseUnitId equals the derived
 * unit's own id — not the parent's id.
 */

import { buildDerivedUnitStats } from '../derivedUnits'
import type { BaseUnitDef } from '../derivedUnits'

describe('Property 5: Derived stats are saved under the derived unit\'s own ID', () => {
  it('result.baseUnitId equals the derived unit definition id', () => {
    // Arbitrary: a non-empty string id
    const nonEmptyString = fc.string({ minLength: 1, maxLength: 30 })

    // Arbitrary: a random derived unit definition
    const derivedUnitDef: fc.Arbitrary<BaseUnitDef> = fc.record({
      id: nonEmptyString,
      label: nonEmptyString,
      statOverrides: fc.option(
        fc
          .shuffledSubarray(STAT_KEYS, { minLength: 0, maxLength: STAT_KEYS.length })
          .chain((keys) => {
            if (keys.length === 0) return fc.constant({} as Partial<import('../../models').MemberStats>)
            const entries = keys.map((key) => fc.tuple(fc.constant(key), statValue))
            return fc.tuple(...entries).map(
              (pairs) => Object.fromEntries(pairs) as Partial<import('../../models').MemberStats>
            )
          }),
        { nil: undefined }
      ),
    })

    fc.assert(
      fc.property(derivedUnitDef, fullMemberStats, (unitDef, parentStats) => {
        const result = buildDerivedUnitStats(unitDef, parentStats)
        expect(result.baseUnitId).toBe(unitDef.id)
      }),
      { numRuns: 500 }
    )
  })
})

// ─── Properties 1, 2, 3, 6, 7, 8 — buildDerivedAwareQueue ────────────────────

import { buildDerivedAwareQueue } from '../derivedUnits'
import baseUnitsData from '../../data/baseUnits.json'

const BASE_UNITS = baseUnitsData as BaseUnitDef[]

// Known derived units and their parents (from baseUnits.json)
const DERIVED_UNIT_PAIRS: Array<{ derivedId: string; parentId: string }> = [
  { derivedId: 'ranger_of_ithilien', parentId: 'ranger_of_gondor' },
  { derivedId: 'helminga', parentId: 'warrior_of_rohan' },
  { derivedId: 'lorien_guard', parentId: 'galadhrim_warrior' },
  { derivedId: 'noldorin_exile', parentId: 'lothlorien_warrior' },
  { derivedId: 'battlin_brandybuck', parentId: 'hobbit_militia' },
  { derivedId: 'tookish_hunter', parentId: 'hobbit_archer' },
  { derivedId: 'warg_marauder', parentId: 'moria_goblin_warrior' },
  { derivedId: 'goblin_hulk', parentId: 'gundabad_ogre' },
]

const DERIVED_UNIT_IDS = DERIVED_UNIT_PAIRS.map(p => p.derivedId)

/** Build a minimal StoredBaseUnitStats for a given unit ID */
function makeStats(unitId: string): import('../../models').StoredBaseUnitStats {
  return {
    baseUnitId: unitId,
    stats: {
      move: 6,
      fight: 3,
      shoot: 4,
      strength: 3,
      defence: 4,
      attacks: 1,
      wounds: 1,
      courage: 3,
      intelligence: 2,
    },
  }
}

// Feature: derived-unit-stats, Property 1: derived units are identified in the queue

/**
 * Property 1: Derived units are identified in the queue
 * Validates: Requirements 1.1, 1.2
 *
 * For any random subset of unit IDs from baseUnits.json (mixing derived and
 * non-derived), buildDerivedAwareQueue with an empty library must ensure that
 * for every unit with a derivedFrom field, the queue contains either:
 * - An entry with autoSaveFromParentId set (parent was in library), OR
 * - An injected parent entry immediately before it (isInjectedParent: true)
 */
describe('Property 1: Derived units are identified in the queue', () => {
  it('every derived unit in the input has its parent present somewhere before it in the queue (empty library)', () => {
    const allUnitIds = BASE_UNITS.map(u => u.id)

    fc.assert(
      fc.property(
        fc.shuffledSubarray(allUnitIds, { minLength: 1, maxLength: allUnitIds.length }),
        (unitIds) => {
          const result = buildDerivedAwareQueue(unitIds, () => undefined, BASE_UNITS)

          // For every derived unit in the input, check the queue
          for (const unitId of unitIds) {
            const unitDef = BASE_UNITS.find(u => u.id === unitId)
            if (!unitDef?.derivedFrom) continue

            const idx = result.findIndex(e => e.unitId === unitId)
            if (idx === -1) continue // unit was skipped (shouldn't happen with empty library)

            const entry = result[idx]
            // Either it has autoSaveFromParentId (parent was in library — not possible with empty library)
            // or the parent appears somewhere before it in the queue (injected or as a plain entry)
            const hasAutoSave = entry.autoSaveFromParentId !== null
            const parentAppearsBeforeIt = result
              .slice(0, idx)
              .some(e => e.unitId === unitDef.derivedFrom)

            expect(hasAutoSave || parentAppearsBeforeIt).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 2: parent is not duplicated when already in the library

/**
 * Property 2: Parent is not duplicated when already in the library
 * Validates: Requirements 1.3, 6.1
 *
 * For any derived unit whose parent's stats are already in the library,
 * buildDerivedAwareQueue must not contain a separate QueueEntry for the parent.
 */
describe('Property 2: Parent is not duplicated when already in the library', () => {
  it('parent ID does not appear as a QueueEntry when parent is already in the library', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DERIVED_UNIT_PAIRS),
        ({ derivedId, parentId }) => {
          // Pre-populate library with the parent's stats
          const getStats = (id: string) =>
            id === parentId ? makeStats(parentId) : undefined

          const result = buildDerivedAwareQueue([derivedId], getStats, BASE_UNITS)

          // The parent ID must not appear as a separate QueueEntry
          const parentEntry = result.find(e => e.unitId === parentId)
          expect(parentEntry).toBeUndefined()
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 3: parent is injected immediately before the derived unit when missing

/**
 * Property 3: Parent is injected immediately before the derived unit when missing
 * Validates: Requirements 1.4
 *
 * For any derived unit whose parent's stats are absent from the library,
 * buildDerivedAwareQueue must place the parent entry at the position
 * immediately preceding the derived unit's entry.
 */
describe('Property 3: Parent is injected immediately before the derived unit when missing', () => {
  it('entry at i-1 has unitId === derivedUnit.derivedFrom when parent is absent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DERIVED_UNIT_PAIRS),
        ({ derivedId, parentId }) => {
          const result = buildDerivedAwareQueue([derivedId], () => undefined, BASE_UNITS)

          const derivedIdx = result.findIndex(e => e.unitId === derivedId)
          expect(derivedIdx).toBeGreaterThan(0)

          const precedingEntry = result[derivedIdx - 1]
          expect(precedingEntry.unitId).toBe(parentId)
          expect(precedingEntry.isInjectedParent).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 6: both parent and derived are excluded when both are in the library

/**
 * Property 6: Both parent and derived are excluded when both are in the library
 * Validates: Requirements 6.2
 *
 * For any derived unit whose stats AND whose parent's stats are both present
 * in the library, buildDerivedAwareQueue must not include either unit in the
 * returned queue.
 */
describe('Property 6: Both parent and derived are excluded when both are in the library', () => {
  it('neither parent nor derived appears in the queue when both are in the library', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DERIVED_UNIT_PAIRS),
        ({ derivedId, parentId }) => {
          // Pre-populate library with both parent and derived stats
          const getStats = (id: string) =>
            id === parentId || id === derivedId ? makeStats(id) : undefined

          const result = buildDerivedAwareQueue([derivedId], getStats, BASE_UNITS)

          const parentEntry = result.find(e => e.unitId === parentId)
          const derivedEntry = result.find(e => e.unitId === derivedId)

          expect(parentEntry).toBeUndefined()
          expect(derivedEntry).toBeUndefined()
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 7: total queue length accounts for injected parents

/**
 * Property 7: Total queue length accounts for injected parents
 * Validates: Requirements 5.1
 *
 * For a list of K derived unit IDs whose parents are all absent from the
 * library, buildDerivedAwareQueue must return a queue of length K + (number
 * of unique parents injected). When all parents are distinct, length === 2K.
 */
describe('Property 7: Total queue length accounts for injected parents', () => {
  it('result.length equals K derived units + number of unique injected parents', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(DERIVED_UNIT_IDS, { minLength: 1, maxLength: DERIVED_UNIT_IDS.length }),
        (derivedIds) => {
          const result = buildDerivedAwareQueue(derivedIds, () => undefined, BASE_UNITS)

          // Count unique parent IDs for the selected derived units
          const uniqueParentIds = new Set(
            derivedIds.map(id => {
              const pair = DERIVED_UNIT_PAIRS.find(p => p.derivedId === id)!
              return pair.parentId
            })
          )

          const K = derivedIds.length
          const uniqueParentCount = uniqueParentIds.size
          expect(result.length).toBe(K + uniqueParentCount)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// Feature: derived-unit-stats, Property 8: injected parent entries carry the derived unit's label

/**
 * Property 8: Injected parent entries carry the derived unit's label
 * Validates: Requirements 5.3
 *
 * For any injected parent entry in the queue, injectedForLabel must equal
 * the label field of the derived unit that caused the injection.
 */
describe('Property 8: Injected parent entries carry the derived unit\'s label', () => {
  it('injectedForLabel equals the derived unit\'s label from baseUnits.json', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DERIVED_UNIT_PAIRS),
        ({ derivedId }) => {
          const result = buildDerivedAwareQueue([derivedId], () => undefined, BASE_UNITS)

          const injectedParent = result.find(e => e.isInjectedParent)
          expect(injectedParent).toBeDefined()

          const derivedUnitDef = BASE_UNITS.find(u => u.id === derivedId)!
          expect(injectedParent!.injectedForLabel).toBe(derivedUnitDef.label)
        }
      ),
      { numRuns: 200 }
    )
  })
})
