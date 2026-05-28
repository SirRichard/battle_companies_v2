import { describe, it, expect } from 'vitest'
import { synthesizeEnvenomChips, filterEnvenomFromRules } from '../envenomSynthesis'

describe('synthesizeEnvenomChips', () => {
  it('returns empty array when no poisoned_attacks entries exist', () => {
    const rules = ['strike', 'resistant_to_magic', { id: 'hatred', parameter: 'elves' }]
    expect(synthesizeEnvenomChips(rules)).toEqual([])
  })

  it('extracts single poisoned_attacks entry into envenom chip ID', () => {
    const rules = [
      'strike',
      { id: 'poisoned_attacks', parameter: 'dagger' },
    ]
    expect(synthesizeEnvenomChips(rules)).toEqual(['envenom_weapon::dagger'])
  })

  it('extracts multiple poisoned_attacks entries', () => {
    const rules = [
      { id: 'poisoned_attacks', parameter: 'dagger' },
      'woodland_creature',
      { id: 'poisoned_attacks', parameter: 'sword' },
    ]
    expect(synthesizeEnvenomChips(rules)).toEqual([
      'envenom_weapon::dagger',
      'envenom_weapon::sword',
    ])
  })

  it('handles numeric parameter values', () => {
    const rules = [{ id: 'poisoned_attacks', parameter: 42 }]
    expect(synthesizeEnvenomChips(rules)).toEqual(['envenom_weapon::42'])
  })

  it('returns empty array for empty specialRules', () => {
    expect(synthesizeEnvenomChips([])).toEqual([])
  })
})

describe('filterEnvenomFromRules', () => {
  it('removes poisoned_attacks parameterised entries', () => {
    const rules = [
      'strike',
      { id: 'poisoned_attacks', parameter: 'dagger' },
      'woodland_creature',
    ]
    expect(filterEnvenomFromRules(rules)).toEqual(['strike', 'woodland_creature'])
  })

  it('preserves plain string entries', () => {
    const rules = ['strike', 'resistant_to_magic']
    expect(filterEnvenomFromRules(rules)).toEqual(['strike', 'resistant_to_magic'])
  })

  it('preserves non-poisoned_attacks parameterised entries', () => {
    const rules = [
      { id: 'hatred', parameter: 'elves' },
      { id: 'poisoned_attacks', parameter: 'sword' },
    ]
    expect(filterEnvenomFromRules(rules)).toEqual([{ id: 'hatred', parameter: 'elves' }])
  })

  it('returns empty array for empty input', () => {
    expect(filterEnvenomFromRules([])).toEqual([])
  })

  it('removes multiple poisoned_attacks entries', () => {
    const rules = [
      { id: 'poisoned_attacks', parameter: 'dagger' },
      { id: 'poisoned_attacks', parameter: 'sword' },
      'strike',
    ]
    expect(filterEnvenomFromRules(rules)).toEqual(['strike'])
  })
})
