/**
 * Unit tests for getGrantedSpecialRules and getGrantedRuleIds.
 *
 * Validates correct extraction of granted rules from equipment.json,
 * including plain string rules, parameterised objects, and the
 * torching_brand multi-rule case.
 */

import { describe, it, expect } from 'vitest'
import { getGrantedSpecialRules, getGrantedRuleIds } from '../grantedRules'

describe('getGrantedSpecialRules', () => {
  it('returns empty array for equipment with no grantsSpecialRules', () => {
    const result = getGrantedSpecialRules(['backpack', 'climbing_ropes'])
    expect(result).toEqual([])
  })

  it('returns empty array for unknown equipment IDs', () => {
    const result = getGrantedSpecialRules(['nonexistent_item'])
    expect(result).toEqual([])
  })

  it('returns plain string rules with source info', () => {
    const result = getGrantedSpecialRules(['badge_of_courage'])
    expect(result).toEqual([
      {
        ruleId: 'fearless',
        sourceEquipmentId: 'badge_of_courage',
        sourceEquipmentLabel: 'Badge of Courage',
      },
    ])
  })

  it('handles multiple plain rules from barding', () => {
    const result = getGrantedSpecialRules(['barding'])
    expect(result).toHaveLength(2)
    expect(result[0].ruleId).toBe('expert_rider')
    expect(result[1].ruleId).toBe('horse_lord')
    expect(result[0].sourceEquipmentId).toBe('barding')
  })

  it('handles torching_brand parameterised objects', () => {
    const result = getGrantedSpecialRules(['torching_brand'])
    expect(result).toHaveLength(3)
    expect(result).toEqual([
      {
        ruleId: 'terror_x',
        parameter: 'Beast',
        sourceEquipmentId: 'torching_brand',
        sourceEquipmentLabel: 'Torching Brand',
      },
      {
        ruleId: 'terror_x',
        parameter: 'Cavalry',
        sourceEquipmentId: 'torching_brand',
        sourceEquipmentLabel: 'Torching Brand',
      },
      {
        ruleId: 'dominant',
        parameter: 2,
        sourceEquipmentId: 'torching_brand',
        sourceEquipmentLabel: 'Torching Brand',
      },
    ])
  })

  it('collects rules from multiple equipment items', () => {
    const result = getGrantedSpecialRules([
      'badge_of_courage',
      'concealing_cloak',
      'torching_brand',
    ])
    // 1 + 1 + 3 = 5 rules total
    expect(result).toHaveLength(5)
    expect(result[0].ruleId).toBe('fearless')
    expect(result[1].ruleId).toBe('stalk_unseen')
    expect(result[2].ruleId).toBe('terror_x')
  })

  it('returns empty array for empty input', () => {
    const result = getGrantedSpecialRules([])
    expect(result).toEqual([])
  })
})

describe('getGrantedRuleIds', () => {
  it('returns empty set for no equipment', () => {
    const result = getGrantedRuleIds([])
    expect(result.size).toBe(0)
  })

  it('returns plain rule IDs as composite keys', () => {
    const result = getGrantedRuleIds(['badge_of_courage'])
    expect(result.has('fearless')).toBe(true)
  })

  it('returns parameterised composite keys lowercased', () => {
    const result = getGrantedRuleIds(['torching_brand'])
    expect(result.has('terror_x:beast')).toBe(true)
    expect(result.has('terror_x:cavalry')).toBe(true)
    expect(result.has('dominant:2')).toBe(true)
  })

  it('combines keys from multiple equipment items', () => {
    const result = getGrantedRuleIds(['badge_of_courage', 'torching_brand'])
    expect(result.size).toBe(4) // fearless + terror_x:beast + terror_x:cavalry + dominant:2
  })
})
