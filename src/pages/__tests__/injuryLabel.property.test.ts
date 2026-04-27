// Feature: battle-companies-fixes-and-features, Property 3: Injury outcome label is always human-readable

/**
 * Property 3: Injury outcome label is always human-readable
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * For any known injury outcome type, `injuryLabel` must return a string that:
 *   1. Contains no underscores
 *   2. Begins with an uppercase letter
 *
 * The fallback path (unknown types with underscores) must also satisfy both
 * properties.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Implementation under test (copied from HistoryMatchCard in CompanyDetailsPage.tsx) ──

const INJURY_OUTCOME_LABELS: Record<string, string> = {
  arm_wound: 'Arm Wound',
  leg_wound: 'Leg Wound',
  broken_honour: 'Broken Honour',
  missing_next_game: 'Missing Next Game',
  dead: 'Dead',
  full_recovery: 'Full Recovery',
  protection_by_valar: 'Protection by the Valar',
  wounds_of_a_hero: 'Wounds of a Hero',
  warrior_dead: 'Dead',
  warrior_injured: 'Injured',
  warrior_full_recovery: 'Full Recovery',
  warrior_lesson_learned: 'Lesson Learned',
}

const injuryLabel = (raw: string): string =>
  INJURY_OUTCOME_LABELS[raw] ??
  raw.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

// ── Known outcome types ───────────────────────────────────────────────────────

const KNOWN_OUTCOME_TYPES = [
  'arm_wound',
  'leg_wound',
  'broken_honour',
  'missing_next_game',
  'dead',
  'full_recovery',
  'protection_by_valar',
  'wounds_of_a_hero',
  'warrior_dead',
  'warrior_injured',
  'warrior_full_recovery',
  'warrior_lesson_learned',
] as const

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 3: Injury outcome label is always human-readable', () => {
  it('known outcome types produce labels with no underscores and an uppercase first letter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_OUTCOME_TYPES),
        (outcomeType) => {
          const label = injuryLabel(outcomeType)

          // No underscores
          expect(label).not.toContain('_')

          // Starts with an uppercase letter
          expect(label[0]).toMatch(/[A-Z]/)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('fallback for unknown types with underscores also produces no underscores and an uppercase first letter', () => {
    // Generate arbitrary strings that contain at least one underscore and are
    // not in the known set, to exercise the fallback replace path.
    const unknownWithUnderscoreArb = fc
      .tuple(
        fc.stringMatching(/^[a-z]+$/),
        fc.stringMatching(/^[a-z]+$/),
      )
      .map(([a, b]) => `${a}_${b}`)
      .filter((s) => !(s in INJURY_OUTCOME_LABELS))

    fc.assert(
      fc.property(unknownWithUnderscoreArb, (outcomeType) => {
        const label = injuryLabel(outcomeType)

        // No underscores
        expect(label).not.toContain('_')

        // Starts with an uppercase letter
        expect(label[0]).toMatch(/[A-Z]/)
      }),
      { numRuns: 200 }
    )
  })
})
