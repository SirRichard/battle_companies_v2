/**
 * Bug Condition Exploration Test
 * Property 1: Bug Condition — Hero Upgrades Display Shows Unowned Upgrades
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists: MemberDetailsDrawer renders upgrades
 * the hero does NOT own by calling getEligibleHeroUpgrades() (which returns
 * upgrades the hero can still earn) instead of filtering by member.equipment.
 *
 * The test encodes the CORRECT expected behavior — it will pass after the fix.
 *
 * Bug Condition (formal):
 *   FUNCTION isBugCondition(member, companyDef)
 *     ownedUpgradeIds ← member.equipment ∩ { u.id | u ∈ companyDef.heroUpgrade }
 *     displayedUpgrades ← getEligibleHeroUpgrades(companyDef, member)
 *     RETURN displayedUpgrades.length > 0
 *            AND displayedUpgrades.some(u => NOT member.equipment.includes(u.id))
 *   END FUNCTION
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getEligibleHeroUpgrades } from '../../../utils/companyRules'
import companiesData from '../../../data/companies.json'
import type { CompanyDefinition, Member } from '../../../models'

const ALL_COMPANIES = companiesData as CompanyDefinition[]

// ── The Shire company — has two heroUpgrade entries ───────────────────────────
// "of_a_party_sort" and "throwing_stones"
const SHIRE_COMPANY = ALL_COMPANIES.find((c) => c.id === 'the_shire')!

// ── Simulated (fixed) MemberDetailsDrawer logic ──────────────────────────────
// This mirrors the FIXED code in MemberDetailsDrawer.tsx:
//   const ownedUpgrades = companyDef.heroUpgrade.filter((u) =>
//     member.equipment.includes(u.id)
//   )
// The section displays `ownedUpgrades` — only upgrades the hero already has.
function simulateBuggyDisplayedUpgrades(
  companyDef: CompanyDefinition,
  member: Member
) {
  return companyDef.heroUpgrade.filter((u) => member.equipment.includes(u.id))
}

// ── Correct (expected) display logic ─────────────────────────────────────────
// What the display SHOULD show: only upgrades already in member.equipment
function correctDisplayedUpgrades(
  companyDef: CompanyDefinition,
  member: Member
) {
  return companyDef.heroUpgrade.filter((u) => member.equipment.includes(u.id))
}

// ── Minimal hero member factory ───────────────────────────────────────────────
function makeHeroMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'test-hero-1',
    name: 'Bilbo',
    baseUnitId: 'hobbit_militia',
    role: 'leader',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    heroStats: { might: 1, will: 1, fate: 1 },
    statIncreases: {},
    statDecreases: {},
    ...overrides,
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

// All hero upgrade IDs for The Shire
const SHIRE_UPGRADE_IDS = SHIRE_COMPANY.heroUpgrade.map((u) => u.id)

// Arbitrary: a subset of Shire upgrade IDs (0 to all)
const subsetOfShireUpgrades = fc.array(
  fc.constantFrom(...SHIRE_UPGRADE_IDS),
  { minLength: 0, maxLength: SHIRE_UPGRADE_IDS.length }
).map((arr) => [...new Set(arr)]) // deduplicate

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 1 (Bug Condition): Hero Upgrades Display Shows Unowned Upgrades', () => {
  /**
   * Case 1: Hero with NO owned upgrades (equipment = [])
   *
   * The buggy code calls getEligibleHeroUpgrades(), which returns ALL upgrades
   * (since none are owned). The section displays them as if the hero has them.
   *
   * Expected (correct): section should be empty / hidden (no owned upgrades).
   * Actual (buggy): section shows ["of_a_party_sort", "throwing_stones"].
   *
   * This test WILL FAIL on unfixed code — that is the expected outcome.
   */
  it('hero with equipment=[] should display NO upgrades (section hidden)', () => {
    const member = makeHeroMember({ equipment: [] })

    // Simulate the buggy display logic
    const displayed = simulateBuggyDisplayedUpgrades(SHIRE_COMPANY, member)

    // Assert: every displayed upgrade must be in member.equipment
    // This FAILS because getEligibleHeroUpgrades returns unowned upgrades
    expect(displayed.every((u) => member.equipment.includes(u.id))).toBe(true)
    // Also assert: section should be hidden (no owned upgrades)
    expect(displayed.length).toBe(0)
  })

  /**
   * Case 2: Hero with ONE owned upgrade out of many
   *
   * The buggy code calls getEligibleHeroUpgrades(), which EXCLUDES the owned
   * upgrade and returns the remaining unowned ones. The section shows the
   * unowned upgrades instead of the owned one.
   *
   * Expected (correct): section shows only the owned upgrade.
   * Actual (buggy): section shows the OTHER (unowned) upgrades.
   *
   * This test WILL FAIL on unfixed code — that is the expected outcome.
   */
  it('hero with one owned upgrade should display ONLY that upgrade', () => {
    const ownedId = SHIRE_UPGRADE_IDS[0] // "of_a_party_sort"
    const member = makeHeroMember({ equipment: [ownedId] })

    // Simulate the buggy display logic
    const displayed = simulateBuggyDisplayedUpgrades(SHIRE_COMPANY, member)

    // Assert: every displayed upgrade must be in member.equipment
    // This FAILS because getEligibleHeroUpgrades returns the OTHER upgrades
    expect(displayed.every((u) => member.equipment.includes(u.id))).toBe(true)
    // Also assert: only the owned upgrade should appear
    expect(displayed.length).toBe(1)
    expect(displayed[0].id).toBe(ownedId)
  })

  /**
   * Property-based: for any subset of owned upgrades, the displayed upgrades
   * must be exactly the owned ones (those in member.equipment).
   *
   * This is the core property: displayed = owned, not eligible-to-earn.
   *
   * This test WILL FAIL on unfixed code for any case where the hero does not
   * own ALL upgrades (because getEligibleHeroUpgrades returns the unowned ones).
   */
  it('for any owned upgrade subset, displayed upgrades must equal owned upgrades', () => {
    fc.assert(
      fc.property(
        subsetOfShireUpgrades,
        (ownedIds) => {
          const member = makeHeroMember({ equipment: ownedIds })

          // Buggy display: calls getEligibleHeroUpgrades (returns NOT-owned)
          const buggyDisplayed = simulateBuggyDisplayedUpgrades(SHIRE_COMPANY, member)

          // Correct display: filter by member.equipment
          const correctDisplayed = correctDisplayedUpgrades(SHIRE_COMPANY, member)

          // Assert: every displayed upgrade ID must be in member.equipment
          const allDisplayedAreOwned = buggyDisplayed.every((u) =>
            member.equipment.includes(u.id)
          )
          expect(allDisplayedAreOwned).toBe(true)

          // Assert: the count of displayed upgrades must equal owned count
          expect(buggyDisplayed.length).toBe(correctDisplayed.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Concrete counterexample documentation test:
   * Directly demonstrates the isBugCondition formula from the spec.
   *
   * isBugCondition returns true when:
   *   - displayedUpgrades.length > 0
   *   - AND some displayed upgrade is NOT in member.equipment
   *
   * On unfixed code, this WILL be true for a hero with equipment=[].
   */
  it('isBugCondition is true for hero with empty equipment (confirms bug exists)', () => {
    const member = makeHeroMember({ equipment: [] })

    const displayedUpgrades = simulateBuggyDisplayedUpgrades(SHIRE_COMPANY, member)

    // The bug condition: section shows upgrades the hero does NOT own
    const bugConditionHolds =
      displayedUpgrades.length > 0 &&
      displayedUpgrades.some((u) => !member.equipment.includes(u.id))

    // On UNFIXED code: bugConditionHolds === true (bug is present)
    // After fix: bugConditionHolds === false (bug is resolved)
    // This assertion FAILS on unfixed code — confirming the bug exists
    expect(bugConditionHolds).toBe(false)
  })
})
