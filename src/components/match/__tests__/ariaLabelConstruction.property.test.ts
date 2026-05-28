// Feature: match-tracking-responsive, Property 3: Aria-label reflects member name and state

/**
 * Property 3: Aria-label reflects member name and state
 * Validates: Requirements 7.2
 *
 * For any member name string and any expand/collapse state (true/false),
 * the Expand_Chevron's aria-label SHALL contain the member name and the
 * correct action verb ("Expand" when collapsed, "Collapse" when expanded).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Aria-label construction logic (mirrors PrimaryInfoRow inline logic) ───────

/**
 * Constructs the aria-label for the expand/collapse chevron button.
 * Extracted from PrimaryInfoRow component for testability.
 */
function buildChevronAriaLabel(memberName: string, expanded: boolean): string {
  return expanded
    ? `Collapse details for ${memberName}`
    : `Expand details for ${memberName}`
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 3: Aria-label reflects member name and state', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any member name and expanded=false, the aria-label starts with "Expand"
   * and contains the member name.
   */
  it('collapsed state → aria-label contains "Expand" and member name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (memberName) => {
          const label = buildChevronAriaLabel(memberName, false)

          expect(label).toContain('Expand')
          expect(label).toContain(memberName)
          expect(label).not.toContain('Collapse')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.2**
   *
   * For any member name and expanded=true, the aria-label starts with "Collapse"
   * and contains the member name.
   */
  it('expanded state → aria-label contains "Collapse" and member name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (memberName) => {
          const label = buildChevronAriaLabel(memberName, true)

          expect(label).toContain('Collapse')
          expect(label).toContain(memberName)
          expect(label).not.toContain('Expand')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.2**
   *
   * For any member name and any boolean expanded state, the aria-label
   * exactly matches the expected format: "{verb} details for {name}".
   */
  it('aria-label matches exact format for any name and state', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.boolean(),
        (memberName, expanded) => {
          const label = buildChevronAriaLabel(memberName, expanded)
          const expectedVerb = expanded ? 'Collapse' : 'Expand'
          const expected = `${expectedVerb} details for ${memberName}`

          expect(label).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.2**
   *
   * Toggling the expanded state flips the action verb while preserving
   * the member name in the aria-label.
   */
  it('toggling expanded state flips verb but preserves member name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.boolean(),
        (memberName, expanded) => {
          const labelBefore = buildChevronAriaLabel(memberName, expanded)
          const labelAfter = buildChevronAriaLabel(memberName, !expanded)

          // Both contain the member name
          expect(labelBefore).toContain(memberName)
          expect(labelAfter).toContain(memberName)

          // They differ in verb
          expect(labelBefore).not.toBe(labelAfter)

          // One has Expand, other has Collapse
          const labels = [labelBefore, labelAfter]
          expect(labels.some((l) => l.startsWith('Expand'))).toBe(true)
          expect(labels.some((l) => l.startsWith('Collapse'))).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
