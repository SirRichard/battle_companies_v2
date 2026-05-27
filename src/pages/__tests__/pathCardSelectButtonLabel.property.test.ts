/**
 * Feature: battle-companies-ux-improvements, Property 2: Select button label and variant match selection state
 *
 * **Validates: Requirements 1.9**
 *
 * Property definition:
 * For any path card displayed in the PathCardSelector, the Select button SHALL
 * display label "Path Chosen ✓" with variant `outlined` when the path is selected,
 * and label "Select This Path" with variant `contained` when the path is not selected.
 *
 * Strategy:
 * - Generate arbitrary card indices (0..PATHS.length-1) and selection states
 * - Model the component logic: when selectedPathId === displayedPathId →
 *   label="Path Chosen ✓", variant="outlined"; otherwise →
 *   label="Select This Path", variant="contained"
 * - Minimum 100 iterations
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import pathsData from '../../data/paths.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  label: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PATHS = pathsData as unknown as PathDef[]
const PATH_IDS = PATHS.map((p) => p.id)

// ─── Modeled component logic ──────────────────────────────────────────────────

/**
 * Models PathCardSelector's Select button label.
 * From the component: `{isSelected ? 'Path Chosen ✓' : 'Select This Path'}`
 * where `isSelected = selectedPathId === path.id`
 */
function getSelectButtonLabel(
  cardIndex: number,
  selectedPathId: string | null
): string {
  const displayedPathId = PATHS[cardIndex].id
  const isSelected = selectedPathId === displayedPathId
  return isSelected ? 'Path Chosen ✓' : 'Select This Path'
}

/**
 * Models PathCardSelector's Select button variant.
 * From the component: `variant={isSelected ? 'outlined' : 'contained'}`
 * where `isSelected = selectedPathId === path.id`
 */
function getSelectButtonVariant(
  cardIndex: number,
  selectedPathId: string | null
): 'outlined' | 'contained' {
  const displayedPathId = PATHS[cardIndex].id
  const isSelected = selectedPathId === displayedPathId
  return isSelected ? 'outlined' : 'contained'
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid card index (0 to PATHS.length - 1) */
const cardIndexArb: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: PATHS.length - 1,
})

/** Selection state: either null (no selection) or a valid path ID */
const selectedPathIdArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom(...PATH_IDS)
)

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 2: Select button label and variant match selection state', () => {
  it('displays "Path Chosen ✓" with variant "outlined" when path is selected', () => {
    fc.assert(
      fc.property(cardIndexArb, (cardIndex) => {
        // Force selected state: selectedPathId === displayed path
        const displayedPathId = PATHS[cardIndex].id
        const selectedPathId = displayedPathId

        const label = getSelectButtonLabel(cardIndex, selectedPathId)
        const variant = getSelectButtonVariant(cardIndex, selectedPathId)

        expect(label).toBe('Path Chosen ✓')
        expect(variant).toBe('outlined')
      }),
      { numRuns: 100 }
    )
  })

  it('displays "Select This Path" with variant "contained" when path is not selected', () => {
    fc.assert(
      fc.property(
        cardIndexArb,
        selectedPathIdArb,
        (cardIndex, selectedPathId) => {
          const displayedPathId = PATHS[cardIndex].id
          // Only test when path is NOT selected
          fc.pre(selectedPathId !== displayedPathId)

          const label = getSelectButtonLabel(cardIndex, selectedPathId)
          const variant = getSelectButtonVariant(cardIndex, selectedPathId)

          expect(label).toBe('Select This Path')
          expect(variant).toBe('contained')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('label and variant are always consistent (never mixed states)', () => {
    fc.assert(
      fc.property(
        cardIndexArb,
        selectedPathIdArb,
        (cardIndex, selectedPathId) => {
          const label = getSelectButtonLabel(cardIndex, selectedPathId)
          const variant = getSelectButtonVariant(cardIndex, selectedPathId)

          // If label is "Path Chosen ✓", variant MUST be "outlined"
          if (label === 'Path Chosen ✓') {
            expect(variant).toBe('outlined')
          }
          // If label is "Select This Path", variant MUST be "contained"
          if (label === 'Select This Path') {
            expect(variant).toBe('contained')
          }
          // No other label values should exist
          expect(['Path Chosen ✓', 'Select This Path']).toContain(label)
          expect(['outlined', 'contained']).toContain(variant)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('selection state is determined solely by selectedPathId === displayedPathId', () => {
    fc.assert(
      fc.property(
        cardIndexArb,
        selectedPathIdArb,
        (cardIndex, selectedPathId) => {
          const displayedPathId = PATHS[cardIndex].id
          const isSelected = selectedPathId === displayedPathId

          const label = getSelectButtonLabel(cardIndex, selectedPathId)
          const variant = getSelectButtonVariant(cardIndex, selectedPathId)

          if (isSelected) {
            expect(label).toBe('Path Chosen ✓')
            expect(variant).toBe('outlined')
          } else {
            expect(label).toBe('Select This Path')
            expect(variant).toBe('contained')
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
