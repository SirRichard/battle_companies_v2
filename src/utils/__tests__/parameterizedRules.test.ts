import { describe, it, expect } from 'vitest'
import { isRuleOwned, isValidParameter, applyParameterisedRule } from '../parameterizedRules'
import type { Member } from '../../models'

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

describe('isRuleOwned', () => {
  const nonParamRule = { id: 'strike', label: 'Strike', parameterised: false }
  const paramRule = { id: 'combat_synergy', label: 'Combat Synergy (X)', parameterised: true, parameter_type: 'friendly_hero' }

  it('non-parameterised: owned if string matches id', () => {
    const member = makeMember({ specialRules: ['strike'] })
    expect(isRuleOwned(member, nonParamRule)).toBe(true)
  })

  it('non-parameterised: owned if string matches label', () => {
    const member = makeMember({ specialRules: ['Strike'] })
    expect(isRuleOwned(member, nonParamRule)).toBe(true)
  })

  it('non-parameterised: not owned if no match', () => {
    const member = makeMember({ specialRules: ['woodland_creature'] })
    expect(isRuleOwned(member, nonParamRule)).toBe(false)
  })

  it('parameterised: owned if object matches id and parameter', () => {
    const member = makeMember({
      specialRules: [{ id: 'combat_synergy', parameter: 'hero-1' }],
    })
    expect(isRuleOwned(member, paramRule, 'hero-1')).toBe(true)
  })

  it('parameterised: NOT owned if same id but different parameter', () => {
    const member = makeMember({
      specialRules: [{ id: 'combat_synergy', parameter: 'hero-1' }],
    })
    expect(isRuleOwned(member, paramRule, 'hero-2')).toBe(false)
  })

  it('parameterised: owned if legacy string matches rule id', () => {
    const member = makeMember({ specialRules: ['combat_synergy'] })
    expect(isRuleOwned(member, paramRule, 'hero-1')).toBe(true)
  })

  it('parameterised: not owned if empty specialRules', () => {
    const member = makeMember({ specialRules: [] })
    expect(isRuleOwned(member, paramRule, 'hero-1')).toBe(false)
  })
})

describe('isValidParameter', () => {
  describe('friendly_hero / weapon / target_keyword (string types)', () => {
    it('valid non-empty string', () => {
      expect(isValidParameter('hero-1', 'friendly_hero')).toBe(true)
      expect(isValidParameter('sword', 'weapon')).toBe(true)
      expect(isValidParameter('Elf', 'target_keyword')).toBe(true)
    })

    it('invalid: empty string', () => {
      expect(isValidParameter('', 'friendly_hero')).toBe(false)
      expect(isValidParameter('   ', 'weapon')).toBe(false)
    })

    it('invalid: null/undefined', () => {
      expect(isValidParameter(null, 'friendly_hero')).toBe(false)
      expect(isValidParameter(undefined, 'weapon')).toBe(false)
    })

    it('invalid: number for string type', () => {
      expect(isValidParameter(5, 'friendly_hero')).toBe(false)
    })
  })

  describe('integer / target_integer', () => {
    it('valid positive integer', () => {
      expect(isValidParameter(3, 'integer')).toBe(true)
      expect(isValidParameter(1, 'target_integer')).toBe(true)
    })

    it('valid string that parses to positive integer', () => {
      expect(isValidParameter('5', 'integer')).toBe(true)
    })

    it('invalid: zero', () => {
      expect(isValidParameter(0, 'integer')).toBe(false)
    })

    it('invalid: negative', () => {
      expect(isValidParameter(-1, 'integer')).toBe(false)
    })

    it('invalid: float', () => {
      expect(isValidParameter(2.5, 'integer')).toBe(false)
    })

    it('invalid: null', () => {
      expect(isValidParameter(null, 'integer')).toBe(false)
    })
  })

  describe('distance', () => {
    it('valid positive number', () => {
      expect(isValidParameter(3.5, 'distance')).toBe(true)
      expect(isValidParameter(1, 'distance')).toBe(true)
    })

    it('valid string with trailing quote', () => {
      expect(isValidParameter('6"', 'distance')).toBe(true)
    })

    it('valid string number', () => {
      expect(isValidParameter('3', 'distance')).toBe(true)
    })

    it('invalid: zero', () => {
      expect(isValidParameter(0, 'distance')).toBe(false)
    })

    it('invalid: negative', () => {
      expect(isValidParameter(-2, 'distance')).toBe(false)
    })

    it('invalid: null', () => {
      expect(isValidParameter(null, 'distance')).toBe(false)
    })
  })

  describe('unknown parameter_type', () => {
    it('returns false', () => {
      expect(isValidParameter('anything', 'unknown_type')).toBe(false)
    })
  })
})

describe('applyParameterisedRule', () => {
  it('stores rule as { id, parameter } object', () => {
    const member = makeMember({ experience: 20 })
    const result = applyParameterisedRule(member, 'combat_synergy', 'hero-1')
    expect(result.specialRules).toContainEqual({ id: 'combat_synergy', parameter: 'hero-1' })
  })

  it('subtracts 5 XP', () => {
    const member = makeMember({ experience: 20 })
    const result = applyParameterisedRule(member, 'combat_synergy', 'hero-1')
    expect(result.experience).toBe(15)
  })

  it('floors XP at 0', () => {
    const member = makeMember({ experience: 3 })
    const result = applyParameterisedRule(member, 'combat_synergy', 'hero-1')
    expect(result.experience).toBe(0)
  })

  it('returns unchanged member if duplicate exists', () => {
    const member = makeMember({
      experience: 20,
      specialRules: [{ id: 'combat_synergy', parameter: 'hero-1' }],
    })
    const result = applyParameterisedRule(member, 'combat_synergy', 'hero-1')
    expect(result).toBe(member) // same reference — no mutation
    expect(result.experience).toBe(20)
  })

  it('allows same id with different parameter (not duplicate)', () => {
    const member = makeMember({
      experience: 20,
      specialRules: [{ id: 'combat_synergy', parameter: 'hero-1' }],
    })
    const result = applyParameterisedRule(member, 'combat_synergy', 'hero-2')
    expect(result.specialRules).toHaveLength(2)
    expect(result.experience).toBe(15)
  })

  it('does not mutate original member', () => {
    const member = makeMember({ experience: 20 })
    const result = applyParameterisedRule(member, 'poisoned_attacks', 'sword')
    expect(member.specialRules).toHaveLength(0)
    expect(member.experience).toBe(20)
    expect(result.specialRules).toHaveLength(1)
  })
})
