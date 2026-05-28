// Feature: match-tracking-responsive, Property 1: Expand/collapse state independence

/**
 * Property 1: Expand/collapse state independence
 * Validates: Requirements 5.1, 5.3
 *
 * For any set of member cards and any single memberId, toggling that member's
 * expand/collapse state SHALL leave all other members' expand/collapse states unchanged.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── State model (mirrors MemberMatchCard local useState per memberId) ─────────

/**
 * Models the expand/collapse state map for a set of member cards.
 * Each card owns its own boolean keyed by memberId — architecturally independent.
 */
type ExpandStateMap = Map<string, boolean>

/**
 * Creates initial state map: all members collapsed (false).
 */
function createInitialState(memberIds: string[]): ExpandStateMap {
  return new Map(memberIds.map((id) => [id, false]))
}

/**
 * Toggles a single member's expand/collapse state, returns new map.
 * Mirrors React useState toggle: setExpanded(prev => !prev) per card.
 */
function toggleMember(state: ExpandStateMap, memberId: string): ExpandStateMap {
  const next = new Map(state)
  const current = next.get(memberId) ?? false
  next.set(memberId, !current)
  return next
}

// ── Generators ────────────────────────────────────────────────────────────────

/** Generates unique member IDs (2–15 members) */
const memberIdsArb = fc
  .uniqueArray(fc.uuid(), { minLength: 2, maxLength: 15 })

/** Generates a random initial state with some members already expanded */
function stateWithRandomExpansions(memberIds: string[]) {
  return fc.array(fc.boolean(), { minLength: memberIds.length, maxLength: memberIds.length }).map(
    (bools) => new Map(memberIds.map((id, i) => [id, bools[i]]))
  )
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: Expand/collapse state independence', () => {
  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * Toggling one member's state from initial (all collapsed) leaves others unchanged.
   */
  it('toggling one member from initial state does not affect others', () => {
    fc.assert(
      fc.property(
        memberIdsArb,
        fc.nat(),
        (memberIds, indexSeed) => {
          const targetIndex = indexSeed % memberIds.length
          const targetId = memberIds[targetIndex]

          const before = createInitialState(memberIds)
          const after = toggleMember(before, targetId)

          // Target toggled
          expect(after.get(targetId)).toBe(!before.get(targetId))

          // All others unchanged
          for (const id of memberIds) {
            if (id !== targetId) {
              expect(after.get(id)).toBe(before.get(id))
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * Toggling one member from any arbitrary state leaves all others unchanged.
   */
  it('toggling one member from arbitrary state does not affect others', () => {
    fc.assert(
      fc.property(
        memberIdsArb.chain((ids) =>
          fc.tuple(
            fc.constant(ids),
            stateWithRandomExpansions(ids),
            fc.nat().map((n) => n % ids.length)
          )
        ),
        ([memberIds, state, targetIndex]) => {
          const targetId = memberIds[targetIndex]
          const after = toggleMember(state, targetId)

          // Target toggled
          expect(after.get(targetId)).toBe(!state.get(targetId))

          // All others unchanged
          for (const id of memberIds) {
            if (id !== targetId) {
              expect(after.get(id)).toBe(state.get(id))
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * Multiple sequential toggles on different members — each toggle only affects its target.
   */
  it('sequential toggles on different members are independent', () => {
    fc.assert(
      fc.property(
        memberIdsArb.chain((ids) =>
          fc.tuple(
            fc.constant(ids),
            stateWithRandomExpansions(ids),
            fc.array(fc.nat().map((n) => n % ids.length), { minLength: 1, maxLength: 10 })
          )
        ),
        ([memberIds, initialState, toggleSequence]) => {
          let current = new Map(initialState)

          for (const targetIndex of toggleSequence) {
            const targetId = memberIds[targetIndex]
            const before = new Map(current)
            current = toggleMember(current, targetId)

            // Only target changed
            for (const id of memberIds) {
              if (id !== targetId) {
                expect(current.get(id)).toBe(before.get(id))
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
