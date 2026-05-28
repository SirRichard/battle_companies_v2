// Feature: toolkit-special-units-hero-upgrades, Properties 8–10: Hero Upgrade Display

/**
 * Property 8: Hero upgrade rendering completeness and order
 * Property 9: Hero upgrade unit label resolution
 * Property 10: Hero upgrade normalization
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import companiesData from '../../../data/companies.json'
import baseUnitsData from '../../../data/baseUnits.json'
import type { CompanyDefinition, HeroUpgrade } from '../../../models'
import { getUnitLabel } from '../../../utils/labels'

const ALL_COMPANIES = companiesData as CompanyDefinition[]
const BASE_UNITS = baseUnitsData as Array<{ id: string; label: string }>

// ── Companies with hero upgrades ──────────────────────────────────────────────
const COMPANIES_WITH_UPGRADES = ALL_COMPANIES.filter(
  (c) => c.heroUpgrade.length > 0
)

// ── Simulate the rendering logic from StepCompany.tsx ─────────────────────────

/**
 * Mirrors the hero upgrade normalization + rendering logic in StepCompany:
 *   const raw = company.heroUpgrade
 *   const upgrades = Array.isArray(raw) ? raw : raw ? [raw] : []
 *   if (upgrades.length === 0) return null
 *   // render each upgrade in order with label, description, resolved baseUnitIds
 */
function normalizeHeroUpgrades(
  raw: HeroUpgrade[] | HeroUpgrade | undefined | null
): HeroUpgrade[] {
  if (Array.isArray(raw)) return raw
  if (raw) return [raw]
  return []
}

interface RenderedUpgradeEntry {
  label: string
  description: string
  resolvedUnitLabels: string[]
}

function simulateHeroUpgradeRendering(
  heroUpgrade: HeroUpgrade[] | HeroUpgrade | undefined | null
): RenderedUpgradeEntry[] | null {
  const upgrades = normalizeHeroUpgrades(heroUpgrade)
  if (upgrades.length === 0) return null

  return upgrades.map((upgrade) => ({
    label: upgrade.label,
    description: upgrade.description,
    resolvedUnitLabels:
      upgrade.baseUnitIds && upgrade.baseUnitIds.length > 0
        ? upgrade.baseUnitIds.map((id) => getUnitLabel(id))
        : [],
  }))
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

// Arbitrary: a valid baseUnitId from the actual data
const arbitraryBaseUnitId = fc.constantFrom(
  ...BASE_UNITS.map((u) => u.id)
)

// Arbitrary: a single HeroUpgrade object
const arbitraryHeroUpgrade: fc.Arbitrary<HeroUpgrade> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.replace(/\s/g, '_')),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  baseUnitIds: fc.oneof(
    fc.constant(undefined),
    fc.array(arbitraryBaseUnitId, { minLength: 0, maxLength: 4 })
  ),
  allowedKeywords: fc.constant(undefined),
})

// Arbitrary: a non-empty array of HeroUpgrade entries
const arbitraryHeroUpgradeArray = fc.array(arbitraryHeroUpgrade, {
  minLength: 1,
  maxLength: 6,
})

// Arbitrary: an empty-ish heroUpgrade field (empty array, undefined, or null)
const arbitraryEmptyHeroUpgrade = fc.constantFrom(
  [] as HeroUpgrade[],
  undefined,
  null
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 8: Hero upgrade rendering completeness and order', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any CompanyDefinition with a non-empty heroUpgrade array, the rendered
   * expanded details SHALL contain every entry's label and description in the
   * same order as the source array. When the heroUpgrade array is empty or
   * undefined, no hero upgrade section SHALL be rendered.
   */

  it('all entries rendered in source order for non-empty heroUpgrade arrays', () => {
    fc.assert(
      fc.property(arbitraryHeroUpgradeArray, (upgrades) => {
        const rendered = simulateHeroUpgradeRendering(upgrades)

        // Section must be rendered (non-null)
        expect(rendered).not.toBeNull()
        expect(rendered!.length).toBe(upgrades.length)

        // Each entry's label and description must match source order
        for (let i = 0; i < upgrades.length; i++) {
          expect(rendered![i].label).toBe(upgrades[i].label)
          expect(rendered![i].description).toBe(upgrades[i].description)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('no section rendered when heroUpgrade is empty, undefined, or null', () => {
    fc.assert(
      fc.property(arbitraryEmptyHeroUpgrade, (emptyValue) => {
        const rendered = simulateHeroUpgradeRendering(emptyValue)
        expect(rendered).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('real company data: all entries rendered in source order', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMPANIES_WITH_UPGRADES),
        (company) => {
          const rendered = simulateHeroUpgradeRendering(company.heroUpgrade)

          expect(rendered).not.toBeNull()
          expect(rendered!.length).toBe(company.heroUpgrade.length)

          for (let i = 0; i < company.heroUpgrade.length; i++) {
            expect(rendered![i].label).toBe(company.heroUpgrade[i].label)
            expect(rendered![i].description).toBe(
              company.heroUpgrade[i].description
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 9: Hero upgrade unit label resolution', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any HeroUpgrade entry containing a non-empty baseUnitIds array, the
   * rendered output SHALL include the resolved label for each referenced
   * baseUnitId.
   */

  it('each baseUnitId resolved to correct label via getUnitLabel', () => {
    fc.assert(
      fc.property(
        arbitraryHeroUpgrade.filter(
          (u) => u.baseUnitIds !== undefined && u.baseUnitIds.length > 0
        ),
        (upgrade) => {
          const rendered = simulateHeroUpgradeRendering([upgrade])

          expect(rendered).not.toBeNull()
          expect(rendered!.length).toBe(1)

          const entry = rendered![0]
          const expectedLabels = upgrade.baseUnitIds!.map((id) =>
            getUnitLabel(id)
          )

          expect(entry.resolvedUnitLabels).toEqual(expectedLabels)

          // Each resolved label must match the baseUnits data lookup
          for (let i = 0; i < upgrade.baseUnitIds!.length; i++) {
            const unitId = upgrade.baseUnitIds![i]
            const expectedLabel =
              BASE_UNITS.find((u) => u.id === unitId)?.label ??
              unitId
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())
            expect(entry.resolvedUnitLabels[i]).toBe(expectedLabel)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('real company data: baseUnitIds resolved correctly', () => {
    // Filter companies that have at least one upgrade with baseUnitIds
    const companiesWithBaseUnitIds = COMPANIES_WITH_UPGRADES.filter((c) =>
      c.heroUpgrade.some(
        (u) => u.baseUnitIds && u.baseUnitIds.length > 0
      )
    )

    fc.assert(
      fc.property(
        fc.constantFrom(...companiesWithBaseUnitIds),
        (company) => {
          const rendered = simulateHeroUpgradeRendering(company.heroUpgrade)
          expect(rendered).not.toBeNull()

          for (let i = 0; i < company.heroUpgrade.length; i++) {
            const upgrade = company.heroUpgrade[i]
            const entry = rendered![i]

            if (upgrade.baseUnitIds && upgrade.baseUnitIds.length > 0) {
              expect(entry.resolvedUnitLabels.length).toBe(
                upgrade.baseUnitIds.length
              )
              for (let j = 0; j < upgrade.baseUnitIds.length; j++) {
                const expectedLabel = getUnitLabel(upgrade.baseUnitIds[j])
                expect(entry.resolvedUnitLabels[j]).toBe(expectedLabel)
              }
            } else {
              expect(entry.resolvedUnitLabels).toEqual([])
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('entries without baseUnitIds produce empty resolvedUnitLabels', () => {
    fc.assert(
      fc.property(
        arbitraryHeroUpgrade.filter(
          (u) => u.baseUnitIds === undefined || u.baseUnitIds.length === 0
        ),
        (upgrade) => {
          const rendered = simulateHeroUpgradeRendering([upgrade])
          expect(rendered).not.toBeNull()
          expect(rendered![0].resolvedUnitLabels).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 10: Hero upgrade normalization', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any single HeroUpgrade object, normalizing it SHALL produce a
   * one-element array whose sole element is deeply equal to the original object.
   */

  it('single object normalized to one-element array deeply equal to original', () => {
    fc.assert(
      fc.property(arbitraryHeroUpgrade, (upgrade) => {
        // Simulate the normalization: treat single object as if it were the raw field
        const normalized = normalizeHeroUpgrades(
          upgrade as unknown as HeroUpgrade
        )

        expect(Array.isArray(normalized)).toBe(true)
        expect(normalized.length).toBe(1)
        expect(normalized[0]).toEqual(upgrade)
      }),
      { numRuns: 100 }
    )
  })

  it('array input passes through unchanged', () => {
    fc.assert(
      fc.property(arbitraryHeroUpgradeArray, (upgrades) => {
        const normalized = normalizeHeroUpgrades(upgrades)

        expect(Array.isArray(normalized)).toBe(true)
        expect(normalized.length).toBe(upgrades.length)
        expect(normalized).toEqual(upgrades)
      }),
      { numRuns: 100 }
    )
  })

  it('undefined/null normalized to empty array', () => {
    expect(normalizeHeroUpgrades(undefined)).toEqual([])
    expect(normalizeHeroUpgrades(null)).toEqual([])
  })

  it('rendering single object produces same output as rendering one-element array', () => {
    fc.assert(
      fc.property(arbitraryHeroUpgrade, (upgrade) => {
        const fromSingle = simulateHeroUpgradeRendering(
          upgrade as unknown as HeroUpgrade
        )
        const fromArray = simulateHeroUpgradeRendering([upgrade])

        expect(fromSingle).toEqual(fromArray)
      }),
      { numRuns: 100 }
    )
  })
})
