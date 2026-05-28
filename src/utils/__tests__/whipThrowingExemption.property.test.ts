// Feature: company-special-rules-enforcement, Property 6: Whip Throwing Exemption

/**
 * Property 6: Whip Throwing Exemption
 * Validates: Requirements 4.1
 *
 * For any member in a company with the `whips` rule whose only throwing-category
 * equipment is a whip, that member SHALL NOT be counted toward the throwing weapon
 * total. Members with throwing equipment other than (or in addition to) a whip
 * SHALL still be counted.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  countThrowingMembers,
  getThrowingExemptions,
} from '../limitCheckers'
import type { LimitCheckContext } from '../limitCheckers'
import type { CompanyDefinition } from '../../models'
import wargearData from '../../data/wargear.json'

// ── Data setup ────────────────────────────────────────────────────────────────

interface WargearEntry {
  id: string
  category: string
}

const WARGEAR = wargearData as WargearEntry[]

const THROWING_IDS = WARGEAR.filter((w) => w.category === 'throwing').map((w) => w.id)
const NON_THROWING_IDS = WARGEAR.filter((w) => w.category !== 'throwing').map((w) => w.id)
const NON_WHIP_THROWING_IDS = THROWING_IDS.filter((id) => id !== 'whip')

// Build wargear category map for context
const WARGEAR_CATEGORY_MAP: Record<string, string> = WARGEAR.reduce<Record<string, string>>(
  (acc, w) => {
    acc[w.id] = w.category
    return acc
  },
  {}
)

// ── Company definition with whips rule ────────────────────────────────────────

const WHIPS_COMPANY_DEF = {
  id: 'sharkeys_rogues',
  label: "Sharkey's Rogues",
  companySpecialRules: [
    {
      id: 'whips',
      title: 'Whips',
      description: 'Whips do not count against the Throwing Weapon Wargear Limit.',
      throwingExemptions: ['whip'],
    },
  ],
} as unknown as CompanyDefinition

const NO_WHIPS_COMPANY_DEF = {
  id: 'some_other_company',
  label: 'Other Company',
  companySpecialRules: [],
} as unknown as CompanyDefinition

// ── Generators ────────────────────────────────────────────────────────────────

// Arbitrary base unit ID (doesn't matter for throwing logic, just needs to exist)
const arbBaseUnitId = fc.constantFrom(
  'ruffian',
  'hill_tribesman',
  'wild_man',
  'orc_warrior',
  'uruk_hai'
)

// Non-throwing equipment filler
const arbNonThrowingEquipment = fc.array(fc.constantFrom(...NON_THROWING_IDS), {
  minLength: 0,
  maxLength: 3,
})

// Non-whip throwing equipment (throwing_weapons, throwing_spears, elven_throwing_weapons)
const arbNonWhipThrowingItem = fc.constantFrom(...NON_WHIP_THROWING_IDS)

// A member whose only throwing equipment is a whip (should be exempt)
const arbWhipOnlyMember = fc.tuple(arbBaseUnitId, arbNonThrowingEquipment).map(
  ([baseUnitId, nonThrowing]) => ({
    baseUnitId,
    equipment: ['whip', ...nonThrowing],
  })
)

// A member with non-whip throwing equipment (should be counted)
const arbNonWhipThrowingMember = fc
  .tuple(arbBaseUnitId, arbNonWhipThrowingItem, arbNonThrowingEquipment)
  .map(([baseUnitId, throwingItem, nonThrowing]) => ({
    baseUnitId,
    equipment: [throwingItem, ...nonThrowing],
  }))

// A member with both whip AND other throwing equipment (should be counted)
const arbMixedThrowingMember = fc
  .tuple(arbBaseUnitId, arbNonWhipThrowingItem, arbNonThrowingEquipment)
  .map(([baseUnitId, throwingItem, nonThrowing]) => ({
    baseUnitId,
    equipment: ['whip', throwingItem, ...nonThrowing],
  }))

// A member with no throwing equipment at all
const arbNoThrowingMember = fc.tuple(arbBaseUnitId, arbNonThrowingEquipment).map(
  ([baseUnitId, nonThrowing]) => ({
    baseUnitId,
    equipment: nonThrowing,
  })
)

// ── Helper: build context ─────────────────────────────────────────────────────

function buildCtx(
  members: Array<{ baseUnitId: string; equipment: string[] }>,
  companyDef: CompanyDefinition
): LimitCheckContext {
  return {
    members,
    companyDef,
    baseUnitsMap: {
      ruffian: { baseWargear: [], keywords: [] },
      hill_tribesman: { baseWargear: [], keywords: [] },
      wild_man: { baseWargear: [], keywords: [] },
      orc_warrior: { baseWargear: [], keywords: [] },
      uruk_hai: { baseWargear: [], keywords: [] },
    },
    wargearCategoryMap: WARGEAR_CATEGORY_MAP,
  }
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: Whip Throwing Exemption', () => {
  it('members whose only throwing equipment is a whip are NOT counted in whips company', () => {
    fc.assert(
      fc.property(
        fc.array(arbWhipOnlyMember, { minLength: 1, maxLength: 8 }),
        fc.array(arbNoThrowingMember, { minLength: 0, maxLength: 4 }),
        (whipMembers, noThrowingMembers) => {
          const allMembers = [...whipMembers, ...noThrowingMembers]
          const ctx = buildCtx(allMembers, WHIPS_COMPANY_DEF)

          const count = countThrowingMembers(ctx)
          // Whip-only members should be exempt, no-throwing members don't count
          expect(count).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('members with non-whip throwing equipment ARE counted in whips company', () => {
    fc.assert(
      fc.property(
        fc.array(arbNonWhipThrowingMember, { minLength: 1, maxLength: 6 }),
        fc.array(arbWhipOnlyMember, { minLength: 0, maxLength: 4 }),
        (throwingMembers, whipMembers) => {
          const allMembers = [...throwingMembers, ...whipMembers]
          const ctx = buildCtx(allMembers, WHIPS_COMPANY_DEF)

          const count = countThrowingMembers(ctx)
          // Only non-whip throwing members should be counted
          expect(count).toBe(throwingMembers.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('members with whip AND other throwing equipment ARE counted', () => {
    fc.assert(
      fc.property(
        fc.array(arbMixedThrowingMember, { minLength: 1, maxLength: 6 }),
        fc.array(arbWhipOnlyMember, { minLength: 0, maxLength: 3 }),
        (mixedMembers, whipOnlyMembers) => {
          const allMembers = [...mixedMembers, ...whipOnlyMembers]
          const ctx = buildCtx(allMembers, WHIPS_COMPANY_DEF)

          const count = countThrowingMembers(ctx)
          // Mixed members count, whip-only members don't
          expect(count).toBe(mixedMembers.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('without whips rule, whip-equipped members ARE counted toward throwing total', () => {
    fc.assert(
      fc.property(
        fc.array(arbWhipOnlyMember, { minLength: 1, maxLength: 6 }),
        (whipMembers) => {
          const ctx = buildCtx(whipMembers, NO_WHIPS_COMPANY_DEF)

          const count = countThrowingMembers(ctx)
          // Without the whips rule, whip is just a normal throwing weapon
          expect(count).toBe(whipMembers.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('getThrowingExemptions returns whip for company with whips rule', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const exemptions = getThrowingExemptions(WHIPS_COMPANY_DEF)
        expect(exemptions).toContain('whip')
      }),
      { numRuns: 100 }
    )
  })

  it('getThrowingExemptions returns empty for company without whips rule', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const exemptions = getThrowingExemptions(NO_WHIPS_COMPANY_DEF)
        expect(exemptions).toEqual([])
      }),
      { numRuns: 100 }
    )
  })
})
