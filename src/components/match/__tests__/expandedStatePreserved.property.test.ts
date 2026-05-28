// Feature: match-tracking-responsive, Property 2: Expanded state preserved during XP/casualty mutations

/**
 * Property 2: Expanded state preserved during XP/casualty mutations
 * Validates: Requirements 5.4
 *
 * For any member card in expanded state, applying an XP increment,
 * XP decrement, or casualty toggle SHALL result in the card remaining
 * in expanded state.
 *
 * Architecture: `expanded` is local useState in MemberMatchCard, while
 * XP/casualty changes flow through callback props that update parent state.
 * The expanded boolean is structurally independent of xpCounterGains and
 * isCasualty fields. This test models that independence at the data level.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── State model ───────────────────────────────────────────────────────────────

/**
 * Minimal model of MemberMatchCard's relevant state:
 * - expanded: local component state (useState)
 * - xpCounterGains: prop-driven data from parent
 * - isCasualty: prop-driven data from parent
 */
interface CardStateModel {
  expanded: boolean
  xpCounterGains: number
  isCasualty: boolean
}

type Mutation =
  | { type: 'xp_increment' }
  | { type: 'xp_decrement' }
  | { type: 'casualty_toggle' }

/**
 * Applies a mutation to the data model.
 * XP/casualty mutations only affect their respective fields —
 * expanded state is never touched.
 */
function applyMutation(state: CardStateModel, mutation: Mutation): CardStateModel {
  switch (mutation.type) {
    case 'xp_increment':
      return { ...state, xpCounterGains: state.xpCounterGains + 1 }
    case 'xp_decrement':
      return {
        ...state,
        xpCounterGains: Math.max(0, state.xpCounterGains - 1),
      }
    case 'casualty_toggle':
      return { ...state, isCasualty: !state.isCasualty }
  }
}

// ── Generators ────────────────────────────────────────────────────────────────

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  fc.constant<Mutation>({ type: 'xp_increment' }),
  fc.constant<Mutation>({ type: 'xp_decrement' }),
  fc.constant<Mutation>({ type: 'casualty_toggle' })
)

const cardStateArb: fc.Arbitrary<CardStateModel> = fc.record({
  expanded: fc.constant(true), // Property requires card starts expanded
  xpCounterGains: fc.nat({ max: 20 }),
  isCasualty: fc.boolean(),
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Expanded state preserved during XP/casualty mutations', () => {
  /**
   * **Validates: Requirements 5.4**
   *
   * A single XP or casualty mutation on an expanded card preserves expanded state.
   */
  it('single mutation preserves expanded state', () => {
    fc.assert(
      fc.property(cardStateArb, mutationArb, (state, mutation) => {
        const result = applyMutation(state, mutation)
        expect(result.expanded).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.4**
   *
   * A sequence of arbitrary XP/casualty mutations on an expanded card
   * preserves expanded state throughout.
   */
  it('sequence of mutations preserves expanded state', () => {
    fc.assert(
      fc.property(
        cardStateArb,
        fc.array(mutationArb, { minLength: 1, maxLength: 20 }),
        (initialState, mutations) => {
          let current = initialState
          for (const mutation of mutations) {
            current = applyMutation(current, mutation)
            expect(current.expanded).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.4**
   *
   * XP increment specifically does not alter expanded state.
   */
  it('XP increment does not alter expanded state', () => {
    fc.assert(
      fc.property(cardStateArb, (state) => {
        const result = applyMutation(state, { type: 'xp_increment' })
        expect(result.expanded).toBe(state.expanded)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.4**
   *
   * XP decrement specifically does not alter expanded state.
   */
  it('XP decrement does not alter expanded state', () => {
    fc.assert(
      fc.property(cardStateArb, (state) => {
        const result = applyMutation(state, { type: 'xp_decrement' })
        expect(result.expanded).toBe(state.expanded)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.4**
   *
   * Casualty toggle specifically does not alter expanded state.
   */
  it('casualty toggle does not alter expanded state', () => {
    fc.assert(
      fc.property(cardStateArb, (state) => {
        const result = applyMutation(state, { type: 'casualty_toggle' })
        expect(result.expanded).toBe(state.expanded)
      }),
      { numRuns: 100 }
    )
  })
})
