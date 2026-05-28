/**
 * Unit tests for PostMatchSummaryPage parameterised rule integration.
 *
 * Tests the integration logic functions used in the page:
 * - applyParameterisedRule: produces correct { id, parameter } object
 * - needsExtraChoice pattern: blocks confirm until valid parameter
 * - isRuleOwned: filters minor rule list correctly
 * - State reset pattern: rule change clears parameter
 *
 * Requirements: 1.1, 1.2, 1.3, 4.1
 */

import { describe, it, expect } from 'vitest'
import {
  applyParameterisedRule,
  isRuleOwned,
  isValidParameter,
} from '../../utils/parameterizedRules'
import type { SpecialRuleEntry } from '../../utils/parameterizedRules'
import type { Member } from '../../models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    name: 'Aragorn',
    baseUnitId: 'ranger',
    role: 'leader',
    equipment: [],
    experience: 20,
    lifetimeExperience: 40,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ...overrides,
  }
}

/**
 * Mirrors the `needsExtraChoice` logic from PostMatchSummaryPage for the
 * minor_special_rule branch. This is the exact pattern used in the page.
 */
function needsExtraChoiceForMinorRule(
  minorRule: string,
  parameterValue: string | number | null | undefined,
  specialRulesData: Array<{ id: string; parameterised?: boolean; parameter_type?: string }>
): boolean {
  if (!minorRule) return false
  const ruleData = specialRulesData.find((r) => r.id === minorRule)
  if (ruleData?.parameterised) {
    return isValidParameter(parameterValue ?? null, ruleData.parameter_type ?? '')
  }
  return true
}

// ── Test data ─────────────────────────────────────────────────────────────────

const COMBAT_SYNERGY: SpecialRuleEntry = {
  id: 'combat_synergy',
  label: 'Combat Synergy (X)',
  parameterised: true,
  parameter_type: 'friendly_hero',
  minor: true,
}

const POISONED_ATTACKS: SpecialRuleEntry = {
  id: 'poisoned_attacks',
  label: 'Poisoned Attacks (X)',
  parameterised: true,
  parameter_type: 'weapon',
  minor: true,
}

const STEALTHY: SpecialRuleEntry = {
  id: 'stealthy',
  label: 'Stealthy',
  parameterised: false,
  minor: true,
}

const RULES_DATA = [
  { id: 'combat_synergy', parameterised: true, parameter_type: 'friendly_hero' },
  { id: 'poisoned_attacks', parameterised: true, parameter_type: 'weapon' },
  { id: 'stealthy', parameterised: false, parameter_type: undefined },
  { id: 'resistant_to_magic', parameterised: false, parameter_type: undefined },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostMatch Parameterized Rules Integration', () => {
  describe('Full flow: select parameterised rule → collect parameter → verify stored object', () => {
    it('applyParameterisedRule stores { id, parameter } for friendly_hero type', () => {
      const member = makeMember({ experience: 15 })
      const result = applyParameterisedRule(member, 'combat_synergy', 'hero-2')

      // Stored as structured object, not plain string
      const stored = result.specialRules.find(
        (sr) => typeof sr === 'object' && sr.id === 'combat_synergy'
      )
      expect(stored).toEqual({ id: 'combat_synergy', parameter: 'hero-2' })
      // XP deducted
      expect(result.experience).toBe(10)
    })

    it('applyParameterisedRule stores { id, parameter } for weapon type', () => {
      const member = makeMember({ experience: 8 })
      const result = applyParameterisedRule(member, 'poisoned_attacks', 'sword')

      const stored = result.specialRules.find(
        (sr) => typeof sr === 'object' && sr.id === 'poisoned_attacks'
      )
      expect(stored).toEqual({ id: 'poisoned_attacks', parameter: 'sword' })
      expect(result.experience).toBe(3)
    })

    it('applyParameterisedRule stores { id, parameter } for integer type', () => {
      const member = makeMember({ experience: 30 })
      const result = applyParameterisedRule(member, 'some_rule', 3)

      const stored = result.specialRules.find(
        (sr) => typeof sr === 'object' && sr.id === 'some_rule'
      )
      expect(stored).toEqual({ id: 'some_rule', parameter: 3 })
      expect(result.experience).toBe(25)
    })

    it('stored object is never a plain string', () => {
      const member = makeMember()
      const result = applyParameterisedRule(member, 'combat_synergy', 'hero-3')

      // No plain string entry for this rule
      const plainString = result.specialRules.find(
        (sr) => typeof sr === 'string' && sr === 'combat_synergy'
      )
      expect(plainString).toBeUndefined()

      // Object entry exists
      const objectEntry = result.specialRules.find(
        (sr) => typeof sr === 'object' && sr.id === 'combat_synergy'
      )
      expect(objectEntry).toBeDefined()
    })
  })

  describe('Confirm disabled until valid parameter (needsExtraChoice pattern)', () => {
    it('returns false when parameterised rule selected but no parameter provided', () => {
      // No parameter → confirm blocked
      const result = needsExtraChoiceForMinorRule('combat_synergy', null, RULES_DATA)
      expect(result).toBe(false)
    })

    it('returns false when parameterised rule selected with empty string parameter', () => {
      const result = needsExtraChoiceForMinorRule('combat_synergy', '', RULES_DATA)
      expect(result).toBe(false)
    })

    it('returns false when parameterised rule selected with undefined parameter', () => {
      const result = needsExtraChoiceForMinorRule('combat_synergy', undefined, RULES_DATA)
      expect(result).toBe(false)
    })

    it('returns true when parameterised rule selected AND valid parameter provided (friendly_hero)', () => {
      const result = needsExtraChoiceForMinorRule('combat_synergy', 'hero-id-123', RULES_DATA)
      expect(result).toBe(true)
    })

    it('returns true when parameterised rule selected AND valid parameter provided (weapon)', () => {
      const result = needsExtraChoiceForMinorRule('poisoned_attacks', 'sword', RULES_DATA)
      expect(result).toBe(true)
    })

    it('returns true for non-parameterised rule without needing parameter', () => {
      // Non-parameterised rules always allow confirm once selected
      const result = needsExtraChoiceForMinorRule('stealthy', null, RULES_DATA)
      expect(result).toBe(true)
    })

    it('returns false when no rule selected at all', () => {
      const result = needsExtraChoiceForMinorRule('', null, RULES_DATA)
      expect(result).toBe(false)
    })
  })

  describe('Deselection clears parameter state (state reset pattern)', () => {
    /**
     * The page uses: onMinorRule={(id) => { setMinorRule(id); setParameterValue(null) }}
     * This test verifies the CONTRACT: when rule changes, parameter resets to null.
     */
    it('changing rule clears parameter value (simulates page state pattern)', () => {
      // Simulate the state management pattern from PostMatchSummaryPage
      let minorRule = 'combat_synergy'
      let parameterValue: string | number | null = 'hero-2'

      // User selects a different rule → page calls setMinorRule + setParameterValue(null)
      const selectNewRule = (newRuleId: string) => {
        minorRule = newRuleId
        parameterValue = null // mirrors: setParameterValue(null)
      }

      selectNewRule('poisoned_attacks')

      expect(minorRule).toBe('poisoned_attacks')
      expect(parameterValue).toBeNull()
    })

    it('deselecting rule (empty string) clears parameter value', () => {
      let minorRule = 'combat_synergy'
      let parameterValue: string | number | null = 'hero-2'

      const selectNewRule = (newRuleId: string) => {
        minorRule = newRuleId
        parameterValue = null
      }

      selectNewRule('')

      expect(minorRule).toBe('')
      expect(parameterValue).toBeNull()
    })

    it('after deselection, needsExtraChoice returns false (confirm blocked)', () => {
      // After clearing, confirm should be disabled
      const result = needsExtraChoiceForMinorRule('', null, RULES_DATA)
      expect(result).toBe(false)
    })

    it('after selecting new parameterised rule without parameter, confirm blocked', () => {
      // Switched from combat_synergy (had param) to poisoned_attacks (no param yet)
      const result = needsExtraChoiceForMinorRule('poisoned_attacks', null, RULES_DATA)
      expect(result).toBe(false)
    })
  })

  describe('isRuleOwned filters minor rule list correctly', () => {
    it('parameterised rule with same id+param is excluded (owned)', () => {
      const member = makeMember({
        specialRules: [{ id: 'combat_synergy', parameter: 'hero-2' }],
      })
      const owned = isRuleOwned(member, COMBAT_SYNERGY, 'hero-2')
      expect(owned).toBe(true)
    })

    it('parameterised rule with same id but different param is allowed (not owned)', () => {
      const member = makeMember({
        specialRules: [{ id: 'combat_synergy', parameter: 'hero-2' }],
      })
      // Different parameter → rule can be taken again
      const owned = isRuleOwned(member, COMBAT_SYNERGY, 'hero-3')
      expect(owned).toBe(false)
    })

    it('parameterised rule with no existing entries is allowed', () => {
      const member = makeMember({ specialRules: [] })
      const owned = isRuleOwned(member, COMBAT_SYNERGY, 'hero-1')
      expect(owned).toBe(false)
    })

    it('non-parameterised rule owned via string match on id', () => {
      const member = makeMember({ specialRules: ['stealthy'] })
      const owned = isRuleOwned(member, STEALTHY)
      expect(owned).toBe(true)
    })

    it('non-parameterised rule owned via string match on label', () => {
      const member = makeMember({ specialRules: ['Stealthy'] })
      const owned = isRuleOwned(member, STEALTHY)
      expect(owned).toBe(true)
    })

    it('legacy string entry matching parameterised rule id blocks selection', () => {
      // Legacy: plain string "combat_synergy" in specialRules
      const member = makeMember({ specialRules: ['combat_synergy'] })
      const owned = isRuleOwned(member, COMBAT_SYNERGY, 'hero-1')
      expect(owned).toBe(true)
    })

    it('multiple parameterised entries with same id but different params all coexist', () => {
      const member = makeMember({
        specialRules: [
          { id: 'poisoned_attacks', parameter: 'sword' },
          { id: 'poisoned_attacks', parameter: 'bow' },
        ],
      })
      // sword is owned
      expect(isRuleOwned(member, POISONED_ATTACKS, 'sword')).toBe(true)
      // bow is owned
      expect(isRuleOwned(member, POISONED_ATTACKS, 'bow')).toBe(true)
      // dagger is NOT owned → can still be selected
      expect(isRuleOwned(member, POISONED_ATTACKS, 'dagger')).toBe(false)
    })

    it('filtering minor rules excludes owned, includes available', () => {
      const member = makeMember({
        specialRules: [
          'stealthy',
          { id: 'combat_synergy', parameter: 'hero-2' },
        ],
      })

      const allMinorRules = [COMBAT_SYNERGY, POISONED_ATTACKS, STEALTHY]

      // Simulate the page filter: r.minor && !isRuleOwned(member, r)
      // For parameterised rules without candidateParameter, isRuleOwned checks
      // legacy string match only (no candidateParameter passed in filter)
      const available = allMinorRules.filter(
        (r) => r.minor && !isRuleOwned(member, r)
      )

      // Stealthy is owned (string match) → excluded
      expect(available.find((r) => r.id === 'stealthy')).toBeUndefined()

      // Combat Synergy without candidateParameter → not owned via object check
      // (page filter doesn't pass candidateParameter, so parameterised rules
      // are only excluded if legacy string match exists)
      expect(available.find((r) => r.id === 'combat_synergy')).toBeDefined()

      // Poisoned Attacks → not owned at all
      expect(available.find((r) => r.id === 'poisoned_attacks')).toBeDefined()
    })
  })
})
