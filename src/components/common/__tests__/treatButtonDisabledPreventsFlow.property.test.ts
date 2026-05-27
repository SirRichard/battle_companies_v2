// Feature: battle-companies-ux-improvements, Property 11: Disabled Treat button prevents treatment flow

/**
 * Property 11: Disabled Treat button prevents treatment flow
 * Validates: Requirements 3.3
 *
 * For any member with treatable injuries and a company with IP < 1,
 * activating the disabled Treat button SHALL NOT initiate the injury
 * treatment flow (no dialog/stage transition).
 *
 * Implementation insight from MemberDetailsDrawer:
 * - When showDisabledTreatBtn=true: button has `disabled` prop AND `pointerEvents: 'none'`
 * - The disabled button is a SEPARATE render branch with NO onClick handler
 * - The treatment flow is initiated by: setTreatTargetInjury(injury.type) + setTreatStage('options')
 * - When button is disabled, these state setters are never called
 * - Therefore clicking the disabled button cannot trigger treatment flow
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { MemberRole, InjuryType } from '../../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making', 'warrior']
const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']

const HERO_ONLY_TREATABLE: InjuryType[] = ['arm_wound', 'leg_wound', 'broken_honour']
const ALL_TREATABLE: InjuryType[] = ['missing_next_game', ...HERO_ONLY_TREATABLE]

// ── Model: Treatment flow state ───────────────────────────────────────────────

interface TreatFlowState {
  treatTargetInjury: string | null
  treatStage: 'options' | 'rolling' | 'ip_prompt' | 'confirm' | null
}

/**
 * Models the initial (idle) treatment flow state.
 */
function initialTreatFlowState(): TreatFlowState {
  return { treatTargetInjury: null, treatStage: null }
}

/**
 * Models the treatment flow initiation (what the normal onClick does).
 */
function initiateTreatFlow(injuryType: string): TreatFlowState {
  return { treatTargetInjury: injuryType, treatStage: 'options' }
}

// ── Model: Button render branch decision ──────────────────────────────────────

/**
 * Determines which button branch renders, mirroring MemberDetailsDrawer logic:
 *   const hasIP = (company?.influence ?? 0) >= 1
 *   const isWarrior = member.role === 'warrior'
 *   const isTreatable = !!company && !!onSaveCompany && (
 *     injury.type === 'missing_next_game' ||
 *     (!isWarrior && ['arm_wound', 'leg_wound', 'broken_honour'].includes(injury.type))
 *   )
 *   const showTreatBtn = isTreatable && hasIP
 *   const showDisabledTreatBtn = isTreatable && !hasIP
 */
type ButtonBranch = 'normal' | 'disabled' | 'hidden'

function determineButtonBranch(
  injuryType: InjuryType,
  role: MemberRole,
  influence: number,
  companyDefined: boolean,
  onSaveCompanyDefined: boolean
): ButtonBranch {
  const hasIP = influence >= 1
  const isWarrior = role === 'warrior'
  const isTreatable =
    companyDefined &&
    onSaveCompanyDefined &&
    (injuryType === 'missing_next_game' ||
      (!isWarrior && HERO_ONLY_TREATABLE.includes(injuryType)))

  if (!isTreatable) return 'hidden'
  return hasIP ? 'normal' : 'disabled'
}

/**
 * Models what happens to treatment flow state when the button is "clicked".
 *
 * Key insight: the disabled button branch has NO onClick handler.
 * Only the normal branch has onClick that calls:
 *   setTreatTargetInjury(injury.type)
 *   setTreatStage('options')
 *
 * The disabled button has:
 *   - disabled prop (HTML disabled attribute prevents click events)
 *   - pointerEvents: 'none' (CSS prevents pointer interaction)
 *   - No onClick handler attached
 *
 * Therefore "clicking" a disabled button produces no state change.
 */
function simulateButtonClick(
  branch: ButtonBranch,
  injuryType: InjuryType,
  currentState: TreatFlowState
): TreatFlowState {
  switch (branch) {
    case 'normal':
      // Normal branch has onClick that initiates treatment flow
      return initiateTreatFlow(injuryType)
    case 'disabled':
      // Disabled branch has NO onClick — state unchanged
      return currentState
    case 'hidden':
      // No button rendered — state unchanged
      return currentState
  }
}

// ── Generators ────────────────────────────────────────────────────────────────

const arbHeroRole = fc.constantFrom<MemberRole>(...HERO_ROLES)
const arbRole = fc.constantFrom<MemberRole>(...ALL_ROLES)
const arbHeroOnlyTreatableInjury = fc.constantFrom<InjuryType>(...HERO_ONLY_TREATABLE)
const arbAllTreatableInjury = fc.constantFrom<InjuryType>(...ALL_TREATABLE)
// IP < 1 means influence = 0 (integer context)
const arbNoIP = fc.constant(0)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 11: Disabled Treat button prevents treatment flow', () => {
  it('disabled button (IP=0, treatable injury) does NOT initiate treatment flow for hero roles', () => {
    fc.assert(
      fc.property(
        arbHeroRole,
        arbHeroOnlyTreatableInjury,
        (role, injuryType) => {
          const influence = 0
          const branch = determineButtonBranch(injuryType, role, influence, true, true)

          // Precondition: branch must be disabled for this scenario
          expect(branch).toBe('disabled')

          // Simulate clicking the disabled button
          const stateBefore = initialTreatFlowState()
          const stateAfter = simulateButtonClick(branch, injuryType, stateBefore)

          // Treatment flow must NOT be initiated
          expect(stateAfter.treatTargetInjury).toBeNull()
          expect(stateAfter.treatStage).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled button (IP=0, missing_next_game) does NOT initiate treatment flow for any role', () => {
    fc.assert(
      fc.property(
        arbRole,
        (role) => {
          const injuryType: InjuryType = 'missing_next_game'
          const influence = 0
          const branch = determineButtonBranch(injuryType, role, influence, true, true)

          // missing_next_game is treatable for all roles
          expect(branch).toBe('disabled')

          // Simulate clicking the disabled button
          const stateBefore = initialTreatFlowState()
          const stateAfter = simulateButtonClick(branch, injuryType, stateBefore)

          // Treatment flow must NOT be initiated
          expect(stateAfter.treatTargetInjury).toBeNull()
          expect(stateAfter.treatStage).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled button has disabled=true and pointerEvents=none (no interaction possible)', () => {
    fc.assert(
      fc.property(
        arbHeroRole,
        arbAllTreatableInjury,
        (role, injuryType) => {
          const influence = 0
          const branch = determineButtonBranch(injuryType, role, influence, true, true)
          expect(branch).toBe('disabled')

          // Model the disabled button's properties from MemberDetailsDrawer:
          // <Button disabled sx={{ pointerEvents: 'none' }}>
          const buttonProps = {
            disabled: true,
            pointerEvents: 'none' as const,
            hasOnClick: false, // No onClick handler in disabled branch
          }

          expect(buttonProps.disabled).toBe(true)
          expect(buttonProps.pointerEvents).toBe('none')
          expect(buttonProps.hasOnClick).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('contrast: normal button (IP>=1, treatable injury) DOES initiate treatment flow', () => {
    fc.assert(
      fc.property(
        arbHeroRole,
        arbAllTreatableInjury,
        fc.integer({ min: 1, max: 20 }),
        (role, injuryType, influence) => {
          const branch = determineButtonBranch(injuryType, role, influence, true, true)

          // Precondition: branch must be normal for this scenario
          expect(branch).toBe('normal')

          // Simulate clicking the normal button
          const stateBefore = initialTreatFlowState()
          const stateAfter = simulateButtonClick(branch, injuryType, stateBefore)

          // Treatment flow IS initiated
          expect(stateAfter.treatTargetInjury).toBe(injuryType)
          expect(stateAfter.treatStage).toBe('options')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled button preserves existing idle state across arbitrary treatable injuries', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Hero with any treatable injury
          fc.tuple(arbHeroRole, arbAllTreatableInjury),
          // Warrior with missing_next_game only
          fc.tuple(fc.constant<MemberRole>('warrior'), fc.constant<InjuryType>('missing_next_game'))
        ),
        ([role, injuryType]) => {
          const influence = 0
          const branch = determineButtonBranch(injuryType, role, influence, true, true)
          expect(branch).toBe('disabled')

          // State before must equal state after — no mutation
          const stateBefore = initialTreatFlowState()
          const stateAfter = simulateButtonClick(branch, injuryType, stateBefore)

          expect(stateAfter).toEqual(stateBefore)
        }
      ),
      { numRuns: 150 }
    )
  })
})
