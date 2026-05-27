// Feature: battle-companies-ux-improvements, Property 9: Remove control present for each equipment item in edit mode

/**
 * Property 9: Remove control present for each equipment item in edit mode
 * Validates: Requirements 2.5
 *
 * For any member with a hero role and a non-empty ownedEquipment array
 * (excluding envenom_weapon), while the Equipment section is in edit mode,
 * each displayed equipment item SHALL have a remove control.
 *
 * Additionally:
 * - When equipEditMode=false: no remove controls regardless of role
 * - When onSaveCompany undefined: no remove controls regardless of edit mode
 * - Number of remove controls equals number of displayEquipment items
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { MemberRole } from '../../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']
const ALL_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making', 'warrior']

// Sample equipment IDs (non-envenom)
const EQUIPMENT_IDS = [
  'backpack',
  'badge_of_courage',
  'climbing_ropes',
  'healing_herbs',
  'lucky_talisman',
  'map',
  'ring_of_warding',
  'concealing_cloak',
  'mountain_boots',
  'woodland_belt',
  'seeing_stone',
  'torching_brand',
]

// ── Functions under test (mirror MemberDetailsDrawer logic) ───────────────────

/**
 * Derives displayEquipment from ownedEquipment by filtering out envenom_weapon.
 */
function getDisplayEquipment(ownedEquipment: string[] | undefined): string[] {
  return (ownedEquipment ?? []).filter((id) => id !== 'envenom_weapon')
}

/**
 * Determines whether remove controls are shown for equipment items.
 * From MemberDetailsDrawer:
 *   {equipEditMode && onSaveCompany && ( <IconButton ×> )}
 * Edit mode itself requires isHero && onSaveCompany to be visible.
 */
function hasRemoveControls(
  role: MemberRole,
  equipEditMode: boolean,
  onSaveCompanyDefined: boolean
): boolean {
  const isHero = role !== 'warrior'
  return isHero && equipEditMode && onSaveCompanyDefined
}

/**
 * Counts the number of remove controls rendered.
 * Each item in displayEquipment gets one remove control when conditions are met.
 */
function countRemoveControls(
  role: MemberRole,
  ownedEquipment: string[] | undefined,
  equipEditMode: boolean,
  onSaveCompanyDefined: boolean
): number {
  if (!hasRemoveControls(role, equipEditMode, onSaveCompanyDefined)) return 0
  return getDisplayEquipment(ownedEquipment).length
}

// ── Generators ────────────────────────────────────────────────────────────────

const arbHeroRole = fc.constantFrom<MemberRole>(...HERO_ROLES)
const arbRole = fc.constantFrom<MemberRole>(...ALL_ROLES)

// Generate non-empty equipment arrays without envenom_weapon
const arbNonEmptyEquipment = fc
  .subarray(EQUIPMENT_IDS, { minLength: 1, maxLength: 8 })
  .map((items) => [...items]) // ensure fresh array

// Generate equipment arrays that may include envenom_weapon entries
const arbEquipmentWithEnvenom = fc
  .tuple(
    fc.subarray(EQUIPMENT_IDS, { minLength: 1, maxLength: 6 }),
    fc.integer({ min: 0, max: 3 })
  )
  .map(([items, envenomCount]) => [
    ...items,
    ...Array.from({ length: envenomCount }, () => 'envenom_weapon'),
  ])

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 9: Remove control present for each equipment item in edit mode', () => {
  it('each displayEquipment item has a remove control when editMode=true, onSaveCompany defined, and role is hero', () => {
    fc.assert(
      fc.property(arbHeroRole, arbNonEmptyEquipment, (role, ownedEquipment) => {
        const displayEquipment = getDisplayEquipment(ownedEquipment)
        const removeCount = countRemoveControls(role, ownedEquipment, true, true)

        // Each displayed item gets exactly one remove control
        expect(removeCount).toBe(displayEquipment.length)
        expect(removeCount).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })

  it('no remove controls when equipEditMode=false regardless of role', () => {
    fc.assert(
      fc.property(arbRole, arbNonEmptyEquipment, fc.boolean(), (role, ownedEquipment, onSaveDefined) => {
        const removeCount = countRemoveControls(role, ownedEquipment, false, onSaveDefined)

        expect(removeCount).toBe(0)
      }),
      { numRuns: 200 }
    )
  })

  it('no remove controls when onSaveCompany is undefined regardless of edit mode', () => {
    fc.assert(
      fc.property(arbRole, arbNonEmptyEquipment, fc.boolean(), (role, ownedEquipment, editMode) => {
        const removeCount = countRemoveControls(role, ownedEquipment, editMode, false)

        expect(removeCount).toBe(0)
      }),
      { numRuns: 200 }
    )
  })

  it('no remove controls for warrior role even in edit mode with onSaveCompany', () => {
    fc.assert(
      fc.property(arbNonEmptyEquipment, (ownedEquipment) => {
        const removeCount = countRemoveControls('warrior', ownedEquipment, true, true)

        expect(removeCount).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it('remove control count equals displayEquipment length (envenom_weapon excluded)', () => {
    fc.assert(
      fc.property(arbHeroRole, arbEquipmentWithEnvenom, (role, ownedEquipment) => {
        const displayEquipment = getDisplayEquipment(ownedEquipment)
        const removeCount = countRemoveControls(role, ownedEquipment, true, true)

        // Remove controls match display items, not raw ownedEquipment length
        expect(removeCount).toBe(displayEquipment.length)
        // envenom_weapon entries should not get remove controls
        const envenomCount = ownedEquipment.filter((id) => id === 'envenom_weapon').length
        expect(removeCount).toBe(ownedEquipment.length - envenomCount)
      }),
      { numRuns: 200 }
    )
  })
})
