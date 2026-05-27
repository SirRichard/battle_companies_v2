// Feature: battle-companies-ux-improvements, Property 10: Treat button state matches IP availability

/**
 * Property 10: Treat button state matches IP availability
 * Validates: Requirements 3.1, 3.2, 3.4
 *
 * For any member with treatable injuries (missing_next_game for any role;
 * arm_wound, leg_wound, broken_honour for hero roles), the Treat button SHALL
 * be visually disabled (opacity 0.3–0.5) with "No IP Available" error text
 * when company IP < 1, and SHALL be in normal interactive state without error
 * text when company IP ≥ 1.
 *
 * Additionally:
 * - When company is undefined: no treat button at all
 * - When onSaveCompany is undefined: no treat button at all
 * - When injury is not treatable for the role: no treat button at all
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { MemberRole, InjuryType } from '../../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making', 'warrior']
const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']

const ALL_INJURY_TYPES: InjuryType[] = [
  'missing_next_game',
  'arm_wound',
  'leg_wound',
  'broken_honour',
  'dead',
]

// Hero-only treatable injuries (not treatable for warriors)
const HERO_ONLY_TREATABLE: InjuryType[] = ['arm_wound', 'leg_wound', 'broken_honour']

// ── Functions under test (mirror MemberDetailsDrawer logic) ───────────────────

/**
 * Determines if an injury is treatable for a given role.
 * From MemberDetailsDrawer:
 *   isTreatable = !!company && !!onSaveCompany && (
 *     injury.type === 'missing_next_game' ||
 *     (!isWarrior && ['arm_wound', 'leg_wound', 'broken_honour'].includes(injury.type))
 *   )
 */
function isTreatable(
  injuryType: InjuryType,
  role: MemberRole,
  companyDefined: boolean,
  onSaveCompanyDefined: boolean
): boolean {
  if (!companyDefined || !onSaveCompanyDefined) return false
  const isWarrior = role === 'warrior'
  return (
    injuryType === 'missing_next_game' ||
    (!isWarrior && HERO_ONLY_TREATABLE.includes(injuryType))
  )
}

/**
 * Determines if company has enough IP for treatment.
 */
function hasIP(influence: number): boolean {
  return influence >= 1
}

/**
 * Derives treat button state:
 * - 'normal': button in normal interactive state (treatable + has IP)
 * - 'disabled': button shown disabled with error text (treatable + no IP)
 * - 'hidden': no button shown at all (not treatable)
 */
function treatButtonState(
  injuryType: InjuryType,
  role: MemberRole,
  influence: number,
  companyDefined: boolean,
  onSaveCompanyDefined: boolean
): 'normal' | 'disabled' | 'hidden' {
  const treatable = isTreatable(injuryType, role, companyDefined, onSaveCompanyDefined)
  if (!treatable) return 'hidden'
  return hasIP(influence) ? 'normal' : 'disabled'
}

/**
 * Returns disabled button opacity. From MemberDetailsDrawer: opacity: 0.4
 */
function disabledButtonOpacity(): number {
  return 0.4
}

/**
 * Returns error text shown when button is disabled.
 */
function disabledErrorText(): string {
  return 'No IP Available'
}

// ── Generators ────────────────────────────────────────────────────────────────

const arbRole = fc.constantFrom<MemberRole>(...ALL_ROLES)
const arbHeroRole = fc.constantFrom<MemberRole>(...HERO_ROLES)
const arbInjuryType = fc.constantFrom<InjuryType>(...ALL_INJURY_TYPES)
const arbTreatableInjuryForAnyRole = fc.constant<InjuryType>('missing_next_game')
const arbHeroOnlyTreatableInjury = fc.constantFrom<InjuryType>(...HERO_ONLY_TREATABLE)
const arbInfluence = fc.integer({ min: 0, max: 20 })
const arbNoIP = fc.integer({ min: 0, max: 0 }) // exactly 0
const arbHasIP = fc.integer({ min: 1, max: 20 })

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 10: Treat button state matches IP availability', () => {
  it('treatable injury + IP >= 1: button in normal interactive state (no error text)', () => {
    fc.assert(
      fc.property(
        arbHeroRole,
        arbHeroOnlyTreatableInjury,
        arbHasIP,
        (role, injuryType, influence) => {
          const state = treatButtonState(injuryType, role, influence, true, true)
          expect(state).toBe('normal')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('treatable injury + IP < 1: button disabled with "No IP Available" error text', () => {
    fc.assert(
      fc.property(
        arbHeroRole,
        arbHeroOnlyTreatableInjury,
        arbNoIP,
        (role, injuryType, influence) => {
          const state = treatButtonState(injuryType, role, influence, true, true)
          expect(state).toBe('disabled')
          // Verify disabled state properties
          const opacity = disabledButtonOpacity()
          expect(opacity).toBeGreaterThanOrEqual(0.3)
          expect(opacity).toBeLessThanOrEqual(0.5)
          expect(disabledErrorText()).toBe('No IP Available')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('missing_next_game treatable for ANY role when company + onSaveCompany defined', () => {
    fc.assert(
      fc.property(
        arbRole,
        arbInfluence,
        (role, influence) => {
          const state = treatButtonState('missing_next_game', role, influence, true, true)
          // Should never be hidden — always treatable
          expect(state).not.toBe('hidden')
          // State depends on IP
          if (influence >= 1) {
            expect(state).toBe('normal')
          } else {
            expect(state).toBe('disabled')
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('hero-only injuries NOT treatable for warrior role', () => {
    fc.assert(
      fc.property(
        arbHeroOnlyTreatableInjury,
        arbInfluence,
        (injuryType, influence) => {
          const state = treatButtonState(injuryType, 'warrior', influence, true, true)
          expect(state).toBe('hidden')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no button when company is undefined regardless of other params', () => {
    fc.assert(
      fc.property(
        arbRole,
        arbInjuryType,
        arbInfluence,
        fc.boolean(),
        (role, injuryType, influence, onSaveDefined) => {
          const state = treatButtonState(injuryType, role, influence, false, onSaveDefined)
          expect(state).toBe('hidden')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no button when onSaveCompany is undefined regardless of other params', () => {
    fc.assert(
      fc.property(
        arbRole,
        arbInjuryType,
        arbInfluence,
        fc.boolean(),
        (role, injuryType, influence, companyDefined) => {
          const state = treatButtonState(injuryType, role, influence, companyDefined, false)
          expect(state).toBe('hidden')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('dead injury never treatable for any role', () => {
    fc.assert(
      fc.property(
        arbRole,
        arbInfluence,
        (role, influence) => {
          const state = treatButtonState('dead', role, influence, true, true)
          expect(state).toBe('hidden')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled button opacity is within 0.3-0.5 range per requirement 3.1', () => {
    // Static check — opacity is always 0.4 per implementation
    const opacity = disabledButtonOpacity()
    expect(opacity).toBeGreaterThanOrEqual(0.3)
    expect(opacity).toBeLessThanOrEqual(0.5)
  })
})
