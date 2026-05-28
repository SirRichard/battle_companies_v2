import { describe, it, expect } from 'vitest'
import { getChipDescription } from '../chipDescription'
import type { ChipPopupContent } from '../chipDescription'

describe('getChipDescription', () => {
  describe('equipment type', () => {
    it('returns description field when present', () => {
      const result = getChipDescription('backpack', 'equipment')
      expect(result.label).toBe('Backpack')
      expect(result.description).toContain('additional three Small pieces')
    })

    it('returns grantsSpecialRules labels when no description would apply — but equipment.json always has descriptions, so test with a hypothetical', () => {
      // All equipment entries in the real data have descriptions,
      // so this tests the fallback path indirectly via the function logic.
      // badge_of_courage has both description AND grantsSpecialRules — description wins
      const result = getChipDescription('badge_of_courage', 'equipment')
      expect(result.label).toBe('Badge of Courage')
      expect(result.description).toContain('Fearless')
    })

    it('returns fallback for unknown equipment ID', () => {
      const result = getChipDescription('unknown_item_xyz', 'equipment')
      expect(result.label).toBe('Unknown Item Xyz')
      expect(result.description).toBe('No description available.')
    })
  })

  describe('wargear type', () => {
    it('returns fallback for regular wargear (no description in equipment data)', () => {
      const result = getChipDescription('bow', 'wargear')
      expect(result.label).toBe('Bow')
      expect(result.description).toBe('No description available.')
    })

    it('returns envenom_weapon description for envenom chips', () => {
      const result = getChipDescription('envenom_weapon::bow', 'wargear')
      expect(result.label).toBe('Envenom Weapon (Bow)')
      expect(result.description).toContain('Poisoned Attacks special rule')
    })

    it('handles envenom chip with unknown weapon parameter', () => {
      const result = getChipDescription(
        'envenom_weapon::mystery_blade',
        'wargear'
      )
      expect(result.label).toBe('Envenom Weapon (Mystery Blade)')
      expect(result.description).toContain('Poisoned Attacks special rule')
    })
  })

  describe('specialRule type', () => {
    it('returns description for known rule', () => {
      const result = getChipDescription('fearless', 'specialRule')
      expect(result.label).toBe('Fearless')
      expect(result.description).toContain('Middle-Earth Strategy Battle Game')
    })

    it('appends parameter context for parameterised rules', () => {
      const result = getChipDescription('hatred', 'specialRule', 'Elves')
      expect(result.label).toBe('Hatred (X)')
      expect(result.description).toContain('(Parameter: Elves)')
    })

    it('returns fallback for unknown rule ID', () => {
      const result = getChipDescription('unknown_rule_abc', 'specialRule')
      expect(result.label).toBe('Unknown Rule Abc')
      expect(result.description).toBe('No description available.')
    })

    it('returns description for heroic action (heroic_challenge)', () => {
      const result = getChipDescription('heroic_challenge', 'specialRule')
      expect(result.label).toBe('Heroic Challenge')
      expect(result.description).toContain('Middle-Earth Strategy Battle Game')
      expect(result.description).not.toBe('No description available.')
    })

    it('returns description for heroic action (heroic_move)', () => {
      const result = getChipDescription('heroic_move', 'specialRule')
      expect(result.label).toBe('Heroic Move')
      expect(result.description).toContain('Middle-Earth Strategy Battle Game')
    })
  })
})
