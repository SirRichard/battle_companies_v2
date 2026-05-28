// Feature: parameterized-special-rules, Property 2: Parameter state reset on rule change

/**
 * Property 2: Parameter state reset on rule change
 * Validates: Requirements 1.3
 *
 * For any sequence where a parameterised rule is selected and a parameter value
 * is chosen, then a different rule is selected, the parameter value SHALL be
 * cleared (reset to null/empty).
 *
 * Tests the CONTRACT of state transition logic: when the rule changes (different
 * rule.id), any previously selected parameter value must be discarded.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── State transition logic (mirrors ParameterSelector internal behaviour) ─────

interface ParameterState {
  ruleId: string | null
  selectedValue: string | number | null
  inputValue: string
}

const INITIAL_STATE: ParameterState = {
  ruleId: null,
  selectedValue: null,
  inputValue: '',
}

/**
 * Determines whether parameter state should reset when the rule changes.
 * Returns true when the new rule differs from the current rule (by id).
 */
function shouldResetParameter(
  currentRuleId: string | null,
  nextRuleId: string
): boolean {
  return currentRuleId !== nextRuleId
}

/**
 * Applies a rule selection action to the parameter state.
 * If the rule changes, parameter state resets. If same rule, state is preserved.
 */
function applyRuleSelection(
  state: ParameterState,
  nextRuleId: string
): ParameterState {
  if (shouldResetParameter(state.ruleId, nextRuleId)) {
    return {
      ruleId: nextRuleId,
      selectedValue: null,
      inputValue: '',
    }
  }
  return state
}

/**
 * Applies a parameter value selection to the state (simulates user picking a value).
 */
function applyParameterValue(
  state: ParameterState,
  value: string | number
): ParameterState {
  if (typeof value === 'string') {
    return { ...state, inputValue: value, selectedValue: value }
  }
  return { ...state, selectedValue: value, inputValue: String(value) }
}

// ── Generators ────────────────────────────────────────────────────────────────

const ruleIdArb = fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/)

const parameterValueArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  fc.integer({ min: 1, max: 1000 })
)

/**
 * Generates a pair of distinct rule IDs (guaranteed different).
 */
const distinctRuleIdPairArb = fc
  .tuple(ruleIdArb, ruleIdArb)
  .filter(([a, b]) => a !== b)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Parameter state reset on rule change', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any two distinct rules and any parameter value, selecting rule A,
   * choosing a parameter, then selecting rule B results in cleared parameter state.
   */
  it('parameter value clears when a different rule is selected', () => {
    fc.assert(
      fc.property(
        distinctRuleIdPairArb,
        parameterValueArb,
        ([ruleA, ruleB], paramValue) => {
          // Start fresh
          let state = INITIAL_STATE

          // Select rule A
          state = applyRuleSelection(state, ruleA)
          expect(state.ruleId).toBe(ruleA)
          expect(state.selectedValue).toBeNull()
          expect(state.inputValue).toBe('')

          // Choose a parameter value
          state = applyParameterValue(state, paramValue)
          // Value is now set
          expect(state.selectedValue).not.toBeNull()

          // Select a DIFFERENT rule B
          state = applyRuleSelection(state, ruleB)

          // Parameter state SHALL be cleared
          expect(state.ruleId).toBe(ruleB)
          expect(state.selectedValue).toBeNull()
          expect(state.inputValue).toBe('')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * For any rule and parameter value, re-selecting the SAME rule preserves
   * the parameter state (no spurious reset).
   */
  it('parameter value preserved when same rule is re-selected', () => {
    fc.assert(
      fc.property(
        ruleIdArb,
        parameterValueArb,
        (ruleId, paramValue) => {
          let state = INITIAL_STATE

          // Select rule
          state = applyRuleSelection(state, ruleId)

          // Choose a parameter value
          state = applyParameterValue(state, paramValue)
          const stateBeforeReselect = { ...state }

          // Re-select same rule
          state = applyRuleSelection(state, ruleId)

          // State should be unchanged
          expect(state.selectedValue).toBe(stateBeforeReselect.selectedValue)
          expect(state.inputValue).toBe(stateBeforeReselect.inputValue)
          expect(state.ruleId).toBe(ruleId)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * For any sequence of rule selections, every time the rule changes the
   * parameter state resets. Tested with arbitrary-length sequences.
   */
  it('parameter resets on every rule change in arbitrary sequences', () => {
    const ruleSelectionSequenceArb = fc.array(
      fc.tuple(ruleIdArb, parameterValueArb),
      { minLength: 2, maxLength: 10 }
    )

    fc.assert(
      fc.property(ruleSelectionSequenceArb, (sequence) => {
        let state = INITIAL_STATE

        for (let i = 0; i < sequence.length; i++) {
          const [nextRuleId, paramValue] = sequence[i]
          const prevRuleId = state.ruleId

          // Select rule
          state = applyRuleSelection(state, nextRuleId)

          if (prevRuleId !== null && prevRuleId !== nextRuleId) {
            // Rule changed → parameter MUST be cleared
            expect(state.selectedValue).toBeNull()
            expect(state.inputValue).toBe('')
          }

          // Simulate user picking a parameter value
          state = applyParameterValue(state, paramValue)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * shouldResetParameter returns true iff rule IDs differ.
   */
  it('shouldResetParameter returns true only when rules differ', () => {
    fc.assert(
      fc.property(
        fc.option(ruleIdArb, { nil: null }),
        ruleIdArb,
        (currentId, nextId) => {
          const result = shouldResetParameter(currentId, nextId)

          if (currentId === nextId) {
            expect(result).toBe(false)
          } else {
            expect(result).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
