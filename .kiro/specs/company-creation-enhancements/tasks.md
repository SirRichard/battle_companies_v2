# Implementation Plan: Company Creation Enhancements

## Overview

Four targeted improvements to the company creation wizard: full path rule text, equipment info icons, envenom weapon parameterised purchase, and gold confirmation suppression. All changes modify existing React components with minimal data model impact.

## Tasks

- [x] 1. Remove path special rule truncation
  - [x] 1.1 Remove 120-character truncation in PathCardSelector
    - In `src/components/common/PathCardSelector.tsx`, locate the `uniqueRules` rendering section
    - Remove the ternary `rule.description.length > 120 ? rule.description.slice(0, 120) + '…' : rule.description`
    - Render `rule.description` directly without truncation
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Write property test for path special rules completeness
    - **Property 1: Path special rules completeness**
    - Create `src/components/common/__tests__/pathSpecialRulesCompleteness.property.test.ts`
    - For any path, `getUniqueRules(path)` returns exactly progression entries where roll ∈ {2,3,11,12} with label+description, each description being full untruncated text
    - **Validates: Requirements 1.1, 1.3**

- [x] 2. Add equipment info icons with popover in StepGoldEquipment
  - [x] 2.1 Add info icon and popover to EquipmentTabContent
    - In `src/components/wizard/StepGoldEquipment.tsx`, import `InfoOutlined` icon and `Popover` from MUI
    - Add state `infoAnchor: { el: HTMLElement; description: string } | null` to `EquipmentTabContent`
    - For each equipment item with a `description` field, render an `IconButton` with `InfoOutlined` next to the label
    - On press, open MUI `Popover` anchored to icon showing full description text
    - Items without `description` field render no icon
    - Popover dismissed by clicking outside
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Envenom Weapon parameterised purchase
  - [x] 4.1 Add parseGoldEntry and goldCost update
    - In `src/components/wizard/StepGoldEquipment.tsx`, add `parseGoldEntry(entry: string): { itemId: string; parameter?: string }` helper that splits on `::` delimiter
    - Update `goldCost()` to call `parseGoldEntry` and use `itemId` for cost lookup
    - Update `wargearLabel()` to detect `envenom_weapon::weaponId` pattern and display as "Envenom Weapon (WeaponLabel)"
    - _Requirements: 3.3, 3.4_

  - [x] 4.2 Add weapon selection dialog to EquipmentTabContent
    - Add state for envenom dialog open + target member
    - Define `NON_WEAPON_CATEGORIES` set: `armour_1, armour_2, armour_3, armour_4, mount, shield, special`
    - Implement `getMemberWeapons(baseUnitId, memberEquipment)` filtering combined equipment to weapon/bow/throwing categories
    - When user clicks Buy on `envenom_weapon`, open dialog showing eligible weapons
    - Parse existing purchases for `envenom_weapon::*` entries to exclude already-envenomed weapons
    - On weapon select → call `onBuy(member, "envenom_weapon::<weaponId>")`
    - On cancel → no state change
    - If no eligible weapons exist, disable Buy button for envenom_weapon
    - _Requirements: 3.1, 3.2, 3.5, 3.7_

  - [x] 4.3 Write property test for envenom weapon eligibility
    - **Property 2: Envenom weapon options are valid weapons minus already-envenomed**
    - Extend or create `src/pages/__tests__/envenomWeaponEligibility.property.test.ts`
    - For any member with any combination of equipment, available envenom targets = weapons ∩ ¬already-envenomed
    - **Validates: Requirements 3.2, 3.5**

  - [x] 4.4 Write property test for parameterised purchase round-trip
    - **Property 3: Parameterised purchase round-trip**
    - Create `src/pages/__tests__/parameterisedPurchaseRoundTrip.property.test.ts`
    - For any valid weapon ID, encoding as `"envenom_weapon::<weaponId>"` then parsing recovers both item ID and parameter
    - **Validates: Requirements 3.3**

  - [x] 4.5 Write property test for envenom display label format
    - **Property 4: Envenom display label format**
    - Create `src/pages/__tests__/envenomDisplayLabel.property.test.ts`
    - For any weapon ID in wargear data, formatted label matches `"Envenom Weapon (<label>)"`
    - **Validates: Requirements 3.4**

- [x] 5. Update MemberDetailsDrawer for parameterised envenom display
  - [x] 5.1 Format envenom entries in wargear/equipment display
    - In `src/components/common/MemberDetailsDrawer.tsx`, detect `"envenom_weapon::<weaponId>"` pattern in member equipment
    - Display as "Envenom Weapon (WeaponLabel)" using `getWargearLabel(weaponId)`
    - Handle fallback for invalid/missing weapon IDs gracefully
    - _Requirements: 3.4_

- [x] 6. Update companyFactory to handle parameterised envenom purchases
  - [x] 6.1 Parse parameterised goldPurchases in buildStartingMembers
    - In `src/services/company/companyFactory.ts`, when processing `goldPurchases[tempId]` entries:
    - Detect `"envenom_weapon::<weaponId>"` pattern
    - Add `"envenom_weapon"` to member's `equipment` array (or `ownedEquipment`)
    - Add `{ id: "poisoned_attacks", parameter: "<weaponId>" }` to member's `specialRules`
    - Plain entries continue to be added to `equipment` as before
    - _Requirements: 3.3, 3.6_

  - [x] 6.2 Write property test for cross-system envenom exclusion
    - **Property 7: Cross-system envenom exclusion**
    - Create `src/services/company/__tests__/crossSystemEnvenomExclusion.property.test.ts`
    - For any member with envenomed weapon via gold purchase, that weapon excluded from ATO envenom options
    - **Validates: Requirements 3.6**

- [x] 7. Suppress gold confirmation dialog when goldRemaining === 0
  - [x] 7.1 Update handleFinish in CreateCompanyPage
    - In `src/pages/CreateCompanyPage.tsx`, modify `handleFinish` callback
    - Add `goldRemaining() > 0` condition to the existing check
    - When `goldRemaining === 0`, call `doFinish()` directly without showing `ConfirmDialog`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Write property test for gold confirmation dialog condition
    - **Property 5: Gold confirmation dialog shown iff unspent gold exists**
    - Create `src/pages/__tests__/goldConfirmDialogCondition.property.test.ts`
    - For any wizard state at gold step with company gold > 0, dialog shown iff goldRemaining > 0
    - **Validates: Requirements 4.1, 4.2**

  - [x] 7.3 Write property test for gold remaining calculation
    - **Property 6: Gold remaining calculation invariant**
    - Create `src/pages/__tests__/goldRemainingCalculation.property.test.ts`
    - For any set of gold purchases, goldRemaining = company.gold - Σ goldCost(entry)
    - **Validates: Requirements 4.3**

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document
- `::` delimiter encoding avoids WizardState interface changes
- All changes are TypeScript/React modifications to existing components
