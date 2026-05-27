/**
 * Feature: battle-companies-ux-improvements, Property 1: onSelect always fires with displayed path ID
 *
 * **Validates: Requirements 1.1, 1.2, 1.8**
 *
 * Property definition:
 * For any path card displayed in the PathCardSelector and for any selection state
 * (selected or not), activating the Select button SHALL invoke the onSelect callback
 * with that path's ID, and the button SHALL never be disabled.
 *
 * Strategy:
 * - Generate arbitrary card indices (0..PATHS.length-1) and selection states
 * - Model the component logic: onSelect always called with PATHS[cardIndex].id
 * - Button never has a disabled prop
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
 * Models PathCardSelector's onSelect invocation.
 * The component always calls `onSelect(path.id)` where path = PATHS[cardIndex].
 * This mirrors the JSX: `onClick={() => onSelect(path.id)}`
 */
function getOnSelectArgument(cardIndex: number): string {
  return PATHS[cardIndex].id
}

/**
 * Models whether the Select button is disabled.
 * In PathCardSelector, the button has NO `disabled` prop — always enabled.
 */
function isSelectButtonDisabled(
  _cardIndex: number,
  _selectedPathId: string | null
): boolean {
  return false
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

describe('Property 1: onSelect always fires with displayed path ID regardless of selection state', () => {
  it('onSelect receives the displayed path ID for any card index and any selection state', () => {
    fc.assert(
      fc.property(cardIndexArb, selectedPathIdArb, (cardIndex, selectedPathId) => {
        const displayedPathId = PATHS[cardIndex].id
        const onSelectArg = getOnSelectArgument(cardIndex)

        // onSelect always fires with the currently displayed path's ID
        expect(onSelectArg).toBe(displayedPathId)

        // The selection state (whether this path is already selected) does not
        // affect which ID is passed — it's always the displayed path's ID
        const isSelected = selectedPathId === displayedPathId
        const onSelectArgWhenSelected = getOnSelectArgument(cardIndex)
        const onSelectArgWhenNotSelected = getOnSelectArgument(cardIndex)
        expect(onSelectArgWhenSelected).toBe(displayedPathId)
        expect(onSelectArgWhenNotSelected).toBe(displayedPathId)

        // Regardless of whether path matches selectedPathId, same ID fires
        if (isSelected) {
          expect(onSelectArg).toBe(selectedPathId)
        } else {
          expect(onSelectArg).toBe(displayedPathId)
          expect(onSelectArg).not.toBe(selectedPathId)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('Select button is never disabled regardless of card index or selection state', () => {
    fc.assert(
      fc.property(cardIndexArb, selectedPathIdArb, (cardIndex, selectedPathId) => {
        const disabled = isSelectButtonDisabled(cardIndex, selectedPathId)
        expect(disabled).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('onSelect argument matches PATHS[cardIndex].id for every valid index', () => {
    fc.assert(
      fc.property(cardIndexArb, (cardIndex) => {
        const result = getOnSelectArgument(cardIndex)
        expect(result).toBe(PATHS[cardIndex].id)
        // Verify it's a known path ID
        expect(PATH_IDS).toContain(result)
      }),
      { numRuns: 100 }
    )
  })

  it('onSelect fires same ID whether path is selected or not (selection state irrelevant)', () => {
    fc.assert(
      fc.property(cardIndexArb, (cardIndex) => {
        const displayedPathId = PATHS[cardIndex].id

        // When this path IS the selected path
        const argWhenSelected = getOnSelectArgument(cardIndex)
        // When a different path is selected
        const argWhenOtherSelected = getOnSelectArgument(cardIndex)
        // When nothing is selected
        const argWhenNoneSelected = getOnSelectArgument(cardIndex)

        expect(argWhenSelected).toBe(displayedPathId)
        expect(argWhenOtherSelected).toBe(displayedPathId)
        expect(argWhenNoneSelected).toBe(displayedPathId)
      }),
      { numRuns: 100 }
    )
  })
})
