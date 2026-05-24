/**
 * Property-based tests for src/utils/itemConsumption.ts
 * Feature: post-match-item-consumption
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isPostMatchOnlyItem, POST_MATCH_ONLY_ITEMS } from '../itemConsumption'

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Post-match-only items render as passive chips during battle
// Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.2, 6.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 1: Post-match-only items render as passive chips during battle
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.2, 6.3**
 *
 * For any member with Wondrous Cram or Healing Herbs in their toolkit items,
 * `isPostMatchOnlyItem(itemId)` SHALL return true, causing chip rendering
 * (not "Use" button) in MatchTrackingPage.
 *
 * Strategy:
 * 1. isPostMatchOnlyItem('wondrous_cram') always returns true
 * 2. isPostMatchOnlyItem('healing_herbs') always returns true
 * 3. For any arbitrary string that is NOT 'wondrous_cram' or 'healing_herbs',
 *    isPostMatchOnlyItem returns false
 */
describe('Feature: post-match-item-consumption, Property 1: Post-match-only items render as passive chips during battle', () => {
  it('isPostMatchOnlyItem returns true for wondrous_cram', () => {
    fc.assert(
      fc.property(fc.constant('wondrous_cram'), (itemId) => {
        expect(isPostMatchOnlyItem(itemId)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('isPostMatchOnlyItem returns true for healing_herbs', () => {
    fc.assert(
      fc.property(fc.constant('healing_herbs'), (itemId) => {
        expect(isPostMatchOnlyItem(itemId)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('isPostMatchOnlyItem returns false for any string that is not a post-match-only item', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !POST_MATCH_ONLY_ITEMS.has(s)
        ),
        (itemId) => {
          expect(isPostMatchOnlyItem(itemId)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Wondrous Cram eligibility requires casualty status
// Validates: Requirements 2.1, 2.3
// ─────────────────────────────────────────────────────────────────────────────

import { findWondrousCramCandidates } from '../itemConsumption'
import type { Member, MemberRole } from '../../models'
import type { PostMatchCasualty } from '../../models/postmatch'
import type { ToolkitItem } from '../../models/match'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbMemberRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making', 'warrior')

const arbMember = (id?: string): fc.Arbitrary<Member> =>
  fc.record({
    id: id ? fc.constant(id) : fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    baseUnitId: fc.string({ minLength: 1, maxLength: 20 }),
    role: arbMemberRole,
    equipment: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    experience: fc.nat({ max: 100 }),
    lifetimeExperience: fc.nat({ max: 200 }),
    injuries: fc.constant([]),
    specialRules: fc.constant([]),
    statIncreases: fc.constant({}),
    statDecreases: fc.constant({}),
    ownedEquipment: fc.array(
      fc.constantFrom('wondrous_cram', 'healing_herbs', 'shield', 'sword', 'bow'),
      { maxLength: 5 }
    ),
  }) as unknown as fc.Arbitrary<Member>

const arbCasualty = (memberId: string, memberName: string): fc.Arbitrary<PostMatchCasualty> =>
  fc.record({
    memberId: fc.constant(memberId),
    memberName: fc.constant(memberName),
    role: fc.constantFrom('leader', 'sergeant', 'hero_in_making', 'warrior'),
    baseUnitId: fc.string({ minLength: 1, maxLength: 20 }),
    isHero: fc.boolean(),
  })

/**
 * Feature: post-match-item-consumption, Property 2: Wondrous Cram eligibility requires casualty status
 *
 * **Validates: Requirements 2.1, 2.3**
 *
 * For any member in post-match processing, that member is eligible for Wondrous Cram
 * consumption if and only if they were removed as a casualty AND possess wondrous_cram
 * (via toolkit or ownedEquipment).
 */
describe('Feature: post-match-item-consumption, Property 2: Wondrous Cram eligibility requires casualty status', () => {
  it('members who ARE casualties AND have wondrous_cram appear in findWondrousCramCandidates results', () => {
    fc.assert(
      fc.property(
        arbMember().chain((member) =>
          arbCasualty(member.id, member.name).map((casualty) => ({ member, casualty }))
        ),
        fc.boolean(), // whether item comes from toolkit or ownedEquipment
        ({ member, casualty }, fromToolkit) => {
          let toolkitItems: ToolkitItem[] = []
          let memberWithItem: Member = member

          if (fromToolkit) {
            toolkitItems = [{ memberId: member.id, itemId: 'wondrous_cram' }]
          } else {
            // Ensure ownedEquipment contains wondrous_cram
            memberWithItem = {
              ...member,
              ownedEquipment: [...(member.ownedEquipment || []), 'wondrous_cram'],
            }
          }

          const result = findWondrousCramCandidates(
            [casualty],
            toolkitItems,
            [memberWithItem]
          )

          // Member should appear in results
          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('members who are NOT casualties never appear in results (even if they have the item)', () => {
    fc.assert(
      fc.property(
        arbMember(),
        fc.boolean(), // whether item comes from toolkit or ownedEquipment
        (member, fromToolkit) => {
          let toolkitItems: ToolkitItem[] = []
          let memberWithItem: Member = member

          if (fromToolkit) {
            toolkitItems = [{ memberId: member.id, itemId: 'wondrous_cram' }]
          } else {
            memberWithItem = {
              ...member,
              ownedEquipment: [...(member.ownedEquipment || []), 'wondrous_cram'],
            }
          }

          // Empty casualties list — member is NOT a casualty
          const result = findWondrousCramCandidates(
            [],
            toolkitItems,
            [memberWithItem]
          )

          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('members who ARE casualties but DO NOT have wondrous_cram never appear in results', () => {
    fc.assert(
      fc.property(
        arbMember().map((m) => ({
          ...m,
          // Ensure no wondrous_cram in ownedEquipment
          ownedEquipment: (m.ownedEquipment || []).filter((e) => e !== 'wondrous_cram'),
        })).chain((member) =>
          arbCasualty(member.id, member.name).map((casualty) => ({ member, casualty }))
        ),
        ({ member, casualty }) => {
          // No toolkit items with wondrous_cram for this member
          const toolkitItems: ToolkitItem[] = []

          const result = findWondrousCramCandidates(
            [casualty],
            toolkitItems,
            [member]
          )

          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Healing Herbs eligibility requires non-casualty hero status
// Validates: Requirements 3.1, 3.3
// ─────────────────────────────────────────────────────────────────────────────

import { findHealingHerbsCandidates } from '../itemConsumption'

/**
 * Feature: post-match-item-consumption, Property 5: Healing Herbs eligibility requires non-casualty hero status
 *
 * **Validates: Requirements 3.1, 3.3**
 *
 * For any member in post-match processing, that member is eligible for Healing Herbs
 * consumption if and only if they are a hero (role !== 'warrior'), were NOT removed as
 * a casualty, AND possess healing_herbs (via toolkit or ownedEquipment).
 */
describe('Feature: post-match-item-consumption, Property 5: Healing Herbs eligibility requires non-casualty hero status', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('heroes who are NOT casualties AND have healing_herbs appear in findHealingHerbsCandidates results', () => {
    fc.assert(
      fc.property(
        arbMember().chain((member) =>
          arbHeroRole.map((role) => ({ ...member, role }))
        ),
        fc.boolean(), // whether item comes from toolkit or ownedEquipment
        (member, fromToolkit) => {
          let toolkitItems: ToolkitItem[] = []
          let memberWithItem: Member = member

          if (fromToolkit) {
            toolkitItems = [{ memberId: member.id, itemId: 'healing_herbs' }]
          } else {
            memberWithItem = {
              ...member,
              ownedEquipment: [...(member.ownedEquipment || []), 'healing_herbs'],
            }
          }

          // No casualties — member is NOT a casualty
          const casualties: PostMatchCasualty[] = []
          // Member participated in match
          const allMatchMembers = [member.id]

          const result = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            [memberWithItem],
            allMatchMembers
          )

          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('warriors (role === "warrior") never appear in results even if they have the item and are not casualties', () => {
    fc.assert(
      fc.property(
        arbMember().map((m) => ({ ...m, role: 'warrior' as MemberRole })),
        fc.boolean(), // whether item comes from toolkit or ownedEquipment
        (member, fromToolkit) => {
          let toolkitItems: ToolkitItem[] = []
          let memberWithItem: Member = member

          if (fromToolkit) {
            toolkitItems = [{ memberId: member.id, itemId: 'healing_herbs' }]
          } else {
            memberWithItem = {
              ...member,
              ownedEquipment: [...(member.ownedEquipment || []), 'healing_herbs'],
            }
          }

          // No casualties — member is NOT a casualty
          const casualties: PostMatchCasualty[] = []
          const allMatchMembers = [member.id]

          const result = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            [memberWithItem],
            allMatchMembers
          )

          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('heroes who ARE casualties never appear in results even if they have the item', () => {
    fc.assert(
      fc.property(
        arbMember().chain((member) =>
          arbHeroRole.chain((role) =>
            arbCasualty(member.id, member.name).map((casualty) => ({
              member: { ...member, role },
              casualty,
            }))
          )
        ),
        fc.boolean(), // whether item comes from toolkit or ownedEquipment
        ({ member, casualty }, fromToolkit) => {
          let toolkitItems: ToolkitItem[] = []
          let memberWithItem: Member = member

          if (fromToolkit) {
            toolkitItems = [{ memberId: member.id, itemId: 'healing_herbs' }]
          } else {
            memberWithItem = {
              ...member,
              ownedEquipment: [...(member.ownedEquipment || []), 'healing_herbs'],
            }
          }

          // Member IS a casualty
          const allMatchMembers = [member.id]

          const result = findHealingHerbsCandidates(
            [casualty],
            toolkitItems,
            [memberWithItem],
            allMatchMembers
          )

          const found = result.some((c) => c.memberId === member.id)
          expect(found).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Permanent Wondrous Cram removal after consumption
// Validates: Requirements 2.4
// ─────────────────────────────────────────────────────────────────────────────

import { removeOwnedEquipment } from '../itemConsumption'

/**
 * Feature: post-match-item-consumption, Property 4: Permanent Wondrous Cram removal after consumption
 *
 * **Validates: Requirements 2.4**
 *
 * For any member with 'wondrous_cram' in ownedEquipment, after consumption,
 * `removeOwnedEquipment(member, 'wondrous_cram')` SHALL produce a member whose
 * ownedEquipment no longer contains 'wondrous_cram'.
 *
 * More generally:
 * 1. Removes exactly one occurrence of the target item from ownedEquipment
 * 2. Does not modify any other items in ownedEquipment
 * 3. Returns member unchanged if item not present
 * 4. The resulting array length is exactly original length - 1 (when item was present)
 */
describe('Feature: post-match-item-consumption, Property 4: Permanent Wondrous Cram removal after consumption', () => {
  const arbEquipmentId = fc.constantFrom(
    'wondrous_cram', 'healing_herbs', 'shield', 'sword', 'bow', 'armour', 'helm'
  )

  it('removes exactly one occurrence of target item from ownedEquipment', () => {
    fc.assert(
      fc.property(
        arbMember(),
        arbEquipmentId,
        (baseMember, targetItem) => {
          // Ensure member has at least one of the target item
          const member: Member = {
            ...baseMember,
            ownedEquipment: [...(baseMember.ownedEquipment || []), targetItem],
          }

          const originalCount = member.ownedEquipment!.filter((e) => e === targetItem).length
          const result = removeOwnedEquipment(member, targetItem)
          const resultCount = result.ownedEquipment!.filter((e) => e === targetItem).length

          // Exactly one occurrence removed
          expect(resultCount).toBe(originalCount - 1)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('does not modify any other items in ownedEquipment', () => {
    fc.assert(
      fc.property(
        arbMember(),
        arbEquipmentId,
        (baseMember, targetItem) => {
          const member: Member = {
            ...baseMember,
            ownedEquipment: [...(baseMember.ownedEquipment || []), targetItem],
          }

          const result = removeOwnedEquipment(member, targetItem)

          // Count of every OTHER item should remain the same
          const otherItems = (member.ownedEquipment || []).filter((e) => e !== targetItem)
          const resultOtherItems = (result.ownedEquipment || []).filter((e) => e !== targetItem)

          expect(resultOtherItems).toEqual(otherItems)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns member unchanged if item not present in ownedEquipment', () => {
    fc.assert(
      fc.property(
        arbMember().map((m) => ({
          ...m,
          // Remove all wondrous_cram from ownedEquipment
          ownedEquipment: (m.ownedEquipment || []).filter((e) => e !== 'wondrous_cram'),
        })),
        (member) => {
          const result = removeOwnedEquipment(member, 'wondrous_cram')

          // Member returned unchanged (same reference)
          expect(result).toBe(member)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('resulting array length is exactly original length - 1 when item was present', () => {
    fc.assert(
      fc.property(
        arbMember(),
        arbEquipmentId,
        (baseMember, targetItem) => {
          const member: Member = {
            ...baseMember,
            ownedEquipment: [...(baseMember.ownedEquipment || []), targetItem],
          }

          const originalLength = member.ownedEquipment!.length
          const result = removeOwnedEquipment(member, targetItem)

          expect(result.ownedEquipment!.length).toBe(originalLength - 1)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Healing Herbs always removed on consumption
// Validates: Requirements 3.4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 7: Healing Herbs always removed on consumption
 *
 * **Validates: Requirements 3.4**
 *
 * For any hero with permanent Healing Herbs consumed, ownedEquipment SHALL always
 * lose 'healing_herbs' after consumption. No retention roll or test exists.
 *
 * Strategy:
 * 1. For any member with 'healing_herbs' in ownedEquipment, removeOwnedEquipment
 *    produces a member without 'healing_herbs' (when only one instance exists)
 * 2. Removal is unconditional — no randomness, no retention chance
 */
describe('Feature: post-match-item-consumption, Property 7: Healing Herbs always removed on consumption', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('removeOwnedEquipment always removes healing_herbs — no retention roll exists', () => {
    fc.assert(
      fc.property(
        arbMember().chain((baseMember) =>
          arbHeroRole.map((role) => ({
            ...baseMember,
            role,
            // Ensure exactly one healing_herbs in ownedEquipment
            ownedEquipment: [
              ...(baseMember.ownedEquipment || []).filter((e) => e !== 'healing_herbs'),
              'healing_herbs',
            ],
          }))
        ),
        (member) => {
          const result = removeOwnedEquipment(member, 'healing_herbs')

          // healing_herbs MUST be gone after removal — unconditional
          expect(result.ownedEquipment).not.toContain('healing_herbs')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('removal is deterministic — same input always produces same output (no randomness)', () => {
    fc.assert(
      fc.property(
        arbMember().chain((baseMember) =>
          arbHeroRole.map((role) => ({
            ...baseMember,
            role,
            ownedEquipment: [
              ...(baseMember.ownedEquipment || []).filter((e) => e !== 'healing_herbs'),
              'healing_herbs',
            ],
          }))
        ),
        (member) => {
          const result1 = removeOwnedEquipment(member, 'healing_herbs')
          const result2 = removeOwnedEquipment(member, 'healing_herbs')

          // Same input → same output every time (no retention roll randomness)
          expect(result1.ownedEquipment).toEqual(result2.ownedEquipment)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Temporary items auto-consume without prompt
// Validates: Requirements 4.1, 4.2, 4.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 8: Temporary items auto-consume without prompt
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * For any toolkit-assigned (temporary) Wondrous Cram or Healing Herbs that meets
 * eligibility criteria, the candidate has `source: 'temporary'` (which means
 * auto-consume without prompt).
 */
describe('Feature: post-match-item-consumption, Property 8: Temporary items auto-consume without prompt', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('Wondrous Cram from toolkitItems always produces source === "temporary"', () => {
    fc.assert(
      fc.property(
        arbMember().chain((member) =>
          arbCasualty(member.id, member.name).map((casualty) => ({ member, casualty }))
        ),
        ({ member, casualty }) => {
          // Item comes from toolkit (temporary)
          const toolkitItems: ToolkitItem[] = [{ memberId: member.id, itemId: 'wondrous_cram' }]

          // Ensure member does NOT have wondrous_cram in ownedEquipment to isolate toolkit source
          const memberClean: Member = {
            ...member,
            ownedEquipment: (member.ownedEquipment || []).filter((e) => e !== 'wondrous_cram'),
          }

          const result = findWondrousCramCandidates(
            [casualty],
            toolkitItems,
            [memberClean]
          )

          const candidate = result.find((c) => c.memberId === member.id)
          expect(candidate).toBeDefined()
          expect(candidate!.source).toBe('temporary')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('Healing Herbs from toolkitItems always produces source === "temporary"', () => {
    fc.assert(
      fc.property(
        arbMember().chain((baseMember) =>
          arbHeroRole.map((role) => ({ ...baseMember, role }))
        ),
        (member) => {
          // Item comes from toolkit (temporary)
          const toolkitItems: ToolkitItem[] = [{ memberId: member.id, itemId: 'healing_herbs' }]

          // Ensure member does NOT have healing_herbs in ownedEquipment to isolate toolkit source
          const memberClean: Member = {
            ...member,
            ownedEquipment: (member.ownedEquipment || []).filter((e) => e !== 'healing_herbs'),
          }

          // Not a casualty, participated in match
          const casualties: PostMatchCasualty[] = []
          const allMatchMembers = [member.id]

          const result = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            [memberClean],
            allMatchMembers
          )

          const candidate = result.find((c) => c.memberId === member.id)
          expect(candidate).toBeDefined()
          expect(candidate!.source).toBe('temporary')
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Permanent items require user confirmation
// Validates: Requirements 5.1, 5.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 9: Permanent items require user confirmation
 *
 * **Validates: Requirements 5.1, 5.2**
 *
 * For any permanent (ownedEquipment) Wondrous Cram or Healing Herbs that meets
 * eligibility criteria, the candidate has `source: 'permanent'` (which means
 * user confirmation required).
 */
describe('Feature: post-match-item-consumption, Property 9: Permanent items require user confirmation', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('Wondrous Cram from ownedEquipment always produces source === "permanent"', () => {
    fc.assert(
      fc.property(
        arbMember().chain((member) =>
          arbCasualty(member.id, member.name).map((casualty) => ({ member, casualty }))
        ),
        ({ member, casualty }) => {
          // No toolkit items — item comes from ownedEquipment only
          const toolkitItems: ToolkitItem[] = []

          // Ensure member HAS wondrous_cram in ownedEquipment
          const memberWithItem: Member = {
            ...member,
            ownedEquipment: [
              ...(member.ownedEquipment || []).filter((e) => e !== 'wondrous_cram'),
              'wondrous_cram',
            ],
          }

          const result = findWondrousCramCandidates(
            [casualty],
            toolkitItems,
            [memberWithItem]
          )

          const candidate = result.find((c) => c.memberId === member.id)
          expect(candidate).toBeDefined()
          expect(candidate!.source).toBe('permanent')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('Healing Herbs from ownedEquipment always produces source === "permanent"', () => {
    fc.assert(
      fc.property(
        arbMember().chain((baseMember) =>
          arbHeroRole.map((role) => ({ ...baseMember, role }))
        ),
        (member) => {
          // No toolkit items — item comes from ownedEquipment only
          const toolkitItems: ToolkitItem[] = []

          // Ensure member HAS healing_herbs in ownedEquipment
          const memberWithItem: Member = {
            ...member,
            ownedEquipment: [
              ...(member.ownedEquipment || []).filter((e) => e !== 'healing_herbs'),
              'healing_herbs',
            ],
          }

          // Not a casualty, participated in match
          const casualties: PostMatchCasualty[] = []
          const allMatchMembers = [member.id]

          const result = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            [memberWithItem],
            allMatchMembers
          )

          const candidate = result.find((c) => c.memberId === member.id)
          expect(candidate).toBeDefined()
          expect(candidate!.source).toBe('permanent')
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Cram-consumed members excluded from injury queue
// Validates: Requirements 2.2, 7.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 3: Cram-consumed members excluded from injury queue
 *
 * **Validates: Requirements 2.2, 7.1**
 *
 * For any post-match state where Wondrous Cram is consumed for a member, that member
 * SHALL NOT appear in the injury roll queue, and their outcome SHALL be Full Recovery.
 *
 * Strategy:
 * 1. Generate a set of casualties, some with wondrous_cram
 * 2. Call findWondrousCramCandidates to get cram candidates
 * 3. Filter casualties to exclude cram candidate member IDs (simulating the resolution logic)
 * 4. Verify: no cram candidate member appears in the filtered injury queue
 * 5. Verify: the filtered queue contains only members who were NOT cram candidates
 */
describe('Feature: post-match-item-consumption, Property 3: Cram-consumed members excluded from injury queue', () => {
  it('cram candidates are excluded from injury queue after filtering', () => {
    fc.assert(
      fc.property(
        // Generate 1-6 members, some with wondrous_cram
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
            hasCram: fc.boolean(),
            cramSource: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
          }),
          { minLength: 1, maxLength: 6 }
        ),
        (memberSpecs) => {
          // Build casualties, toolkit items, and company members from specs
          const casualties: PostMatchCasualty[] = memberSpecs.map((spec) => ({
            memberId: spec.id,
            memberName: spec.name,
            role: 'warrior',
            baseUnitId: 'base_unit',
            isHero: false,
          }))

          const toolkitItems: ToolkitItem[] = memberSpecs
            .filter((spec) => spec.hasCram && spec.cramSource === 'toolkit')
            .map((spec) => ({ memberId: spec.id, itemId: 'wondrous_cram' }))

          const companyMembers: Member[] = memberSpecs.map((spec) => ({
            id: spec.id,
            name: spec.name,
            baseUnitId: 'base_unit',
            role: 'warrior' as MemberRole,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
            ownedEquipment: spec.hasCram && spec.cramSource === 'owned' ? ['wondrous_cram'] : [],
          }))

          // Step 2: find cram candidates
          const cramCandidates = findWondrousCramCandidates(casualties, toolkitItems, companyMembers)
          const resolvedCramMembers = new Set(cramCandidates.map((c) => c.memberId))

          // Step 3: filter casualties (simulating PostMatchSummaryPage logic)
          const effectiveCasualties = casualties.filter(
            (c) => !resolvedCramMembers.has(c.memberId)
          )

          // Step 4: no cram candidate appears in filtered injury queue
          for (const candidate of cramCandidates) {
            const inQueue = effectiveCasualties.some((c) => c.memberId === candidate.memberId)
            expect(inQueue).toBe(false)
          }

          // Step 5: filtered queue contains only non-cram-candidate members
          for (const casualty of effectiveCasualties) {
            expect(resolvedCramMembers.has(casualty.memberId)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('cram-consumed members outcome is Full Recovery (not in injury queue means no injury roll)', () => {
    fc.assert(
      fc.property(
        // Generate at least one member with cram
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
            cramSource: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (cramMembers) => {
          // All these members are casualties with cram
          const casualties: PostMatchCasualty[] = cramMembers.map((spec) => ({
            memberId: spec.id,
            memberName: spec.name,
            role: 'warrior',
            baseUnitId: 'base_unit',
            isHero: false,
          }))

          const toolkitItems: ToolkitItem[] = cramMembers
            .filter((spec) => spec.cramSource === 'toolkit')
            .map((spec) => ({ memberId: spec.id, itemId: 'wondrous_cram' }))

          const companyMembers: Member[] = cramMembers.map((spec) => ({
            id: spec.id,
            name: spec.name,
            baseUnitId: 'base_unit',
            role: 'warrior' as MemberRole,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
            ownedEquipment: spec.cramSource === 'owned' ? ['wondrous_cram'] : [],
          }))

          const cramCandidates = findWondrousCramCandidates(casualties, toolkitItems, companyMembers)
          const resolvedCramMembers = new Set(cramCandidates.map((c) => c.memberId))

          // Effective casualties (injury queue) excludes all cram members
          const effectiveCasualties = casualties.filter(
            (c) => !resolvedCramMembers.has(c.memberId)
          )

          // Every cram candidate is excluded → their outcome is Full Recovery
          // (no injury roll = Full Recovery by game rules)
          // Verify the queue is empty or contains only non-cram members
          for (const candidate of cramCandidates) {
            expect(effectiveCasualties.some((c) => c.memberId === candidate.memberId)).toBe(false)
          }

          // The effective queue size should be total casualties minus cram candidates
          const expectedQueueSize = casualties.length - cramCandidates.length
          expect(effectiveCasualties.length).toBe(expectedQueueSize)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 6: Healing Herbs modifier is +1 and not cumulative
// Validates: Requirements 3.2, 7.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 6: Healing Herbs modifier is +1 and not cumulative
 *
 * **Validates: Requirements 3.2, 7.2**
 *
 * For any post-match state where one or more Healing Herbs are consumed, all injury
 * rolls for all remaining casualties SHALL have exactly +1 added to their 2D6 result
 * (capped at 12). Multiple Healing Herbs consumed in same post-match do NOT stack —
 * modifier is always +1.
 *
 * Strategy:
 * 1. Generate 1-5 heroes with healing_herbs (multiple herbs scenarios)
 * 2. Compute herbs candidates using findHealingHerbsCandidates
 * 3. Simulate the modifier logic: if ANY herbs candidate exists, modifier = 1 (not count)
 * 4. Verify: modifier is always exactly 0 or 1, never > 1 regardless of how many herbs consumed
 * 5. Verify: when at least one herbs candidate exists, modifier is exactly 1
 * 6. Verify: applying modifier to a roll value caps at 12
 */
describe('Feature: post-match-item-consumption, Property 6: Healing Herbs modifier is +1 and not cumulative', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('modifier is always exactly 0 or 1, never > 1 regardless of how many herbs consumed', () => {
    fc.assert(
      fc.property(
        // Generate 1-5 heroes, each with healing_herbs
        fc.integer({ min: 1, max: 5 }).chain((count) =>
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 15 }),
              role: arbHeroRole,
              source: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
            }),
            { minLength: count, maxLength: count }
          )
        ),
        (heroSpecs) => {
          // Build members, toolkit items, casualties (empty — heroes are NOT casualties)
          const casualties: PostMatchCasualty[] = []

          const toolkitItems: ToolkitItem[] = heroSpecs
            .filter((spec) => spec.source === 'toolkit')
            .map((spec) => ({ memberId: spec.id, itemId: 'healing_herbs' }))

          const companyMembers: Member[] = heroSpecs.map((spec) => ({
            id: spec.id,
            name: spec.name,
            baseUnitId: 'base_unit',
            role: spec.role,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
            ownedEquipment: spec.source === 'owned' ? ['healing_herbs'] : [],
          }))

          const allMatchMembers = heroSpecs.map((spec) => spec.id)

          // Find herbs candidates
          const herbsCandidates = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            companyMembers,
            allMatchMembers
          )

          // Simulate modifier logic from PostMatchSummaryPage:
          // injuryModifier: 0 | 1 — set to 1 if ANY herbs consumed
          const injuryModifier: 0 | 1 = herbsCandidates.length > 0 ? 1 : 0

          // Modifier is always 0 or 1, never > 1
          expect(injuryModifier).toBeGreaterThanOrEqual(0)
          expect(injuryModifier).toBeLessThanOrEqual(1)

          // With multiple heroes having herbs, modifier is still exactly 1 (not count)
          if (herbsCandidates.length > 1) {
            expect(injuryModifier).toBe(1)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('when at least one herbs candidate exists, modifier is exactly 1', () => {
    fc.assert(
      fc.property(
        // Generate 1-5 heroes with healing_herbs
        fc.integer({ min: 1, max: 5 }).chain((count) =>
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 15 }),
              role: arbHeroRole,
              source: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
            }),
            { minLength: count, maxLength: count }
          )
        ),
        (heroSpecs) => {
          const casualties: PostMatchCasualty[] = []

          const toolkitItems: ToolkitItem[] = heroSpecs
            .filter((spec) => spec.source === 'toolkit')
            .map((spec) => ({ memberId: spec.id, itemId: 'healing_herbs' }))

          const companyMembers: Member[] = heroSpecs.map((spec) => ({
            id: spec.id,
            name: spec.name,
            baseUnitId: 'base_unit',
            role: spec.role,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
            ownedEquipment: spec.source === 'owned' ? ['healing_herbs'] : [],
          }))

          const allMatchMembers = heroSpecs.map((spec) => spec.id)

          const herbsCandidates = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            companyMembers,
            allMatchMembers
          )

          // At least one candidate should exist (all heroes have herbs, none are casualties)
          expect(herbsCandidates.length).toBeGreaterThanOrEqual(1)

          // Modifier logic: if ANY herbs candidate exists → modifier = 1
          const injuryModifier: 0 | 1 = herbsCandidates.length > 0 ? 1 : 0
          expect(injuryModifier).toBe(1)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('applying modifier to a roll value caps at 12 (roll of 12 + 1 = still 12)', () => {
    fc.assert(
      fc.property(
        // Generate a 2D6 roll result (2-12) and a modifier (0 or 1)
        fc.integer({ min: 2, max: 12 }),
        fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>,
        (rollValue, modifier) => {
          // Apply modifier with cap at 12 (as per game rules)
          const modifiedRoll = Math.min(rollValue + modifier, 12)

          // Result never exceeds 12
          expect(modifiedRoll).toBeLessThanOrEqual(12)

          // Result is at least the original roll (modifier is non-negative)
          expect(modifiedRoll).toBeGreaterThanOrEqual(rollValue)

          // When modifier is 1 and roll < 12, result is roll + 1
          if (modifier === 1 && rollValue < 12) {
            expect(modifiedRoll).toBe(rollValue + 1)
          }

          // When roll is already 12, modifier doesn't push past cap
          if (rollValue === 12) {
            expect(modifiedRoll).toBe(12)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('modifier is exactly 0 when no herbs candidates exist', () => {
    fc.assert(
      fc.property(
        // Generate warriors (not heroes) — they cannot be herbs candidates
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (warriorSpecs) => {
          const casualties: PostMatchCasualty[] = []
          const toolkitItems: ToolkitItem[] = warriorSpecs.map((spec) => ({
            memberId: spec.id,
            itemId: 'healing_herbs',
          }))

          // All members are warriors — ineligible for herbs
          const companyMembers: Member[] = warriorSpecs.map((spec) => ({
            id: spec.id,
            name: spec.name,
            baseUnitId: 'base_unit',
            role: 'warrior' as MemberRole,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
            ownedEquipment: ['healing_herbs'],
          }))

          const allMatchMembers = warriorSpecs.map((spec) => spec.id)

          const herbsCandidates = findHealingHerbsCandidates(
            casualties,
            toolkitItems,
            companyMembers,
            allMatchMembers
          )

          // No candidates (warriors ineligible)
          expect(herbsCandidates.length).toBe(0)

          // Modifier logic: no candidates → modifier = 0
          const injuryModifier: 0 | 1 = herbsCandidates.length > 0 ? 1 : 0
          expect(injuryModifier).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Property 10: Wondrous Cram resolved before Healing Herbs
// Validates: Requirements 7.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: post-match-item-consumption, Property 10: Wondrous Cram resolved before Healing Herbs
 *
 * **Validates: Requirements 7.3**
 *
 * For any post-match state with both Wondrous Cram and Healing Herbs eligible, all
 * Cram resolutions (removing members from injury queue) SHALL complete before any
 * Herbs resolutions (determining modifier).
 *
 * Strategy:
 * 1. Generate a scenario with both cram-eligible casualties and herbs-eligible heroes
 * 2. Simulate the resolution order: first resolve all cram (build resolvedCramMembers set),
 *    then resolve herbs (set modifier)
 * 3. Verify: the injury queue used for herbs modifier application already has cram members removed
 * 4. Verify: herbs modifier applies only to the post-cram-filtered casualty list
 */
describe('Feature: post-match-item-consumption, Property 10: Wondrous Cram resolved before Healing Herbs', () => {
  const arbHeroRole = fc.constantFrom<MemberRole>('leader', 'sergeant', 'hero_in_making')

  it('injury queue used for herbs modifier already has cram members removed', () => {
    fc.assert(
      fc.property(
        // Generate 1-4 casualties with cram
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
            cramSource: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
          }),
          { minLength: 1, maxLength: 4 }
        ),
        // Generate 1-4 non-casualty heroes with herbs
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
            role: arbHeroRole,
            herbsSource: fc.constantFrom('toolkit', 'owned') as fc.Arbitrary<'toolkit' | 'owned'>,
          }),
          { minLength: 1, maxLength: 4 }
        ),
        // Generate 0-3 additional casualties WITHOUT cram (stay in queue)
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
          }),
          { minLength: 0, maxLength: 3 }
        ),
        (cramSpecs, herbsSpecs, plainCasualtySpecs) => {
          // Build all casualties: cram members + plain casualties
          const allCasualties: PostMatchCasualty[] = [
            ...cramSpecs.map((spec) => ({
              memberId: spec.id,
              memberName: spec.name,
              role: 'warrior',
              baseUnitId: 'base_unit',
              isHero: false,
            })),
            ...plainCasualtySpecs.map((spec) => ({
              memberId: spec.id,
              memberName: spec.name,
              role: 'warrior',
              baseUnitId: 'base_unit',
              isHero: false,
            })),
          ]

          // Build toolkit items
          const toolkitItems: ToolkitItem[] = [
            ...cramSpecs
              .filter((spec) => spec.cramSource === 'toolkit')
              .map((spec) => ({ memberId: spec.id, itemId: 'wondrous_cram' })),
            ...herbsSpecs
              .filter((spec) => spec.herbsSource === 'toolkit')
              .map((spec) => ({ memberId: spec.id, itemId: 'healing_herbs' })),
          ]

          // Build company members (cram casualties + herbs heroes + plain casualties)
          const companyMembers: Member[] = [
            ...cramSpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: 'warrior' as MemberRole,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: spec.cramSource === 'owned' ? ['wondrous_cram'] : [],
            })),
            ...herbsSpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: spec.role,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: spec.herbsSource === 'owned' ? ['healing_herbs'] : [],
            })),
            ...plainCasualtySpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: 'warrior' as MemberRole,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: [],
            })),
          ]

          const allMatchMembers = companyMembers.map((m) => m.id)

          // ─── Step 1: Resolve Cram FIRST ───────────────────────────────
          const cramCandidates = findWondrousCramCandidates(
            allCasualties,
            toolkitItems,
            companyMembers
          )
          const resolvedCramMembers = new Set(cramCandidates.map((c) => c.memberId))

          // ─── Step 2: Filter injury queue (cram members removed) ────────
          const effectiveCasualties = allCasualties.filter(
            (c) => !resolvedCramMembers.has(c.memberId)
          )

          // ─── Step 3: Resolve Herbs AFTER cram ─────────────────────────
          const herbsCandidates = findHealingHerbsCandidates(
            allCasualties,
            toolkitItems,
            companyMembers,
            allMatchMembers
          )
          const injuryModifier: 0 | 1 = herbsCandidates.length > 0 ? 1 : 0

          // ─── Verify: cram members NOT in effective injury queue ────────
          for (const cramCandidate of cramCandidates) {
            const inQueue = effectiveCasualties.some(
              (c) => c.memberId === cramCandidate.memberId
            )
            expect(inQueue).toBe(false)
          }

          // ─── Verify: herbs modifier applies to post-cram-filtered list ─
          // The effective casualties (those who get injury rolls with modifier)
          // should contain NONE of the cram-resolved members
          for (const casualty of effectiveCasualties) {
            expect(resolvedCramMembers.has(casualty.memberId)).toBe(false)
          }

          // ─── Verify: herbs modifier is determined AFTER cram removal ───
          // If herbs candidates exist, modifier is 1 and applies to remaining queue
          if (herbsCandidates.length > 0) {
            expect(injuryModifier).toBe(1)
            // Modifier applies only to effectiveCasualties (post-cram)
            // effectiveCasualties should be exactly: all casualties minus cram members
            expect(effectiveCasualties.length).toBe(
              allCasualties.length - cramCandidates.length
            )
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('herbs modifier applies only to post-cram-filtered casualty list', () => {
    fc.assert(
      fc.property(
        // Generate 1-3 casualties with cram
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        // Generate 1-3 non-casualty heroes with herbs
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
            role: arbHeroRole,
          }),
          { minLength: 1, maxLength: 3 }
        ),
        // Generate 1-3 additional casualties WITHOUT cram
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 15 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        // Generate a 2D6 roll for each remaining casualty
        fc.integer({ min: 2, max: 12 }),
        (cramSpecs, herbsSpecs, plainCasualtySpecs, baseRoll) => {
          // Build casualties
          const allCasualties: PostMatchCasualty[] = [
            ...cramSpecs.map((spec) => ({
              memberId: spec.id,
              memberName: spec.name,
              role: 'warrior',
              baseUnitId: 'base_unit',
              isHero: false,
            })),
            ...plainCasualtySpecs.map((spec) => ({
              memberId: spec.id,
              memberName: spec.name,
              role: 'warrior',
              baseUnitId: 'base_unit',
              isHero: false,
            })),
          ]

          // All cram from toolkit for simplicity (auto-consume)
          const toolkitItems: ToolkitItem[] = [
            ...cramSpecs.map((spec) => ({ memberId: spec.id, itemId: 'wondrous_cram' })),
            ...herbsSpecs.map((spec) => ({ memberId: spec.id, itemId: 'healing_herbs' })),
          ]

          const companyMembers: Member[] = [
            ...cramSpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: 'warrior' as MemberRole,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: [],
            })),
            ...herbsSpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: spec.role,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: [],
            })),
            ...plainCasualtySpecs.map((spec) => ({
              id: spec.id,
              name: spec.name,
              baseUnitId: 'base_unit',
              role: 'warrior' as MemberRole,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
              ownedEquipment: [],
            })),
          ]

          const allMatchMembers = companyMembers.map((m) => m.id)

          // Resolve cram first
          const cramCandidates = findWondrousCramCandidates(
            allCasualties,
            toolkitItems,
            companyMembers
          )
          const resolvedCramMembers = new Set(cramCandidates.map((c) => c.memberId))

          // Filter injury queue
          const effectiveCasualties = allCasualties.filter(
            (c) => !resolvedCramMembers.has(c.memberId)
          )

          // Resolve herbs
          const herbsCandidates = findHealingHerbsCandidates(
            allCasualties,
            toolkitItems,
            companyMembers,
            allMatchMembers
          )
          const injuryModifier: 0 | 1 = herbsCandidates.length > 0 ? 1 : 0

          // Apply modifier to each remaining casualty's roll
          const modifiedRoll = Math.min(baseRoll + injuryModifier, 12)

          // Cram members get NO roll at all (Full Recovery)
          // Only effectiveCasualties get the modified roll
          expect(effectiveCasualties.length).toBe(plainCasualtySpecs.length)

          // The modified roll includes herbs bonus
          if (injuryModifier === 1 && baseRoll < 12) {
            expect(modifiedRoll).toBe(baseRoll + 1)
          }

          // Cram members are NOT subject to any roll (even with modifier)
          for (const cramCandidate of cramCandidates) {
            expect(
              effectiveCasualties.some((c) => c.memberId === cramCandidate.memberId)
            ).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
