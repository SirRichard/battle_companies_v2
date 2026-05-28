import { describe, it, expect } from 'vitest'
import { resolveParameterisedLabel } from '../paramLabel'

describe('resolveParameterisedLabel', () => {
  describe('weapon parameter_type', () => {
    it('resolves weapon id to wargear label for poisoned_attacks', () => {
      const result = resolveParameterisedLabel({ id: 'poisoned_attacks', parameter: 'bow' })
      expect(result).toBe('Poisoned Attacks (Bow)')
    })

    it('resolves unknown weapon id to humanised fallback', () => {
      const result = resolveParameterisedLabel({ id: 'poisoned_attacks', parameter: 'unknown_weapon' })
      expect(result).toBe('Poisoned Attacks (Unknown Weapon)')
    })
  })

  describe('friendly_hero parameter_type', () => {
    it('resolves member id to member name for combat_synergy', () => {
      const members = [
        { id: 'hero-1', name: 'Aragorn' },
        { id: 'hero-2', name: 'Legolas' },
      ]
      const result = resolveParameterisedLabel(
        { id: 'combat_synergy', parameter: 'hero-1' },
        members
      )
      expect(result).toBe('Combat Synergy (Aragorn)')
    })

    it('falls back to humanised parameter when member not found', () => {
      const result = resolveParameterisedLabel(
        { id: 'combat_synergy', parameter: 'missing_hero' },
        []
      )
      expect(result).toBe('Combat Synergy (Missing Hero)')
    })

    it('falls back to humanised parameter when companyMembers not provided', () => {
      const result = resolveParameterisedLabel(
        { id: 'combat_synergy', parameter: 'some_hero' }
      )
      expect(result).toBe('Combat Synergy (Some Hero)')
    })
  })

  describe('integer parameter_type', () => {
    it('displays raw integer value for dominant', () => {
      const result = resolveParameterisedLabel({ id: 'dominant', parameter: 2 })
      expect(result).toBe('Dominant (2)')
    })
  })

  describe('distance parameter_type', () => {
    it('displays raw value for harbinger_of_evil', () => {
      const result = resolveParameterisedLabel({ id: 'harbinger_of_evil', parameter: 6 })
      expect(result).toBe('Harbinger of Evil (6)')
    })
  })

  describe('target_integer parameter_type', () => {
    it('displays raw value for master_of_battle', () => {
      const result = resolveParameterisedLabel({ id: 'master_of_battle', parameter: '5+' })
      expect(result).toBe('Master of Battle (5+)')
    })
  })

  describe('target_keyword parameter_type', () => {
    it('displays raw keyword for hatred', () => {
      const result = resolveParameterisedLabel({ id: 'hatred', parameter: 'Elf' })
      expect(result).toBe('Hatred (Elf)')
    })

    it('displays raw keyword for terror_x', () => {
      const result = resolveParameterisedLabel({ id: 'terror_x', parameter: 'Beast' })
      expect(result).toBe('Terror (Beast)')
    })
  })

  describe('unknown rule id', () => {
    it('formats unknown id nicely with parameter', () => {
      const result = resolveParameterisedLabel({ id: 'some_unknown_rule', parameter: 'value' })
      expect(result).toBe('Some Unknown Rule (value)')
    })
  })

  describe('never returns literal (X)', () => {
    it('never contains (X) for any known parameterised rule', () => {
      const result = resolveParameterisedLabel({ id: 'dominant', parameter: 3 })
      expect(result).not.toContain('(X)')
    })

    it('never contains (X) for weapon type', () => {
      const result = resolveParameterisedLabel({ id: 'poisoned_attacks', parameter: 'spear' })
      expect(result).not.toContain('(X)')
    })
  })
})
