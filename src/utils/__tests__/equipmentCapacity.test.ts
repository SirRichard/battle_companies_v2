import { describe, it, expect } from 'vitest'
import { wouldExceedCapacity } from '../equipmentCapacity'
import type { Member } from '../../models'

/** Minimal member factory for testing */
function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'test-member',
    name: 'Test',
    baseUnitId: 'ranger_of_the_north',
    role: 'warrior',
    equipment: ['sword'],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ownedEquipment: [],
    ...overrides,
  }
}

describe('wouldExceedCapacity', () => {
  it('returns false for wargear items (never capacity-limited)', () => {
    const member = makeMember({ ownedEquipment: ['backpack', 'badge_of_courage'] })
    expect(wouldExceedCapacity(member, 'sword', 'wargear')).toBe(false)
  })

  it('returns false when member has no equipment and adding a small item', () => {
    const member = makeMember({ ownedEquipment: [] })
    expect(wouldExceedCapacity(member, 'badge_of_courage', 'equipment')).toBe(false)
  })

  it('returns false when member has no equipment and adding a large item', () => {
    const member = makeMember({ ownedEquipment: [] })
    expect(wouldExceedCapacity(member, 'backpack', 'equipment')).toBe(false)
  })

  it('returns true when member already has 1 large item and adding another large', () => {
    const member = makeMember({ ownedEquipment: ['backpack'] })
    // barding is large
    expect(wouldExceedCapacity(member, 'barding', 'equipment')).toBe(true)
  })

  it('returns true when member has 1 small item (no backpack) and tries to add another small', () => {
    const member = makeMember({ ownedEquipment: ['climbing_ropes'] })
    expect(wouldExceedCapacity(member, 'badge_of_courage', 'equipment')).toBe(true)
  })

  it('returns false when member has backpack and fewer than 4 small items', () => {
    const member = makeMember({
      ownedEquipment: ['backpack', 'badge_of_courage', 'climbing_ropes'],
    })
    expect(wouldExceedCapacity(member, 'concealing_cloak', 'equipment')).toBe(false)
  })

  it('returns true when member has backpack and already 4 small items', () => {
    const member = makeMember({
      ownedEquipment: [
        'backpack',
        'badge_of_courage',
        'climbing_ropes',
        'concealing_cloak',
        'woodland_belt',
      ],
    })
    expect(wouldExceedCapacity(member, 'ring_of_warding', 'equipment')).toBe(true)
  })

  it('returns false for unknown item ID (permissive fallback)', () => {
    const member = makeMember({ ownedEquipment: ['backpack'] })
    expect(wouldExceedCapacity(member, 'unknown_item_xyz', 'equipment')).toBe(false)
  })

  it('handles undefined ownedEquipment gracefully', () => {
    const member = makeMember({ ownedEquipment: undefined })
    expect(wouldExceedCapacity(member, 'badge_of_courage', 'equipment')).toBe(false)
  })
})
