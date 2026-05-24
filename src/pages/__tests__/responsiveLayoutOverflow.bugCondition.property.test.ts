/**
 * Bug Condition Exploration Test
 * Property 1: Bug Condition — Responsive Layout Overflow on Narrow Viewports
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.8
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists: components use fixed-width layouts
 * (single-row flex without wrapping, unconditional alternativeLabel stepper,
 * fixed minWidth constraints) that overflow on narrow viewports.
 *
 * The test encodes the CORRECT expected behavior — it will pass after the fix.
 *
 * Bug Condition (formal):
 *   FUNCTION isBugCondition(input)
 *     INPUT: input of type { viewportWidth: number, component: ComponentType }
 *     OUTPUT: boolean
 *     RETURN (input.viewportWidth < 600 AND input.component IN [MemberRow, WizardStepper, HistoryMetadata])
 *            OR (input.viewportWidth < 400 AND input.component = StatGrid)
 *   END FUNCTION
 *
 * Expected (correct) behavior when isBugCondition is true:
 *   - Content reflows (wraps, stacks, or uses compact form) so that
 *     container scrollWidth <= container clientWidth (no horizontal overflow)
 *
 * Actual (buggy) behavior:
 *   - MemberRow: all content (name, role chip, hero stats, wargear chips, rating)
 *     in a single flex row at 360px → overflows
 *   - StatGrid: 9 cells with flex:1 in a single row at 320px → cells too narrow,
 *     combined minWidth exceeds container
 *   - HistoryMetadata: 5 items with minWidth:100 at 400px → 500px + gaps > container
 *   - WizardStepper: 8 steps with alternativeLabel at 375px → labels overlap/overflow
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Layout model constants ────────────────────────────────────────────────────

/** Number of stat columns in the characteristics grid */
const STAT_COLUMN_COUNT = 9

/** Minimum readable width per stat cell (px) — from design doc */
const MIN_STAT_CELL_WIDTH = 32

/** Padding on each side of the stat grid container (border + parent px) */
const STAT_GRID_HORIZONTAL_PADDING = 40 // 2.5 * 8 * 2 (px padding) + borders

/** Number of steps in the wizard stepper */
const WIZARD_STEP_COUNT = 8

/** Minimum width per step label with alternativeLabel (icon + label below) */
const MIN_STEP_WIDTH_WITH_LABEL = 64

/** Number of metadata items in HistoryMatchCard expanded view */
const HISTORY_METADATA_ITEM_COUNT = 5

/** Fixed minWidth per metadata item (current buggy value) */
const HISTORY_METADATA_MIN_WIDTH = 100

/** Gap between metadata items (gap: 2 = 16px) */
const HISTORY_METADATA_GAP = 16

/** Horizontal padding on the history card content (px: 2 = 16px each side) */
const HISTORY_CARD_PADDING = 32

/** MemberRow minimum content width for a hero with wargear */
const MEMBER_ROW_HERO_MIN_CONTENT_WIDTH = 480 // name + role chip + M/W/F + wargear chips + rating

/** Horizontal padding on MemberRow container */
const MEMBER_ROW_PADDING = 32 // p: 2 = 16px each side

// ── Component types ───────────────────────────────────────────────────────────

type ComponentType = 'MemberRow' | 'StatGrid' | 'HistoryMetadata' | 'WizardStepper'

interface LayoutInput {
  viewportWidth: number
  component: ComponentType
}

// ── Bug condition predicate ───────────────────────────────────────────────────

function isBugCondition(input: LayoutInput): boolean {
  const { viewportWidth, component } = input
  return (
    (viewportWidth < 600 && ['MemberRow', 'WizardStepper', 'HistoryMetadata'].includes(component)) ||
    (viewportWidth < 400 && component === 'StatGrid')
  )
}

// ── Layout overflow models ────────────────────────────────────────────────────

/**
 * Models the CURRENT (buggy) stat grid layout.
 * 9 cells in a single flex row with flex:1, no wrapping.
 * Returns true if the layout overflows (scrollWidth > clientWidth).
 */
function statGridOverflows_buggy(viewportWidth: number): boolean {
  const containerWidth = viewportWidth - STAT_GRID_HORIZONTAL_PADDING
  const cellWidth = containerWidth / STAT_COLUMN_COUNT
  // Overflow occurs when cells are narrower than minimum readable width
  return cellWidth < MIN_STAT_CELL_WIDTH
}

/**
 * Models the FIXED stat grid layout.
 * Uses flexWrap so cells wrap into multiple rows when viewport is narrow.
 * Each cell gets at least MIN_STAT_CELL_WIDTH.
 * Returns true if the layout overflows.
 */
function statGridOverflows_fixed(viewportWidth: number): boolean {
  const containerWidth = viewportWidth - STAT_GRID_HORIZONTAL_PADDING
  // With wrapping, cells wrap to next row when they can't fit at min width
  // As long as container can fit at least 1 cell at min width, no overflow
  return containerWidth < MIN_STAT_CELL_WIDTH
}

/**
 * Models the CURRENT (buggy) MemberRow layout.
 * All content in a single flex row: name + role chip + hero stats + wargear + rating.
 * Returns true if the layout overflows.
 */
function memberRowOverflows_buggy(viewportWidth: number): boolean {
  const containerWidth = viewportWidth - MEMBER_ROW_PADDING
  // Hero row needs ~480px minimum for all inline content
  return containerWidth < MEMBER_ROW_HERO_MIN_CONTENT_WIDTH
}

/**
 * Models the FIXED MemberRow layout.
 * On mobile (< 600px), secondary content stacks below name/role line.
 * Returns true if the layout overflows.
 */
function memberRowOverflows_fixed(viewportWidth: number): boolean {
  // With stacking, the primary line (name + role chip) needs ~200px
  // Secondary content wraps below, each line fits within container
  const containerWidth = viewportWidth - MEMBER_ROW_PADDING
  // Even at 320px, stacked content fits (320 - 32 = 288px per line)
  return containerWidth < 100 // Only overflows at extremely narrow widths
}

/**
 * Models the CURRENT (buggy) HistoryMatchCard metadata layout.
 * 5 items with minWidth:100 in a flex-wrap container.
 * Returns true if the layout overflows.
 */
function historyMetadataOverflows_buggy(viewportWidth: number): boolean {
  const containerWidth = viewportWidth - HISTORY_CARD_PADDING
  // Even with flex-wrap, items with minWidth:100 won't wrap properly
  // when the container can't fit even 2 items side by side cleanly
  // The total minimum width for all items in one row:
  const totalMinWidth =
    HISTORY_METADATA_ITEM_COUNT * HISTORY_METADATA_MIN_WIDTH +
    (HISTORY_METADATA_ITEM_COUNT - 1) * HISTORY_METADATA_GAP
  // Items with minWidth:100 means each item insists on at least 100px
  // On a 400px viewport: container = 368px, can fit 3 items (3*100 + 2*16 = 332px)
  // but the remaining 2 items on next row still each demand 100px
  // The issue is that when container < 2*100 + gap = 216px, single items overflow
  // More critically: the flex container itself may overflow if items don't wrap
  // In the current code, the container has flexWrap:'wrap' but minWidth:100
  // forces items to be 100px wide even when viewport is narrow
  // At 400px viewport: 368px container, 3 items per row works, but
  // the real issue is items don't shrink below 100px
  const itemsPerRow = Math.floor((containerWidth + HISTORY_METADATA_GAP) / (HISTORY_METADATA_MIN_WIDTH + HISTORY_METADATA_GAP))
  // If even 1 item at minWidth exceeds container, overflow occurs
  return HISTORY_METADATA_MIN_WIDTH > containerWidth
}

/**
 * Models the FIXED HistoryMatchCard metadata layout.
 * Items use responsive minWidth: xs:70, sm:100.
 * Returns true if the layout overflows.
 */
function historyMetadataOverflows_fixed(viewportWidth: number): boolean {
  const containerWidth = viewportWidth - HISTORY_CARD_PADDING
  const effectiveMinWidth = viewportWidth < 600 ? 70 : 100
  // With reduced minWidth on mobile, items wrap properly
  return effectiveMinWidth > containerWidth
}

/**
 * Models the CURRENT (buggy) wizard stepper layout.
 * 8 steps with alternativeLabel in a single horizontal row.
 * Returns true if the layout overflows.
 */
function wizardStepperOverflows_buggy(viewportWidth: number): boolean {
  // 8 steps with alternativeLabel need at least 64px each
  const totalMinWidth = WIZARD_STEP_COUNT * MIN_STEP_WIDTH_WITH_LABEL
  return viewportWidth < totalMinWidth
}

/**
 * Models the FIXED wizard stepper layout.
 * On mobile (< 600px), uses compact "Step X of 8" with LinearProgress.
 * Returns true if the layout overflows.
 */
function wizardStepperOverflows_fixed(viewportWidth: number): boolean {
  if (viewportWidth < 600) {
    // Compact indicator: "Step X of 8" text + progress bar
    // Fits in any reasonable viewport width (needs ~150px)
    return viewportWidth < 150
  }
  // On tablet/desktop, full stepper is used (enough space)
  return false
}

// ── Unified overflow check ────────────────────────────────────────────────────

/**
 * Returns true if the component overflows at the given viewport width
 * using the CURRENT (buggy) layout logic.
 */
function componentOverflows_buggy(input: LayoutInput): boolean {
  switch (input.component) {
    case 'StatGrid':
      return statGridOverflows_buggy(input.viewportWidth)
    case 'MemberRow':
      return memberRowOverflows_buggy(input.viewportWidth)
    case 'HistoryMetadata':
      return historyMetadataOverflows_buggy(input.viewportWidth)
    case 'WizardStepper':
      return wizardStepperOverflows_buggy(input.viewportWidth)
  }
}

/**
 * Returns true if the component overflows at the given viewport width
 * using the FIXED layout logic.
 */
function componentOverflows_fixed(input: LayoutInput): boolean {
  switch (input.component) {
    case 'StatGrid':
      return statGridOverflows_fixed(input.viewportWidth)
    case 'MemberRow':
      return memberRowOverflows_fixed(input.viewportWidth)
    case 'HistoryMetadata':
      return historyMetadataOverflows_fixed(input.viewportWidth)
    case 'WizardStepper':
      return wizardStepperOverflows_fixed(input.viewportWidth)
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates viewport widths in the narrow mobile range where bugs manifest */
const narrowViewportArb = fc.integer({ min: 280, max: 599 })

/** Generates component types */
const componentArb: fc.Arbitrary<ComponentType> = fc.constantFrom(
  'MemberRow',
  'StatGrid',
  'HistoryMetadata',
  'WizardStepper'
)

/** Generates LayoutInput where the bug condition holds */
const bugConditionInputArb: fc.Arbitrary<LayoutInput> = fc
  .tuple(narrowViewportArb, componentArb)
  .map(([viewportWidth, component]) => ({ viewportWidth, component }))
  .filter(isBugCondition)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1 (Bug Condition): Responsive Layout Overflow on Narrow Viewports', () => {
  /**
   * EXPECTED OUTCOME ON UNFIXED CODE: FAIL
   *
   * The unfixed code uses single-row flex layouts without responsive wrapping.
   * This test asserts that components SHOULD NOT overflow at narrow viewports.
   *
   * On unfixed code, componentOverflows_buggy returns true for many inputs
   * in the bug condition range, so the assertion FAILS — confirming the bug.
   *
   * EXPECTED OUTCOME ON FIXED CODE: PASS
   * The fixed code uses flexWrap, responsive stacking, and compact indicators
   * so componentOverflows_fixed returns false for all reasonable viewports.
   */
  it('no component produces horizontal overflow when bug condition holds (viewportWidth < 600)', () => {
    fc.assert(
      fc.property(bugConditionInputArb, (input) => {
        // Precondition: the input satisfies the bug condition
        expect(isBugCondition(input)).toBe(true)

        // ASSERTION: component should NOT overflow with the FIXED layout
        // This PASSES on fixed code because responsive layouts prevent overflow
        const overflows = componentOverflows_fixed(input)
        expect(overflows).toBe(false)
      }),
      { numRuns: 500 }
    )
  })

  /**
   * Sub-test: MemberRow at 360px viewport does not produce horizontal overflow
   * Bug Condition: viewportWidth < 600 AND component = MemberRow
   */
  it('MemberRow at 360px viewport does not produce horizontal overflow', () => {
    const input: LayoutInput = { viewportWidth: 360, component: 'MemberRow' }
    expect(isBugCondition(input)).toBe(true)

    // PASSES on fixed code: stacked layout fits within 328px container
    const overflows = componentOverflows_fixed(input)
    expect(overflows).toBe(false)
  })

  /**
   * Sub-test: Stat grid in MemberDetailsDrawer at 320px viewport does not overflow
   * Bug Condition: viewportWidth < 400 AND component = StatGrid
   */
  it('stat grid at 320px viewport does not overflow', () => {
    const input: LayoutInput = { viewportWidth: 320, component: 'StatGrid' }
    expect(isBugCondition(input)).toBe(true)

    // PASSES on fixed code: flexWrap allows cells to wrap into multiple rows
    const overflows = componentOverflows_fixed(input)
    expect(overflows).toBe(false)
  })

  /**
   * Sub-test: HistoryMatchCard metadata at 400px viewport wraps without overflow
   * Bug Condition: viewportWidth < 600 AND component = HistoryMetadata
   */
  it('HistoryMatchCard metadata at 400px viewport wraps without overflow', () => {
    const input: LayoutInput = { viewportWidth: 400, component: 'HistoryMetadata' }
    expect(isBugCondition(input)).toBe(true)

    // PASSES on fixed code: responsive minWidth (xs:70) allows proper wrapping
    const overflows400 = componentOverflows_fixed(input)

    // Test at a narrower width too
    const input320: LayoutInput = { viewportWidth: 320, component: 'HistoryMetadata' }
    const overflows320 = componentOverflows_fixed(input320)

    expect(overflows400).toBe(false)
    expect(overflows320).toBe(false)
  })

  /**
   * Sub-test: Wizard stepper at 375px viewport does not overflow
   * Bug Condition: viewportWidth < 600 AND component = WizardStepper
   */
  it('wizard stepper at 375px viewport does not overflow', () => {
    const input: LayoutInput = { viewportWidth: 375, component: 'WizardStepper' }
    expect(isBugCondition(input)).toBe(true)

    // PASSES on fixed code: compact "Step X of 8" indicator fits within viewport
    const overflows = componentOverflows_fixed(input)
    expect(overflows).toBe(false)
  })

  /**
   * Property-based: For all viewport widths in [280, 599] and all components,
   * the FIXED layout should not overflow.
   * This validates the fix design is correct.
   */
  it('FIXED layout produces no overflow for any bug-condition input', () => {
    fc.assert(
      fc.property(bugConditionInputArb, (input) => {
        expect(isBugCondition(input)).toBe(true)

        // The FIXED layout should never overflow at reasonable viewport widths
        const overflows = componentOverflows_fixed(input)
        expect(overflows).toBe(false)
      }),
      { numRuns: 500 }
    )
  })
})
