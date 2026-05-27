# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Gold Remaining Mismatch and Envenom Label Format
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: For Bug 1, scope property to equipment/creature purchases where `goldCost()` differs from inline wargear-only lookup. For Bug 2, scope to `getWargearLabel()` with `envenom_weapon::weapon_id` entries.
  - Bug 1 - Gold Calculation: For any set of gold purchases containing equipment items (from equipment.json) or creatures, assert that `goldRemaining()` in CreateCompanyPage returns the same value as `company.gold - sum(goldCost(entry))` from StepGoldEquipment
  - Bug 1 - isBugCondition: `NOT existsInWargearData(parsed.itemId) OR (parsed.parameter IS NOT NULL)` — items not in wargear.json or parameterised entries like `envenom_weapon::sword`
  - Bug 2 - Envenom Label: For any entry matching `envenom_weapon::weapon_id`, assert `getWargearLabel(entry)` returns format "Envenom Weapon (<weapon_label>)" where weapon_label is resolved from wargear.json — NOT containing "::" in output
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: e.g. `goldRemaining()` returns higher value than expected for equipment purchases (cost underestimated due to fallback of 1); `getWargearLabel("envenom_weapon::sword")` returns "Envenom Weapon::Sword" instead of "Envenom Weapon (Sword)"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Plain Wargear Cost and Label Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: For all plain wargear IDs (no `::` separator) in wargear.json, `getWargearLabel(id)` returns the label field from wargear.json on unfixed code
  - Observe: For all plain wargear purchases, `goldRemaining()` correctly uses `rating[0]` as cost (these already work correctly in both implementations)
  - Observe: Gold confirmation dialog triggers when goldRemaining > 0 and does not trigger when goldRemaining = 0
  - Write property-based test: for all plain wargear IDs (where isBugCondition returns false), `getWargearLabel(id)` produces same result before and after fix
  - Write property-based test: for all wargear-only purchase sets (items found in wargear.json), cost calculation matches between inline lookup and `goldCost()` — both use `rating[0]`
  - Write property-based test: gold confirmation dialog condition (`goldRemaining() > 0`) is preserved for wargear-only purchases
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for gold remaining off-by-one and envenom weapon display bugs

  - [x] 3.1 Fix goldRemaining() in CreateCompanyPage
    - Import `goldCost` from `../components/wizard/StepGoldEquipment`
    - Replace inline wargear-only cost lookup with call to `goldCost(entry)` for each purchased item
    - Remove redundant `wg` variable and manual wargear lookup logic
    - _Bug_Condition: isBugCondition(input) where NOT existsInWargearData(parsed.itemId) OR parsed.parameter IS NOT NULL_
    - _Expected_Behavior: goldRemaining() returns company.gold - sum(goldCost(entry) for entry in allPurchases) — identical to StepGoldEquipment display_
    - _Preservation: Plain wargear purchases (items in wargear.json) continue to resolve cost via rating[0]_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Fix getWargearLabel() in src/utils/labels.ts to handle :: format
    - Check if input contains `::` separator and split into base ID and parameter
    - When base ID is `envenom_weapon`, resolve parameter as weapon label from wargear.json and format as "Envenom Weapon (<weapon_label>)"
    - For other parameterised entries, resolve base label and parameter label separately
    - Plain IDs (no `::`) continue through existing lookup unchanged
    - _Bug_Condition: isBugCondition(input) where input.entry CONTAINS "::"_
    - _Expected_Behavior: getWargearLabel("envenom_weapon::sword") returns "Envenom Weapon (Sword)" — NOT "Envenom Weapon::Sword"_
    - _Preservation: Plain wargear IDs without "::" produce identical labels to before_
    - _Requirements: 1.3, 2.3, 2.4, 3.3_

  - [x] 3.3 Ensure MemberDetailsDrawer displays envenom weapons correctly
    - Verify `envenom_weapon::weapon_id` entries in member.equipment appear in wargear section via `formatWargearEntry()` (already handles prefix)
    - Ensure envenom weapons are NOT duplicated as special rules "Poisoned Attacks (weapon_id)" — filter out poisoned_attacks entries that correspond to envenom weapon equipment
    - Verify `getWargearLabel()` fix from 3.2 propagates to CompanyDetailsPage MemberRow wargear chips
    - _Bug_Condition: member.equipment contains "envenom_weapon::weapon_id" entry_
    - _Expected_Behavior: Displays as "Envenom Weapon (<weapon_label>)" in wargear section, NOT as "Poisoned Attacks (weapon_id)" in special rules_
    - _Preservation: Non-envenom special rules continue to display correctly_
    - _Requirements: 1.3, 2.3, 3.3_

  - [x] 3.4 Fix CompanyDetails Store Equipment tab to list envenom weapons
    - Ensure `envenom_weapon::weapon_id` entries are recognized in Store Equipment tab equipment list
    - Use `getWargearLabel()` (now fixed) or `formatWargearEntry()` for display label
    - _Bug_Condition: member.equipment contains "envenom_weapon::weapon_id" AND Store Equipment tab is viewed_
    - _Expected_Behavior: Envenom weapon appears in equipment list with label "Envenom Weapon (<weapon_label>)"_
    - _Preservation: Other equipment items continue to display correctly in Store tab_
    - _Requirements: 1.4, 2.4, 3.3_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Gold Remaining Consistency and Envenom Label Format
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Plain Wargear Cost and Label Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
