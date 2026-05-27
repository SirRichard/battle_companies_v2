// Feature: battle-companies-ux-improvements, Property 8: Edit button visibility matches hero role

/**
 * Property 8: Edit button visibility matches hero role
 * Validates: Requirements 2.4
 *
 * For any member, the Equipment section "Edit" button SHALL be visible
 * if and only if the member's role is leader, sergeant, or hero_in_making.
 *
 * Additionally, the Edit button requires onSaveCompany to be defined.
 * When onSaveCompany is undefined, the Edit button is hidden regardless of role.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { MemberRole } from '../../../models'

// ── All possible member roles ─────────────────────────────────────────────────

const ALL_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making', 'warrior']
const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']

// ── Function under test (mirrors MemberDetailsDrawer logic) ───────────────────

/**
 * Determines whether the Equipment section Edit button is visible.
 * From MemberDetailsDrawer:
 *   const isHero = member.role !== 'warrior'
 *   {isHero && onSaveCompany && ( <Edit button> )}
 */
function isEditButtonVisible(role: MemberRole, onSaveCompanyDefined: boolean): boolean {
  const isHero = role !== 'warrior'
  return isHero && onSaveCompanyDefined
}

// ── Generators ────────────────────────────────────────────────────────────────

const arbRole = fc.constantFrom<MemberRole>(...ALL_ROLES)
const arbOnSaveCompanyDefined = fc.boolean()

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 8: Edit button visibility matches hero role', () => {
  it('Edit button visible iff role is leader/sergeant/hero_in_making AND onSaveCompany is defined', () => {
    fc.assert(
      fc.property(arbRole, arbOnSaveCompanyDefined, (role, onSaveCompanyDefined) => {
        const visible = isEditButtonVisible(role, onSaveCompanyDefined)
        const expectedVisible = HERO_ROLES.includes(role) && onSaveCompanyDefined

        expect(visible).toBe(expectedVisible)
      }),
      { numRuns: 200 }
    )
  })

  it('Edit button hidden for warrior role regardless of onSaveCompany', () => {
    fc.assert(
      fc.property(arbOnSaveCompanyDefined, (onSaveCompanyDefined) => {
        const visible = isEditButtonVisible('warrior', onSaveCompanyDefined)

        expect(visible).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('Edit button hidden when onSaveCompany is undefined regardless of role', () => {
    fc.assert(
      fc.property(arbRole, (role) => {
        const visible = isEditButtonVisible(role, false)

        expect(visible).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('Edit button visible for all hero roles when onSaveCompany is defined', () => {
    fc.assert(
      fc.property(fc.constantFrom<MemberRole>(...HERO_ROLES), (role) => {
        const visible = isEditButtonVisible(role, true)

        expect(visible).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
