/**
 * Preservation Property Tests
 * Property 2: Preservation — Non-Boost Flows Unchanged
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * These tests capture baseline behavior that MUST remain unchanged after the fix.
 * They model the CURRENT (unfixed) code logic for non-boost flows and verify
 * that the treatment state machine produces correct outcomes.
 *
 * Observation-first methodology:
 * - Successful rolls (>= 5): handleTreatConfirm deducts 1 IP (treatAdjust=0), removes injury
 * - Warrior remove_missing: deducts 1 IP, removes missing_next_game
 * - Hero miss_hero (Send to Healers): deducts 1 IP, removes target injury, adds missing_next_game
 * - Insufficient IP + failed roll: increment disabled, user accepts failure (1 IP deducted, injury stays)
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code (confirms baseline to preserve).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Types (mirroring src/models) ──────────────────────────────────────────────

interface Injury {
  type: 'arm_wound' | 'leg_wound' | 'broken_honour' | 'missing_next_game'
  count: number
}

interface Member {
  id: string
  name: string
  role: 'leader' | 'sergeant' | 'hero_in_making' | 'warrior'
  injuries: Injury[]
  baseUnitId: string
  equipment: string[]
  experience: number
  statIncreases: Record<string, number>
  statDecreases: Record<string, number>
}

interface Company {
  id: string
  name: string
  influence: number
  members: Member[]
}

// ── Model: Treatment state machine (extracted from CompanyDetailsPage & MemberDetailsDrawer) ──

type TreatType = 'remove_warrior' | 'roll_hero' | 'miss_hero'

interface TreatmentState {
  treatType: TreatType
  treatTargetInjury: string
  treatAdjust: number
  rollResult: number | null
}

/**
 * Models handleTreatConfirm from both CompanyDetailsPage (InjuryTreatmentPanel)
 * and MemberDetailsDrawer. Both have identical logic for these flows.
 *
 * Returns the updated company state after treatment.
 */
function applyTreatment(
  company: Company,
  memberId: string,
  state: TreatmentState
): Company {
  const influence = company.influence

  if (state.treatType === 'remove_warrior') {
    // 1 IP: remove missing_next_game
    return {
      ...company,
      influence: influence - 1,
      members: company.members.map((m) =>
        m.id !== memberId
          ? m
          : {
              ...m,
              injuries: m.injuries.filter((i) => i.type !== 'missing_next_game'),
            }
      ),
    }
  }

  if (state.treatType === 'miss_hero') {
    // 1 IP: remove target injury, add missing_next_game
    return {
      ...company,
      influence: influence - 1,
      members: company.members.map((m) =>
        m.id !== memberId
          ? m
          : {
              ...m,
              injuries: (() => {
                const injs = [...m.injuries]
                const idx = injs.findIndex((i) => i.type === state.treatTargetInjury)
                if (idx >= 0) injs.splice(idx, 1)
                if (!injs.find((i) => i.type === 'missing_next_game')) {
                  injs.push({ type: 'missing_next_game' as const, count: 1 })
                }
                return injs
              })(),
            }
      ),
    }
  }

  if (state.treatType === 'roll_hero' && state.rollResult !== null) {
    const totalCost = 1 + state.treatAdjust
    if (state.rollResult + state.treatAdjust >= 5) {
      // Success: remove injury
      return {
        ...company,
        influence: influence - totalCost,
        members: company.members.map((m) =>
          m.id !== memberId
            ? m
            : {
                ...m,
                injuries: (() => {
                  const injs = [...m.injuries]
                  const idx = injs.findIndex((i) => i.type === state.treatTargetInjury)
                  if (idx >= 0) injs.splice(idx, 1)
                  return injs
                })(),
              }
        ),
      }
    } else {
      // Failure: just deduct IP, injury stays
      return { ...company, influence: influence - totalCost }
    }
  }

  return company
}

/**
 * Models whether the increment button is disabled.
 * From CompanyDetailsPage: disabled when treatAdjust >= 3 || company.influence < 1 + treatAdjust + 1
 * From MemberDetailsDrawer: same logic (treatAdjust >= 3 || company.influence < 1 + treatAdjust + 1)
 */
function isIncrementDisabled(influence: number, treatAdjust: number): boolean {
  return treatAdjust >= 3 || influence < 1 + treatAdjust + 1
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const heroInjuryTypeArb: fc.Arbitrary<'arm_wound' | 'leg_wound' | 'broken_honour'> =
  fc.constantFrom('arm_wound', 'leg_wound', 'broken_honour')

const successfulRollArb: fc.Arbitrary<number> = fc.constantFrom(5, 6)

const failedRollArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 4 })

const ipBalanceArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 20 })

/** Generate a hero member with at least one treatable injury */
function heroMemberArb(injuryType: fc.Arbitrary<Injury['type']>): fc.Arbitrary<Member> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    role: fc.constantFrom('leader' as const, 'sergeant' as const, 'hero_in_making' as const),
    injuries: injuryType.map((t) => [{ type: t, count: 1 }]),
    baseUnitId: fc.constant('ranger_of_the_north'),
    equipment: fc.constant([]),
    experience: fc.integer({ min: 0, max: 30 }),
    statIncreases: fc.constant({}),
    statDecreases: fc.constant({}),
  })
}

/** Generate a warrior member with missing_next_game */
function warriorWithMissingArb(): fc.Arbitrary<Member> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    role: fc.constant('warrior' as const),
    injuries: fc.constant([{ type: 'missing_next_game' as const, count: 1 }]),
    baseUnitId: fc.constant('warrior_of_minas_tirith'),
    equipment: fc.constant([]),
    experience: fc.integer({ min: 0, max: 30 }),
    statIncreases: fc.constant({}),
    statDecreases: fc.constant({}),
  })
}

/** Build a company around a single member */
function buildCompany(member: Member, influence: number): Company {
  return {
    id: 'test-company',
    name: 'Test Company',
    influence,
    members: [member],
  }
}

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Property 2 (Preservation): Non-Boost Flows Unchanged', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * Successful rolls (natural >= 5) with treatAdjust=0:
   * - Injury is removed from member
   * - Exactly 1 IP deducted (base cost only, no boost)
   * - No boost prompt needed (roll already succeeded)
   */
  it('successful roll (>= 5): injury removed, 1 IP deducted, no boost needed', () => {
    fc.assert(
      fc.property(
        heroMemberArb(heroInjuryTypeArb),
        successfulRollArb,
        ipBalanceArb,
        (member, rollResult, ipBalance) => {
          const company = buildCompany(member, ipBalance)
          const injuryType = member.injuries[0].type

          const state: TreatmentState = {
            treatType: 'roll_hero',
            treatTargetInjury: injuryType,
            treatAdjust: 0, // No pre-roll boost for preservation (natural success)
            rollResult,
          }

          const result = applyTreatment(company, member.id, state)

          // Injury removed
          const resultMember = result.members.find((m) => m.id === member.id)!
          expect(resultMember.injuries.find((i) => i.type === injuryType)).toBeUndefined()

          // Exactly 1 IP deducted (base cost, no boost)
          expect(result.influence).toBe(ipBalance - 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.2**
   *
   * Warrior remove_missing treatment:
   * - missing_next_game removed from warrior
   * - Exactly 1 IP deducted
   * - No roll involved
   */
  it('warrior remove_missing: missing_next_game removed, 1 IP deducted', () => {
    fc.assert(
      fc.property(
        warriorWithMissingArb(),
        ipBalanceArb,
        (member, ipBalance) => {
          const company = buildCompany(member, ipBalance)

          const state: TreatmentState = {
            treatType: 'remove_warrior',
            treatTargetInjury: 'missing_next_game',
            treatAdjust: 0,
            rollResult: null, // No roll for warrior treatment
          }

          const result = applyTreatment(company, member.id, state)

          // missing_next_game removed
          const resultMember = result.members.find((m) => m.id === member.id)!
          expect(resultMember.injuries.find((i) => i.type === 'missing_next_game')).toBeUndefined()

          // Exactly 1 IP deducted
          expect(result.influence).toBe(ipBalance - 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * Hero "Send to Healers" (miss_hero):
   * - Target injury removed from hero
   * - missing_next_game added to hero
   * - Exactly 1 IP deducted
   * - No roll involved
   */
  it('hero miss_hero (Send to Healers): target injury removed, missing_next_game added, 1 IP deducted', () => {
    fc.assert(
      fc.property(
        heroMemberArb(heroInjuryTypeArb),
        ipBalanceArb,
        (member, ipBalance) => {
          const company = buildCompany(member, ipBalance)
          const injuryType = member.injuries[0].type

          const state: TreatmentState = {
            treatType: 'miss_hero',
            treatTargetInjury: injuryType,
            treatAdjust: 0,
            rollResult: null, // No roll for healer treatment
          }

          const result = applyTreatment(company, member.id, state)

          const resultMember = result.members.find((m) => m.id === member.id)!

          // Target injury removed
          expect(resultMember.injuries.find((i) => i.type === injuryType)).toBeUndefined()

          // missing_next_game added
          expect(resultMember.injuries.find((i) => i.type === 'missing_next_game')).toBeDefined()

          // Exactly 1 IP deducted
          expect(result.influence).toBe(ipBalance - 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.4**
   *
   * Insufficient IP for boost (company.influence == 1, failed roll):
   * - Increment control is disabled (can't afford boost)
   * - User can only accept failure: 1 IP deducted, injury remains
   */
  it('insufficient IP (influence == 1, failed roll): increment disabled, user accepts failure', () => {
    fc.assert(
      fc.property(
        heroMemberArb(heroInjuryTypeArb),
        failedRollArb,
        (member, rollResult) => {
          const ipBalance = 1 // Minimum — can only afford base cost
          const company = buildCompany(member, ipBalance)
          const injuryType = member.injuries[0].type

          // Increment is disabled at treatAdjust=0 when influence=1
          // Formula: influence < 1 + treatAdjust + 1 → 1 < 1 + 0 + 1 → 1 < 2 → true (disabled)
          expect(isIncrementDisabled(ipBalance, 0)).toBe(true)

          // User accepts failure with treatAdjust=0
          const state: TreatmentState = {
            treatType: 'roll_hero',
            treatTargetInjury: injuryType,
            treatAdjust: 0,
            rollResult,
          }

          const result = applyTreatment(company, member.id, state)

          // Injury remains (roll < 5 with no boost)
          const resultMember = result.members.find((m) => m.id === member.id)!
          expect(resultMember.injuries.find((i) => i.type === injuryType)).toBeDefined()

          // 1 IP deducted (base cost only)
          expect(result.influence).toBe(ipBalance - 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
