/**
 * Hero Rating — concrete point value tests
 *
 * These tests pin the exact point values produced by calcMemberRating for
 * specific hero configurations, making regressions immediately visible.
 *
 * Breakdown formula (SRS §4.8.1):
 *   rating = baseCost
 *           + equipmentCost   (free wargear uses warrior cost rating[0];
 *                              armoury purchases use hero cost rating[1] when A+W >= 3)
 *           + (might + will + fate) * 5
 *           + statIncreaseCost  (only increases above average profile threshold)
 *           + specialRuleCost   (min(minorRules*5, 10) + majorRules*5)
 *
 * Key data facts used below:
 *   ranger_of_the_north  pointsCost = 25,  baseEquipment = ["bow"]
 *   bow                  rating = [1, 5]   (warrior cost = 1, hero cost = 5)
 *   armour               rating = [2, 5]   (warrior cost = 2, hero cost = 5)
 *   heroStats factory default: { might: 1, will: 1, fate: 1 }  → 15 pts
 *
 * NOTE: baseEquipment items are in the freeWargear set and always use the
 * warrior cost (rating[0]), but they are only charged if they appear in
 * member.equipment.  The Shire starting roster does NOT include equipment on
 * the leader entry, so the Ranger starts with equipment = [].
 * The Helm's Deep roster DOES include equipment: ["armour"] on the leader.
 */

import { describe, it, expect } from 'vitest'
import { calcMemberRating } from '../rating'
import type { Member } from '../../models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRangerLeader(equipment: string[] = []): Member {
  return {
    id: 'test-ranger',
    name: 'Aragorn',
    baseUnitId: 'ranger_of_the_north',
    role: 'leader',
    equipment,
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    heroStats: { might: 1, will: 1, fate: 1 },
    statIncreases: {},
    statDecreases: {},
  }
}

// ── Concrete point value tests ────────────────────────────────────────────────

describe('Hero rating — Ranger of the North', () => {
  /**
   * Shire starting leader: no equipment in member.equipment
   *
   * Breakdown:
   *   25 (base)
   * +  0 (equipment = [])
   * + 15 (M1 + W1 + F1 × 5 each)
   * ─────
   *   40 pts
   *
   * This is the value currently shown in the UI for a brand-new Shire company.
   */
  it('Shire leader (no equipment) costs 40 pts', () => {
    const member = makeRangerLeader([])
    expect(calcMemberRating(member, undefined)).toBe(40)
  })

  /**
   * Helm's Deep starting leader: equipment = ["armour"]
   *
   * "armour" is in the unit's equipmentOptions, so it is in freeWargear and
   * always uses the warrior cost: armour rating[0] = 2.
   *
   * Breakdown:
   *   25 (base)
   * +  2 (armour at warrior cost)
   * + 15 (M1 + W1 + F1 × 5 each)
   * ─────
   *   42 pts
   */
  it("Helm's Deep leader (armour) costs 42 pts", () => {
    const member = makeRangerLeader(['armour'])
    expect(calcMemberRating(member, undefined)).toBe(42)
  })

  /**
   * Ranger with a bow (baseEquipment item, warrior cost applies)
   *
   * "bow" is in baseEquipment, so freeWargear → warrior cost: bow rating[0] = 1.
   *
   * Breakdown:
   *   25 (base)
   * +  1 (bow at warrior cost)
   * + 15 (M1 + W1 + F1 × 5 each)
   * ─────
   *   41 pts
   */
  it('Ranger with bow (baseEquipment) costs 41 pts', () => {
    const member = makeRangerLeader(['bow'])
    expect(calcMemberRating(member, undefined)).toBe(41)
  })

  /**
   * Ranger with a spear (equipmentOptions item, warrior cost applies)
   *
   * "spear" is in equipmentOptions, so freeWargear → warrior cost: spear rating[0] = 1.
   *
   * Breakdown:
   *   25 (base)
   * +  1 (spear at warrior cost)
   * + 15 (M1 + W1 + F1 × 5 each)
   * ─────
   *   41 pts
   */
  it('Ranger with spear (equipmentOptions) costs 41 pts', () => {
    const member = makeRangerLeader(['spear'])
    expect(calcMemberRating(member, undefined)).toBe(41)
  })

  /**
   * M/W/F contribution is exactly (might + will + fate) * 5
   *
   * A Ranger with M3/W3/F2 (as per the actual game profile) would cost:
   *   25 + 0 + (3+3+2)*5 = 25 + 40 = 65 pts
   *
   * This test documents that the formula charges 5 pts per point of M/W/F
   * regardless of what the base unit's profile already includes.
   */
  it('M/W/F contribution is (might + will + fate) * 5', () => {
    const base = makeRangerLeader([])

    const m1w1f1 = { ...base, heroStats: { might: 1, will: 1, fate: 1 } }
    const m3w3f2 = { ...base, heroStats: { might: 3, will: 3, fate: 2 } }
    const m0w0f0 = { ...base, heroStats: { might: 0, will: 0, fate: 0 } }

    // 25 + (1+1+1)*5 = 40
    expect(calcMemberRating(m1w1f1, undefined)).toBe(40)
    // 25 + (3+3+2)*5 = 65
    expect(calcMemberRating(m3w3f2, undefined)).toBe(65)
    // 25 + 0 = 25
    expect(calcMemberRating(m0w0f0, undefined)).toBe(25)
  })

  /**
   * Stat increases above the average profile threshold add 5 pts each.
   *
   * Average profile: Fight 4, Strength 3, Defence 3, Attacks 1, Wounds 1.
   * Ranger of the North base Fight is unknown (baseStats = undefined → 0),
   * so the effective base is max(0, 4) = 4.
   * A +1 Fight increase takes Fight from 0 to 1, which is still below 4 → 0 pts.
   * A +5 Fight increase takes Fight from 0 to 5, which is 1 above threshold → 5 pts.
   */
  it('stat increases below average profile threshold add 0 pts', () => {
    const member = {
      ...makeRangerLeader([]),
      statIncreases: { fight: 1 }, // 0 + 1 = 1, still below threshold of 4
    }
    expect(calcMemberRating(member, undefined)).toBe(40) // no change
  })

  it('stat increases above average profile threshold add 5 pts each', () => {
    const member = {
      ...makeRangerLeader([]),
      statIncreases: { fight: 5 }, // 0 + 5 = 5, one above threshold of 4 → +5 pts
    }
    expect(calcMemberRating(member, undefined)).toBe(45)
  })
})
