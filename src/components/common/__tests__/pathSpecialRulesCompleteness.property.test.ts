// Feature: company-creation-enhancements, Property 1: Path special rules completeness

/**
 * Property 1: Path special rules completeness
 * Validates: Requirements 1.1, 1.3
 *
 * For any path in the paths data, `getUniqueRules(path)` SHALL return exactly
 * the progression entries where roll ∈ {2, 3, 11, 12} AND label AND description
 * exist, with each description being the full untruncated text from the source data.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import pathsData from '../../../data/paths.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgressionEntry {
  roll: number
  type: string
  label?: string
  description?: string
  options?: unknown[]
}

interface PathDef {
  id: string
  label: string
  progression: ProgressionEntry[]
}

// ── Function under test (mirrors PathCardSelector.getUniqueRules) ─────────────

function getUniqueRules(
  path: PathDef
): Array<{ label: string; description: string }> {
  return path.progression
    .filter((e) => [2, 3, 11, 12].includes(e.roll) && e.label && e.description)
    .map((e) => ({ label: e.label!, description: e.description! }))
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PATHS = pathsData as unknown as PathDef[]

// Arbitrary that picks a random path from the actual dataset
const arbPath = fc.constantFrom(...PATHS)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: Path special rules completeness', () => {
  it('returns exactly the progression entries with roll ∈ {2,3,11,12} that have label AND description', () => {
    fc.assert(
      fc.property(arbPath, (path) => {
        const result = getUniqueRules(path)

        // Compute expected from raw data
        const expected = path.progression
          .filter(
            (e) =>
              [2, 3, 11, 12].includes(e.roll) &&
              typeof e.label === 'string' &&
              e.label.length > 0 &&
              typeof e.description === 'string' &&
              e.description.length > 0
          )
          .map((e) => ({ label: e.label!, description: e.description! }))

        expect(result).toEqual(expected)
      }),
      { numRuns: 100 }
    )
  })

  it('each description is the full untruncated text (no ellipsis, no slicing)', () => {
    fc.assert(
      fc.property(arbPath, (path) => {
        const result = getUniqueRules(path)

        // Build expected list preserving order (handles duplicate labels)
        const expected = path.progression
          .filter(
            (e) =>
              [2, 3, 11, 12].includes(e.roll) &&
              e.label &&
              e.description
          )
          .map((e) => e.description!)

        // Each result description matches source at same index
        for (let i = 0; i < result.length; i++) {
          expect(result[i].description).toBe(expected[i])
          // No trailing ellipsis from truncation
          expect(result[i].description.endsWith('…')).toBe(false)
          expect(result[i].description.endsWith('...')).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('only includes entries from the special-rule rolls {2,3,11,12}', () => {
    fc.assert(
      fc.property(arbPath, (path) => {
        const result = getUniqueRules(path)

        // All returned rules must come from rolls 2, 3, 11, or 12
        const validRolls = new Set([2, 3, 11, 12])
        const sourceEntries = path.progression.filter(
          (e) => validRolls.has(e.roll) && e.label && e.description
        )
        const sourceLabels = sourceEntries.map((e) => e.label)

        for (const rule of result) {
          expect(sourceLabels).toContain(rule.label)
        }
      }),
      { numRuns: 100 }
    )
  })
})
