// Feature: battle-companies-fixes-and-features, Property 13: Variant roster is used when variantId matches a non-default variant

/**
 * Property 13: Variant roster is used when variantId matches a non-default variant
 * Validates: Requirements 31.2, 31.5
 *
 * For The Last Alliance company definition:
 * - When variantId === 'last_alliance_numenorean', the created company's members
 *   SHALL be derived from the Númenórean startingRoster (6 Warriors of Númenór with shield),
 *   not the default roster (Rivendell Warriors + Warriors of Númenór).
 * - When variantId === 'last_alliance_standard' or null, the default roster SHALL be used.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createCompany, generateTempMemberIds } from '../companyFactory'
import type { CompanyDefinition, WizardState } from '../../../models'
import companiesData from '../../../data/companies.json'

// ── Find The Last Alliance company definition ─────────────────────────────────

const lastAllianceDef = (companiesData as CompanyDefinition[]).find(
  (c) => c.id === 'the_last_alliance'
)!

if (!lastAllianceDef) {
  throw new Error('The Last Alliance company definition not found in companies.json')
}

// ── Variant IDs ───────────────────────────────────────────────────────────────

const defaultVariant = lastAllianceDef.variants?.find((v) => v.isDefault)
const numenoreanVariant = lastAllianceDef.variants?.find(
  (v) => v.id === 'last_alliance_numenorean'
)

if (!defaultVariant || !numenoreanVariant) {
  throw new Error('Expected both default and numenorean variants in The Last Alliance definition')
}

const defaultVariantId = defaultVariant.id // 'last_alliance_standard'
const numenoreanVariantId = numenoreanVariant.id // 'last_alliance_numenorean'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal WizardState for The Last Alliance with the given variantId.
 * Assigns the first member as leader and the next two as sergeants.
 */
function buildWizardState(
  variantId: string | null,
  rosterOverride?: CompanyDefinition['startingRoster']
): WizardState {
  const tempIds = generateTempMemberIds(lastAllianceDef, rosterOverride)

  const leaderId = tempIds[0] ?? null
  const sergeantIds = tempIds.slice(1, 3)

  const memberNames: Record<string, string> = {}
  tempIds.forEach((id, i) => {
    memberNames[id] = `Member ${i + 1}`
  })

  return {
    step: 8,
    alignment: 'good',
    factionId: 'gondor',
    companyTypeId: 'the_last_alliance',
    variantId,
    companyName: 'Test Alliance',
    memberNames,
    leaderId,
    sergeantIds,
    heroPaths: {},
    heroSpellChoices: {},
    goldPurchases: {},
  }
}

/**
 * Returns the total member count expected from a given roster.
 */
function rosterTotalCount(roster: CompanyDefinition['startingRoster']): number {
  return roster.reduce((sum, entry) => sum + entry.count, 0)
}

/**
 * Returns the set of unique baseUnitIds from a roster.
 */
function rosterBaseUnitIds(roster: CompanyDefinition['startingRoster']): Set<string> {
  return new Set(roster.map((entry) => entry.baseUnitId))
}

// ── Computed expected values ──────────────────────────────────────────────────

const defaultRoster = lastAllianceDef.startingRoster
const numenoreanRoster = numenoreanVariant.startingRoster!

const defaultTotalCount = rosterTotalCount(defaultRoster)
const numenoreanTotalCount = rosterTotalCount(numenoreanRoster)
const defaultBaseUnitIds = rosterBaseUnitIds(defaultRoster)
const numenoreanBaseUnitIds = rosterBaseUnitIds(numenoreanRoster)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 13: Variant roster is used when variantId matches a non-default variant', () => {
  it('uses the Númenórean roster when variantId is last_alliance_numenorean', () => {
    const wizardState = buildWizardState(numenoreanVariantId, numenoreanRoster)
    const company = createCompany(wizardState, lastAllianceDef, {}, {}, numenoreanVariantId)

    // Member count must match the Númenórean roster
    expect(company.members.length).toBe(numenoreanTotalCount)

    // All members must have baseUnitIds from the Númenórean roster
    for (const member of company.members) {
      expect(numenoreanBaseUnitIds.has(member.baseUnitId)).toBe(true)
    }

    // No members should have baseUnitIds exclusive to the default roster
    const defaultOnlyIds = new Set(
      [...defaultBaseUnitIds].filter((id) => !numenoreanBaseUnitIds.has(id))
    )
    for (const member of company.members) {
      expect(defaultOnlyIds.has(member.baseUnitId)).toBe(false)
    }
  })

  it('uses the default roster when variantId is last_alliance_standard (the default variant)', () => {
    const wizardState = buildWizardState(defaultVariantId)
    const company = createCompany(wizardState, lastAllianceDef, {}, {}, defaultVariantId)

    // Member count must match the default roster
    expect(company.members.length).toBe(defaultTotalCount)

    // All members must have baseUnitIds from the default roster
    for (const member of company.members) {
      expect(defaultBaseUnitIds.has(member.baseUnitId)).toBe(true)
    }
  })

  it('uses the default roster when variantId is null', () => {
    const wizardState = buildWizardState(null)
    const company = createCompany(wizardState, lastAllianceDef, {}, {}, null)

    // Member count must match the default roster
    expect(company.members.length).toBe(defaultTotalCount)

    // All members must have baseUnitIds from the default roster
    for (const member of company.members) {
      expect(defaultBaseUnitIds.has(member.baseUnitId)).toBe(true)
    }
  })

  it('property: for any variantId from the known set, the correct roster is used', () => {
    // All variant IDs including null
    const allVariantIds: Array<string | null> = [
      null,
      defaultVariantId,
      numenoreanVariantId,
    ]

    fc.assert(
      fc.property(
        fc.constantFrom(...allVariantIds),
        (variantId) => {
          const isNumenorean = variantId === numenoreanVariantId
          const expectedRoster = isNumenorean ? numenoreanRoster : defaultRoster
          const expectedCount = rosterTotalCount(expectedRoster)
          const expectedIds = rosterBaseUnitIds(expectedRoster)

          const rosterForWizard = isNumenorean ? numenoreanRoster : undefined
          const wizardState = buildWizardState(variantId, rosterForWizard)
          const company = createCompany(wizardState, lastAllianceDef, {}, {}, variantId)

          // Member count matches expected roster
          expect(company.members.length).toBe(expectedCount)

          // All member baseUnitIds come from the expected roster
          for (const member of company.members) {
            expect(expectedIds.has(member.baseUnitId)).toBe(true)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('property: Númenórean variant always produces only warrior_of_numenor members', () => {
    fc.assert(
      fc.property(
        fc.constant(numenoreanVariantId),
        (variantId) => {
          const wizardState = buildWizardState(variantId, numenoreanRoster)
          const company = createCompany(wizardState, lastAllianceDef, {}, {}, variantId)

          // All members must be warrior_of_numenor (the only unit in the Númenórean roster)
          for (const member of company.members) {
            expect(member.baseUnitId).toBe('warrior_of_numenor')
          }

          // Exactly 6 members (as defined in the Númenórean startingRoster)
          expect(company.members.length).toBe(6)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('property: default roster always produces a mix of rivendell_warrior and warrior_of_numenor', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, defaultVariantId),
        (variantId) => {
          const wizardState = buildWizardState(variantId)
          const company = createCompany(wizardState, lastAllianceDef, {}, {}, variantId)

          const baseUnitIds = company.members.map((m) => m.baseUnitId)

          // Default roster has both rivendell_warrior and warrior_of_numenor
          expect(baseUnitIds).toContain('rivendell_warrior')
          expect(baseUnitIds).toContain('warrior_of_numenor')

          // Total count matches default roster
          expect(company.members.length).toBe(defaultTotalCount)
        }
      ),
      { numRuns: 30 }
    )
  })
})
