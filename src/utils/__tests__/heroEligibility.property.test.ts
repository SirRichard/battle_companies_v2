// Feature: parameterized-special-rules, Property 3: Hero eligibility filter

/**
 * Property 3: Hero eligibility filter
 * Validates: Requirements 1.4, 2.1
 *
 * For any company member array and receiving member ID, `getEligibleHeroes`
 * SHALL return only members whose role is one of (leader, sergeant, hero_in_making)
 * AND whose ID is not equal to the receiving member ID.
 * The result SHALL never include the receiving member and SHALL never include warriors.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getEligibleHeroes } from '../parameterizedRules'
import type { Member, MemberRole } from '../../models'

// ── Generators ────────────────────────────────────────────────────────────────

const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']
const ALL_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making', 'warrior']

const arbRole: fc.Arbitrary<MemberRole> = fc.constantFrom(...ALL_ROLES)

const arbMemberId = fc.uuid()

const arbMember: fc.Arbitrary<Member> = fc
  .record({
    id: arbMemberId,
    name: fc.string({ minLength: 1, maxLength: 20 }),
    role: arbRole,
    experience: fc.nat({ max: 100 }),
  })
  .map(({ id, name, role, experience }) => ({
    id,
    name,
    baseUnitId: 'base-unit',
    role,
    equipment: [],
    experience,
    lifetimeExperience: experience,
    injuries: [],
    specialRules: [] as Array<string | { id: string; parameter: string | number }>,
    statIncreases: {},
    statDecreases: {},
  }))

const arbCompanyMembers = fc.array(arbMember, { minLength: 0, maxLength: 15 })

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 3: Hero eligibility filter', () => {
  it('result contains only members with hero roles (leader, sergeant, hero_in_making)', () => {
    fc.assert(
      fc.property(arbCompanyMembers, arbMemberId, (members, receivingId) => {
        const result = getEligibleHeroes(members, receivingId)

        for (const member of result) {
          expect(HERO_ROLES).toContain(member.role)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('result never contains warriors', () => {
    fc.assert(
      fc.property(arbCompanyMembers, arbMemberId, (members, receivingId) => {
        const result = getEligibleHeroes(members, receivingId)

        for (const member of result) {
          expect(member.role).not.toBe('warrior')
        }
      }),
      { numRuns: 100 }
    )
  })

  it('result never contains the receiving member', () => {
    fc.assert(
      fc.property(arbCompanyMembers, (members) => {
        // Pick a receiving member from the array if non-empty, otherwise use random ID
        if (members.length === 0) return

        const receivingIndex = Math.floor(Math.random() * members.length)
        const receivingId = members[receivingIndex].id

        const result = getEligibleHeroes(members, receivingId)

        for (const member of result) {
          expect(member.id).not.toBe(receivingId)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('result includes ALL hero-role members that are not the receiving member', () => {
    fc.assert(
      fc.property(arbCompanyMembers, arbMemberId, (members, receivingId) => {
        const result = getEligibleHeroes(members, receivingId)

        // Every hero-role member (excluding receiving) should be in result
        const expected = members.filter(
          (m) => HERO_ROLES.includes(m.role) && m.id !== receivingId
        )

        expect(result).toHaveLength(expected.length)
        for (const member of expected) {
          expect(result).toContainEqual(member)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('receiving member excluded even when they have a hero role', () => {
    // Targeted property: ensure a hero-role receiving member is excluded
    const arbHeroRole: fc.Arbitrary<MemberRole> = fc.constantFrom(...HERO_ROLES)

    fc.assert(
      fc.property(
        arbCompanyMembers,
        arbHeroRole,
        arbMemberId,
        (otherMembers, heroRole, receivingId) => {
          // Create a receiving member with a hero role
          const receivingMember: Member = {
            id: receivingId,
            name: 'Receiver',
            baseUnitId: 'base-unit',
            role: heroRole,
            equipment: [],
            experience: 10,
            lifetimeExperience: 10,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
          }

          const allMembers = [...otherMembers, receivingMember]
          const result = getEligibleHeroes(allMembers, receivingId)

          // Receiving member must not appear in result
          expect(result.find((m) => m.id === receivingId)).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
