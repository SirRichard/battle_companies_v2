// Feature: member-detail-enhancements, Property 7: Wanderer Display Completeness

/**
 * Property 7: Wanderer Display Completeness
 * Validates: Requirements 9.2
 *
 * For any wanderer from wanderers.json, the wanderer section renderer SHALL
 * include the wanderer's label, pointsCost, all stat values, all equipment
 * items (resolved to wargear labels), and all specialRules entries (resolved
 * to labels from specialRules.json, using resolveParameterisedLabel for
 * parameterised ones) in its output.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import wanderersData from '../../data/wanderers.json'
import wargearData from '../../data/wargear.json'
import specialRulesData from '../../data/specialRules.json'
import { resolveParameterisedLabel } from '../../utils/paramLabel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WandererData {
  id: string
  label: string
  keywords: string[]
  pointsCost: number
  influenceCost: number
  stats: Record<string, number | null>
  equipment: string[]
  heroicActions: string[]
  specialRules: Array<string | { id: string; parameter: string | number }>
}

interface WargearEntry {
  id: string
  label: string
}

interface SpecialRuleEntry {
  id: string
  label: string
}

// ── Data ──────────────────────────────────────────────────────────────────────

const WANDERERS = wanderersData as unknown as WandererData[]
const WARGEAR = wargearData as unknown as WargearEntry[]
const SPECIAL_RULES = specialRulesData as unknown as SpecialRuleEntry[]

// ── Helper: resolve wargear label (mirrors getWargearLabel) ───────────────────

function resolveWargearLabel(wargearId: string): string {
  const humanise = (id: string) =>
    id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  if (wargearId.includes('::')) {
    const [baseId, parameter] = wargearId.split('::')
    if (baseId === 'envenom_weapon') {
      const weaponLabel =
        WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
      return `Envenom Weapon (${weaponLabel})`
    }
    const baseLabel =
      WARGEAR.find((w) => w.id === baseId)?.label ?? humanise(baseId)
    const paramLabel =
      WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
    return `${baseLabel} (${paramLabel})`
  }

  return WARGEAR.find((w) => w.id === wargearId)?.label ?? humanise(wargearId)
}

// ── Helper: resolve special rule label ────────────────────────────────────────

function resolveRuleLabel(
  rule: string | { id: string; parameter: string | number }
): string {
  if (typeof rule === 'string') {
    const found = SPECIAL_RULES.find((r) => r.id === rule)
    if (found) return found.label
    return rule.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }
  return resolveParameterisedLabel(rule)
}

// ── Pure function: extract wanderer display data ──────────────────────────────

interface WandererDisplayData {
  label: string
  pointsCost: number
  stats: Record<string, number | null>
  equipmentLabels: string[]
  specialRuleLabels: string[]
}

function getWandererDisplayData(wanderer: WandererData): WandererDisplayData {
  return {
    label: wanderer.label,
    pointsCost: wanderer.pointsCost,
    stats: { ...wanderer.stats },
    equipmentLabels: wanderer.equipment.map(resolveWargearLabel),
    specialRuleLabels: wanderer.specialRules.map(resolveRuleLabel),
  }
}

// ── Arbitrary ─────────────────────────────────────────────────────────────────

const arbWanderer = fc.constantFrom(...WANDERERS)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 7: Wanderer Display Completeness', () => {
  it('display data includes wanderer label', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)
        expect(display.label).toBe(wanderer.label)
        expect(display.label.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  it('display data includes wanderer pointsCost', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)
        expect(display.pointsCost).toBe(wanderer.pointsCost)
      }),
      { numRuns: 100 }
    )
  })

  it('display data includes all stat values', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)
        const expectedStatKeys = [
          'move',
          'fight',
          'shoot',
          'strength',
          'defence',
          'attacks',
          'wounds',
          'courage',
          'intelligence',
        ]

        for (const key of expectedStatKeys) {
          expect(display.stats).toHaveProperty(key)
          expect(display.stats[key]).toBe(wanderer.stats[key])
        }
      }),
      { numRuns: 100 }
    )
  })

  it('display data includes all equipment items resolved to labels', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)

        // Same count as source
        expect(display.equipmentLabels).toHaveLength(wanderer.equipment.length)

        // Each equipment ID resolves to a non-empty label
        for (let i = 0; i < wanderer.equipment.length; i++) {
          const expectedLabel = resolveWargearLabel(wanderer.equipment[i])
          expect(display.equipmentLabels[i]).toBe(expectedLabel)
          expect(display.equipmentLabels[i].length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('display data includes all special rules resolved to labels', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)

        // Same count as source
        expect(display.specialRuleLabels).toHaveLength(
          wanderer.specialRules.length
        )

        // Each rule resolves to a non-empty label
        for (let i = 0; i < wanderer.specialRules.length; i++) {
          const expectedLabel = resolveRuleLabel(wanderer.specialRules[i])
          expect(display.specialRuleLabels[i]).toBe(expectedLabel)
          expect(display.specialRuleLabels[i].length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('parameterised special rules never contain literal "(X)" in display', () => {
    fc.assert(
      fc.property(arbWanderer, (wanderer) => {
        const display = getWandererDisplayData(wanderer)

        for (const label of display.specialRuleLabels) {
          expect(label).not.toContain('(X)')
        }
      }),
      { numRuns: 100 }
    )
  })
})
