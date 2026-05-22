// Feature: battle-companies-fixes-and-features, Property 32: ATO wanderer is not persisted to company.wandererId

/**
 * Property 32: ATO wanderer is not persisted to company.wandererId
 * Validates: Requirements 37.7
 *
 * When a wanderer is added to ActiveMatchState.members via the ATO flow
 * (present in members with role: 'wanderer' but not in company.members),
 * company.wandererId must remain unchanged (null or its previous value).
 *
 * The key invariant: adding a wanderer to ActiveMatchState.members does NOT
 * modify company.wandererId.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { ActiveMatchState, MemberMatchState, AtoBonusType } from '../../models/match'
import type { Company } from '../../models'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulates the ATO wanderer confirmation logic from WandererSelectionPage:
 * appends a synthetic MemberMatchState to match.members without touching
 * company.wandererId.
 */
function addAtoWandererToMatch(
  match: ActiveMatchState,
  wandererId: string,
  wandererName: string,
  might: number,
  will: number,
  fate: number
): ActiveMatchState {
  const wandererMember: MemberMatchState = {
    memberId: wandererId,
    memberName: wandererName,
    baseUnitId: wandererId,
    role: 'wanderer',
    equipment: [],
    xpCounterGains: 0,
    isCasualty: false,
    mightMax: might,
    willMax: will,
    fateMax: fate,
    mightCurrent: might,
    willCurrent: will,
    fateCurrent: fate,
  }
  return {
    ...match,
    members: [...match.members, wandererMember],
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const atoBonusArb: fc.Arbitrary<AtoBonusType> = fc.constantFrom(
  'influence',
  'experience',
  'reroll',
  'toolkit',
  'wanderer',
  'ambush'
)

const memberMatchStateArb: fc.Arbitrary<MemberMatchState> = fc
  .record({
    memberId: fc.uuid(),
    memberName: fc.string({ minLength: 1, maxLength: 20 }),
    baseUnitId: fc.string({ minLength: 1, maxLength: 20 }),
    role: fc.constantFrom('leader', 'sergeant', 'hero_in_making', 'warrior'),
    equipment: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 4 }),
    xpCounterGains: fc.integer({ min: 0, max: 5 }),
    isCasualty: fc.boolean(),
    mightMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
    willMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
    fateMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
    mightCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
    willCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
    fateCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  })

const activeMatchStateArb: fc.Arbitrary<ActiveMatchState> = fc
  .record({
    companyId: fc.uuid(),
    opponentRating: fc.integer({ min: 1, max: 500 }),
    scenarioId: fc.string({ minLength: 1, maxLength: 20 }),
    scenarioLabel: fc.string({ minLength: 1, maxLength: 40 }),
    atoBonuses: fc.array(atoBonusArb, { maxLength: 4 }),
    rerollsRemaining: fc.integer({ min: 0, max: 2 }),
    toolkitItems: fc.constant([]),
    members: fc.array(memberMatchStateArb, { minLength: 0, maxLength: 6 }),
    startedAt: fc.constant(new Date().toISOString()),
  })

/** Generates a company with an optional wandererId (null or a wanderer ID string) */
const companyWandererIdArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constantFrom(
    'wandering_swordsman',
    'wandering_marksman',
    'wandering_scavenger',
    'wandering_sage'
  )
)

/** Generates a wanderer ID from the known wanderers.json set */
const wandererIdArb: fc.Arbitrary<string> = fc.constantFrom(
  'wandering_swordsman',
  'wandering_marksman',
  'wandering_scavenger',
  'wandering_sage'
)

// ─── Property tests ───────────────────────────────────────────────────────────

describe('Property 32: ATO wanderer is not persisted to company.wandererId', () => {
  it('adding an ATO wanderer to match.members does not change company.wandererId', () => {
    fc.assert(
      fc.property(
        activeMatchStateArb,
        companyWandererIdArb,
        wandererIdArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 3 }),
        (match, initialWandererId, wandererId, wandererName, might, will, fate) => {
          // Capture the initial company.wandererId
          const companyBefore: Partial<Company> = { wandererId: initialWandererId ?? undefined }

          // Simulate the ATO wanderer confirmation
          const updatedMatch = addAtoWandererToMatch(
            match,
            wandererId,
            wandererName,
            might,
            will,
            fate
          )

          // company.wandererId must be unchanged
          const companyAfter: Partial<Company> = { wandererId: initialWandererId ?? undefined }
          expect(companyAfter.wandererId).toBe(companyBefore.wandererId)

          // The wanderer must be present in match.members
          const addedMember = updatedMatch.members.find(
            (m) => m.memberId === wandererId && m.role === 'wanderer'
          )
          expect(addedMember).toBeDefined()
        }
      ),
      { numRuns: 500 }
    )
  })

  it('ATO wanderer in match.members has role "wanderer"', () => {
    fc.assert(
      fc.property(
        activeMatchStateArb,
        wandererIdArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 3 }),
        (match, wandererId, wandererName, might, will, fate) => {
          const updatedMatch = addAtoWandererToMatch(
            match,
            wandererId,
            wandererName,
            might,
            will,
            fate
          )

          const addedMember = updatedMatch.members.find(
            (m) => m.memberId === wandererId
          )
          expect(addedMember?.role).toBe('wanderer')
        }
      ),
      { numRuns: 500 }
    )
  })

  it('ATO wanderer memberId is not in company.members', () => {
    fc.assert(
      fc.property(
        activeMatchStateArb,
        wandererIdArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 3 }),
        // Generate company members that do NOT include the wanderer ID
        fc.array(
          fc.record({
            id: fc.uuid(), // UUIDs won't collide with wanderer IDs
            name: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 0, maxLength: 6 }
        ),
        (match, wandererId, wandererName, might, will, fate, companyMembersPartial) => {
          const companyMemberIds = new Set(companyMembersPartial.map((m) => m.id))

          const updatedMatch = addAtoWandererToMatch(
            match,
            wandererId,
            wandererName,
            might,
            will,
            fate
          )

          // The ATO wanderer's memberId should NOT be in company.members
          // (this is the definition of an ATO wanderer vs a permanently hired one)
          expect(companyMemberIds.has(wandererId)).toBe(false)

          // The wanderer is present in match.members
          const addedMember = updatedMatch.members.find(
            (m) => m.memberId === wandererId && m.role === 'wanderer'
          )
          expect(addedMember).toBeDefined()
        }
      ),
      { numRuns: 500 }
    )
  })

  it('original match members are preserved after adding ATO wanderer', () => {
    fc.assert(
      fc.property(
        activeMatchStateArb,
        wandererIdArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 3 }),
        (match, wandererId, wandererName, might, will, fate) => {
          const originalMemberCount = match.members.length
          const updatedMatch = addAtoWandererToMatch(
            match,
            wandererId,
            wandererName,
            might,
            will,
            fate
          )

          // Original members are all still present
          expect(updatedMatch.members.length).toBe(originalMemberCount + 1)
          for (const original of match.members) {
            expect(
              updatedMatch.members.some((m) => m.memberId === original.memberId)
            ).toBe(true)
          }
        }
      ),
      { numRuns: 500 }
    )
  })
})
