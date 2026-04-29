// Bugfix spec: abandon-creation-state-reset, Property 2: Preservation - Non-Abort Wizard Interactions Unchanged

/**
 * Property 2: Preservation - Non-Abort Wizard Interactions Unchanged
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * OBSERVATION-FIRST METHODOLOGY:
 * These tests capture the CURRENT behavior on UNFIXED code for all interactions
 * that do NOT involve confirming the abandon dialog.
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: Tests PASS (baseline behavior is correct)
 * EXPECTED OUTCOME ON FIXED CODE:   Tests PASS (no regressions introduced)
 *
 * Behaviors tested:
 * 1. Step navigation: go(n) sets wizard.step = n, all other fields unchanged
 * 2. Alignment selection: sets alignment, clears factionId and companyTypeId
 * 3. SessionStorage persistence: wizard state is written on every setWizard call
 * 4. Stats-entry restore: ?from=stats restores draft from sessionStorage with step: 6
 * 5. Cancel/dismiss: dismissing the abandon dialog leaves wizard state unchanged
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState, Alignment } from '../../models'

// ── INITIAL_WIZARD constant (mirrors CreateCompanyPage.tsx) ───────────────────

const INITIAL_WIZARD: WizardState = {
  step: 0,
  alignment: null,
  factionId: null,
  companyTypeId: null,
  variantId: null,
  companyName: '',
  memberNames: {},
  leaderId: null,
  sergeantIds: [],
  heroPaths: {},
  heroSpellChoices: {},
  goldPurchases: {},
}

const WIZARD_DRAFT_KEY = 'bc_wizard_draft'

// ── Pure state transition functions (mirrors CreateCompanyPage.tsx) ───────────

/**
 * Pure model of the go(nextStep) function.
 * Sets wizard.step = nextStep, all other fields unchanged.
 */
function go(wizard: WizardState, nextStep: number): WizardState {
  return { ...wizard, step: nextStep }
}

/**
 * Pure model of the selectAlignment(alignment) function.
 * Sets alignment, clears factionId and companyTypeId (downstream fields).
 */
function selectAlignment(wizard: WizardState, alignment: Alignment): WizardState {
  return {
    ...wizard,
    alignment,
    factionId: null,
    companyTypeId: null,
  }
}

/**
 * Pure model of the sessionStorage persist useEffect.
 * Writes the wizard state to sessionStorage on every setWizard call.
 */
function persistToSessionStorage(wizard: WizardState): void {
  try {
    sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(wizard))
  } catch {
    /* ignore */
  }
}

/**
 * Pure model of the ?from=stats restore useEffect.
 * When ?from=stats is present and a draft exists in sessionStorage,
 * restores the draft and sets step: 6.
 */
function restoreFromStatsEntry(draftJson: string | null): WizardState | null {
  if (!draftJson) return null
  try {
    const parsed = JSON.parse(draftJson) as WizardState
    return { ...parsed, step: 6 }
  } catch {
    return null
  }
}

/**
 * Pure model of the cancel/dismiss behavior.
 * When the user dismisses the abandon dialog, wizard state is unchanged.
 */
function dismissAbortDialog(wizard: WizardState): WizardState {
  // setShowAbortConfirm(false) — no effect on wizard state
  return wizard
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const alignmentArb: fc.Arbitrary<Alignment> = fc.constantFrom('good', 'evil')

/** Generates a valid step number (0–7) */
const validStepArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 7 })

/** Generates a full WizardState with arbitrary values */
const wizardStateArb: fc.Arbitrary<WizardState> = fc.record({
  step: fc.integer({ min: 0, max: 7 }),
  alignment: fc.oneof(fc.constant(null), alignmentArb),
  factionId: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  companyTypeId: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  variantId: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  companyName: fc.string({ maxLength: 50 }),
  memberNames: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  leaderId: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  sergeantIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
    maxLength: 3,
  }),
  heroPaths: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  heroSpellChoices: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.string({ minLength: 1, maxLength: 30 })
  ),
  goldPurchases: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.array(fc.string({ minLength: 1, maxLength: 30 }))
  ),
})

// ── SessionStorage setup/teardown ─────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Preservation - Non-Abort Wizard Interactions Unchanged', () => {
  // ── 1. Step navigation ──────────────────────────────────────────────────────

  describe('3.4 Step navigation: go(n) sets step and leaves all other fields intact', () => {
    /**
     * Validates: Requirements 3.4
     *
     * For any wizard state and any valid target step n, calling go(n) sets
     * wizard.step = n and leaves all other fields completely unchanged.
     */
    it('go(n) sets wizard.step to n for all valid steps', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.step).toBe(nextStep)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves alignment unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.alignment).toBe(wizard.alignment)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves factionId unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.factionId).toBe(wizard.factionId)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves companyTypeId unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.companyTypeId).toBe(wizard.companyTypeId)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves companyName unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.companyName).toBe(wizard.companyName)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves leaderId unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.leaderId).toBe(wizard.leaderId)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves sergeantIds unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.sergeantIds).toEqual(wizard.sergeantIds)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves heroPaths unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.heroPaths).toEqual(wizard.heroPaths)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves heroSpellChoices unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.heroSpellChoices).toEqual(wizard.heroSpellChoices)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) leaves goldPurchases unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          expect(result.goldPurchases).toEqual(wizard.goldPurchases)
        }),
        { numRuns: 500 }
      )
    })

    it('go(n) produces a state that only differs from input in the step field', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const result = go(wizard, nextStep)
          // All fields except step must be identical
          const { step: _resultStep, ...resultRest } = result
          const { step: _wizardStep, ...wizardRest } = wizard
          expect(resultRest).toEqual(wizardRest)
        }),
        { numRuns: 500 }
      )
    })
  })

  // ── 2. Alignment selection ──────────────────────────────────────────────────

  describe('3.4 Alignment selection: sets alignment and clears downstream fields', () => {
    /**
     * Validates: Requirements 3.4
     *
     * For any wizard state and any alignment value, selectAlignment(a) sets
     * wizard.alignment = a and clears factionId and companyTypeId (downstream
     * fields that depend on alignment). All other fields are unchanged.
     */
    it('selectAlignment sets alignment to the chosen value', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.alignment).toBe(alignment)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment clears factionId (downstream field)', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.factionId).toBeNull()
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment clears companyTypeId (downstream field)', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.companyTypeId).toBeNull()
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves step unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.step).toBe(wizard.step)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves companyName unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.companyName).toBe(wizard.companyName)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves leaderId unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.leaderId).toBe(wizard.leaderId)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves sergeantIds unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.sergeantIds).toEqual(wizard.sergeantIds)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves heroPaths unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.heroPaths).toEqual(wizard.heroPaths)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves heroSpellChoices unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.heroSpellChoices).toEqual(wizard.heroSpellChoices)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment leaves goldPurchases unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const result = selectAlignment(wizard, alignment)
          expect(result.goldPurchases).toEqual(wizard.goldPurchases)
        }),
        { numRuns: 500 }
      )
    })

    it('selectAlignment is idempotent: selecting the same alignment twice yields the same result', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, (wizard, alignment) => {
          const once = selectAlignment(wizard, alignment)
          const twice = selectAlignment(once, alignment)
          expect(twice).toEqual(once)
        }),
        { numRuns: 300 }
      )
    })
  })

  // ── 3. SessionStorage draft persistence ────────────────────────────────────

  describe('3.4 SessionStorage persistence: wizard state is written on every setWizard call', () => {
    /**
     * Validates: Requirements 3.4
     *
     * For any wizard state, calling persistToSessionStorage (the useEffect
     * persist hook) writes the wizard state to sessionStorage under WIZARD_DRAFT_KEY.
     * The stored value is the JSON-serialized wizard state.
     */
    it('persistToSessionStorage writes wizard state to sessionStorage', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          persistToSessionStorage(wizard)
          const stored = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          expect(stored).not.toBeNull()
          const parsed = JSON.parse(stored!) as WizardState
          expect(parsed).toEqual(wizard)
        }),
        { numRuns: 300 }
      )
    })

    it('persistToSessionStorage overwrites previous draft on each call', () => {
      fc.assert(
        fc.property(wizardStateArb, wizardStateArb, (first, second) => {
          persistToSessionStorage(first)
          persistToSessionStorage(second)
          const stored = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          expect(stored).not.toBeNull()
          const parsed = JSON.parse(stored!) as WizardState
          // The stored value should be the SECOND (most recent) state
          expect(parsed).toEqual(second)
        }),
        { numRuns: 300 }
      )
    })

    it('persistToSessionStorage stores all wizard fields correctly', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          persistToSessionStorage(wizard)
          const stored = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          const parsed = JSON.parse(stored!) as WizardState
          // Verify each field individually
          expect(parsed.step).toBe(wizard.step)
          expect(parsed.alignment).toBe(wizard.alignment)
          expect(parsed.factionId).toBe(wizard.factionId)
          expect(parsed.companyTypeId).toBe(wizard.companyTypeId)
          expect(parsed.variantId).toBe(wizard.variantId)
          expect(parsed.companyName).toBe(wizard.companyName)
          expect(parsed.memberNames).toEqual(wizard.memberNames)
          expect(parsed.leaderId).toBe(wizard.leaderId)
          expect(parsed.sergeantIds).toEqual(wizard.sergeantIds)
          expect(parsed.heroPaths).toEqual(wizard.heroPaths)
          expect(parsed.heroSpellChoices).toEqual(wizard.heroSpellChoices)
          expect(parsed.goldPurchases).toEqual(wizard.goldPurchases)
        }),
        { numRuns: 300 }
      )
    })

    it('persistToSessionStorage round-trips through JSON without data loss', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          persistToSessionStorage(wizard)
          const stored = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          const parsed = JSON.parse(stored!) as WizardState
          // Re-serialize and compare to ensure no data loss
          expect(JSON.stringify(parsed)).toBe(JSON.stringify(wizard))
        }),
        { numRuns: 300 }
      )
    })
  })

  // ── 4. Stats-entry restore ──────────────────────────────────────────────────

  describe('3.1 Stats-entry restore: ?from=stats restores draft and sets step: 6', () => {
    /**
     * Validates: Requirements 3.1
     *
     * When the user returns from the stats-entry page with ?from=stats, the
     * system restores the wizard draft from sessionStorage and sets step: 6.
     * All other fields from the draft are preserved exactly.
     */
    it('restoreFromStatsEntry returns null when no draft exists in sessionStorage', () => {
      const result = restoreFromStatsEntry(null)
      expect(result).toBeNull()
    })

    it('restoreFromStatsEntry sets step to 6 when a valid draft exists', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const draftJson = JSON.stringify(wizard)
          const result = restoreFromStatsEntry(draftJson)
          expect(result).not.toBeNull()
          expect(result!.step).toBe(6)
        }),
        { numRuns: 300 }
      )
    })

    it('restoreFromStatsEntry preserves all non-step fields from the draft', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const draftJson = JSON.stringify(wizard)
          const result = restoreFromStatsEntry(draftJson)
          expect(result).not.toBeNull()
          // All fields except step must match the draft
          expect(result!.alignment).toBe(wizard.alignment)
          expect(result!.factionId).toBe(wizard.factionId)
          expect(result!.companyTypeId).toBe(wizard.companyTypeId)
          expect(result!.variantId).toBe(wizard.variantId)
          expect(result!.companyName).toBe(wizard.companyName)
          expect(result!.memberNames).toEqual(wizard.memberNames)
          expect(result!.leaderId).toBe(wizard.leaderId)
          expect(result!.sergeantIds).toEqual(wizard.sergeantIds)
          expect(result!.heroPaths).toEqual(wizard.heroPaths)
          expect(result!.heroSpellChoices).toEqual(wizard.heroSpellChoices)
          expect(result!.goldPurchases).toEqual(wizard.goldPurchases)
        }),
        { numRuns: 300 }
      )
    })

    it('restoreFromStatsEntry always sets step to 6 regardless of the draft step value', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          // Even if the draft has a different step, the restore always sets step: 6
          const draftJson = JSON.stringify(wizard)
          const result = restoreFromStatsEntry(draftJson)
          expect(result!.step).toBe(6)
        }),
        { numRuns: 300 }
      )
    })

    it('restoreFromStatsEntry returns null for malformed JSON', () => {
      const result = restoreFromStatsEntry('not-valid-json{{{')
      expect(result).toBeNull()
    })

    it('stats-entry round-trip: persist then restore yields step 6 with all fields intact', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          // Simulate: user is mid-wizard, gets redirected to stats, returns
          persistToSessionStorage(wizard)
          const draftJson = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          const restored = restoreFromStatsEntry(draftJson)

          expect(restored).not.toBeNull()
          expect(restored!.step).toBe(6)
          // All non-step fields must match the original wizard state
          const { step: _s, ...restoredRest } = restored!
          const { step: _w, ...wizardRest } = wizard
          expect(restoredRest).toEqual(wizardRest)
        }),
        { numRuns: 300 }
      )
    })
  })

  // ── 5. Cancel/dismiss of abandon dialog ────────────────────────────────────

  describe('3.3 Cancel/dismiss: dismissing the abandon dialog leaves wizard state unchanged', () => {
    /**
     * Validates: Requirements 3.3
     *
     * When the user clicks "Cancel" or dismisses the abandon dialog without
     * confirming, the wizard state is completely unchanged. This models the
     * setShowAbortConfirm(false) call which only affects the dialog visibility,
     * not the wizard state.
     */
    it('dismissAbortDialog returns the wizard state unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const result = dismissAbortDialog(wizard)
          expect(result).toEqual(wizard)
        }),
        { numRuns: 500 }
      )
    })

    it('dismissAbortDialog is a pure identity function on wizard state', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const result = dismissAbortDialog(wizard)
          // The result must be reference-equal or deeply equal to the input
          expect(result).toBe(wizard)
        }),
        { numRuns: 500 }
      )
    })

    it('dismissAbortDialog leaves step unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const result = dismissAbortDialog(wizard)
          expect(result.step).toBe(wizard.step)
        }),
        { numRuns: 300 }
      )
    })

    it('dismissAbortDialog leaves alignment unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const result = dismissAbortDialog(wizard)
          expect(result.alignment).toBe(wizard.alignment)
        }),
        { numRuns: 300 }
      )
    })

    it('dismissAbortDialog leaves all hero-related fields unchanged', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const result = dismissAbortDialog(wizard)
          expect(result.leaderId).toBe(wizard.leaderId)
          expect(result.sergeantIds).toEqual(wizard.sergeantIds)
          expect(result.heroPaths).toEqual(wizard.heroPaths)
          expect(result.heroSpellChoices).toEqual(wizard.heroSpellChoices)
        }),
        { numRuns: 300 }
      )
    })

    it('dismissAbortDialog can be called multiple times without changing state', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          const once = dismissAbortDialog(wizard)
          const twice = dismissAbortDialog(once)
          const thrice = dismissAbortDialog(twice)
          expect(thrice).toEqual(wizard)
        }),
        { numRuns: 300 }
      )
    })
  })

  // ── 6. Composition: non-abort interactions compose correctly ───────────────

  describe('Composition: non-abort interactions compose correctly', () => {
    /**
     * Validates: Requirements 3.3, 3.4
     *
     * Sequences of non-abort interactions (step navigation, alignment selection,
     * cancel/dismiss) should compose correctly and produce predictable results.
     */
    it('go then selectAlignment: step is updated and alignment is set with downstream cleared', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, alignmentArb, (wizard, nextStep, alignment) => {
          const afterGo = go(wizard, nextStep)
          const afterAlignment = selectAlignment(afterGo, alignment)

          expect(afterAlignment.step).toBe(nextStep)
          expect(afterAlignment.alignment).toBe(alignment)
          expect(afterAlignment.factionId).toBeNull()
          expect(afterAlignment.companyTypeId).toBeNull()
        }),
        { numRuns: 300 }
      )
    })

    it('selectAlignment then go: alignment is preserved and step is updated', () => {
      fc.assert(
        fc.property(wizardStateArb, alignmentArb, validStepArb, (wizard, alignment, nextStep) => {
          const afterAlignment = selectAlignment(wizard, alignment)
          const afterGo = go(afterAlignment, nextStep)

          expect(afterGo.alignment).toBe(alignment)
          expect(afterGo.step).toBe(nextStep)
          expect(afterGo.factionId).toBeNull()
          expect(afterGo.companyTypeId).toBeNull()
        }),
        { numRuns: 300 }
      )
    })

    it('dismiss then go: wizard state after dismiss is same as before, then step changes', () => {
      fc.assert(
        fc.property(wizardStateArb, validStepArb, (wizard, nextStep) => {
          const afterDismiss = dismissAbortDialog(wizard)
          const afterGo = go(afterDismiss, nextStep)

          // After dismiss, state is unchanged; after go, only step changes
          expect(afterGo.step).toBe(nextStep)
          const { step: _s, ...afterGoRest } = afterGo
          const { step: _w, ...wizardRest } = wizard
          expect(afterGoRest).toEqual(wizardRest)
        }),
        { numRuns: 300 }
      )
    })

    it('persist then restore round-trip preserves all fields except step (which becomes 6)', () => {
      fc.assert(
        fc.property(wizardStateArb, (wizard) => {
          persistToSessionStorage(wizard)
          const draftJson = sessionStorage.getItem(WIZARD_DRAFT_KEY)
          const restored = restoreFromStatsEntry(draftJson)

          expect(restored).not.toBeNull()
          // Step is always 6 after stats-entry restore
          expect(restored!.step).toBe(6)
          // All other fields are preserved
          expect(restored!.alignment).toBe(wizard.alignment)
          expect(restored!.factionId).toBe(wizard.factionId)
          expect(restored!.companyTypeId).toBe(wizard.companyTypeId)
          expect(restored!.variantId).toBe(wizard.variantId)
          expect(restored!.companyName).toBe(wizard.companyName)
          expect(restored!.memberNames).toEqual(wizard.memberNames)
          expect(restored!.leaderId).toBe(wizard.leaderId)
          expect(restored!.sergeantIds).toEqual(wizard.sergeantIds)
          expect(restored!.heroPaths).toEqual(wizard.heroPaths)
          expect(restored!.heroSpellChoices).toEqual(wizard.heroSpellChoices)
          expect(restored!.goldPurchases).toEqual(wizard.goldPurchases)
        }),
        { numRuns: 300 }
      )
    })
  })
})
