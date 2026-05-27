# Gold and Label Bugs — Bugfix Design

## Overview

Two related bugs in the company creation and match tracking flows stem from inconsistent handling of parameterised item entries (format `itemId::parameter`):

1. **Gold remaining off-by-one**: `CreateCompanyPage.goldRemaining()` only looks up costs in `wargearData` with a fallback of `1` for unrecognised items, while `StepGoldEquipment.goldCost()` correctly resolves costs across wargear, equipment, and creatures data. This causes a mismatch where the gold step UI shows 0 remaining but the "Form Company" validation thinks there is still gold left.

2. **Envenom weapon display in MemberDetailsDrawer**: When an envenom weapon is permanently purchased with gold, the `MemberDetailsDrawer` does not display it as an equipment item. Instead, the `envenom_weapon::weapon_id` entry gets processed through the special rules system, appearing as "Poisoned Attacks (wargear_ID)" under special rules rather than "Envenom Weapon (weapon_label)" under wargear. Additionally, the CompanyDetails Store Equipment tab does not list the envenom weapon for that member.

The fix is to align `CreateCompanyPage.goldRemaining()` with the existing correct implementation in `StepGoldEquipment.goldCost()`, and to ensure `MemberDetailsDrawer` and CompanyDetails Store recognize `envenom_weapon::weapon_id` entries as equipment items displayed with proper labels.

## Glossary

- **Bug_Condition (C)**: The condition that triggers either bug — purchasing equipment/creature items or parameterised entries during gold step (Bug 1), or viewing a member with a permanently purchased envenom weapon in MemberDetailsDrawer or Store Equipment tab (Bug 2)
- **Property (P)**: Gold remaining calculation matches between display and validation (Bug 1); envenom weapon displays as equipment "Envenom Weapon (weapon_label)" not as special rule "Poisoned Attacks (wargear_ID)" (Bug 2)
- **Preservation**: Existing wargear cost lookups, plain-ID label display, toolkit item display, gold confirmation dialog behaviour, and ATO kit envenom weapon display must remain unchanged
- **goldRemaining()**: The function in `src/pages/CreateCompanyPage.tsx` that calculates unspent gold for the "Form Company" validation check
- **goldCost()**: The exported function in `src/components/wizard/StepGoldEquipment.tsx` that correctly resolves item cost across all data sources
- **getWargearLabel()**: The function in `src/utils/labels.ts` that resolves a wargear ID to its human-readable label
- **parseGoldEntry()**: The exported function in `StepGoldEquipment.tsx` that splits `itemId::parameter` into `{ itemId, parameter }`

## Bug Details

### Bug Condition

The bugs manifest when:
1. A user purchases equipment items (from equipment.json), creatures, or parameterised entries like `envenom_weapon::sword` during the gold step — the validation uses a different cost calculation than the display.
2. A member permanently owns an envenom weapon (stored as `envenom_weapon::weapon_id` in their equipment array) and their details are viewed in MemberDetailsDrawer or CompanyDetails Store Equipment tab.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { context: "gold_calculation" | "label_display", entry: string }
  OUTPUT: boolean

  IF input.context == "gold_calculation" THEN
    parsed := parseEntry(input.entry)
    RETURN NOT existsInWargearData(parsed.itemId)
           OR (parsed.parameter IS NOT NULL)
  END IF

  IF input.context == "label_display" THEN
    RETURN input.entry CONTAINS "::"
  END IF

  RETURN false
END FUNCTION
```

### Examples

- User purchases `backpack` (equipment, rating 2): gold step shows cost 2, but `goldRemaining()` finds no wargear match and uses fallback cost 1 → off-by-one
- User purchases `envenom_weapon::sword` (parameterised): gold step shows cost 1 (correct from equipment.json), but `goldRemaining()` searches for literal `envenom_weapon::sword` in wargear → no match → fallback 1 (happens to be correct by accident for this item, but wrong for higher-cost equipment)
- User purchases a creature `wild_warg` (pointsCost 8): gold step shows cost 8, but `goldRemaining()` finds no wargear match → fallback 1 → off-by-seven
- Member equipment contains `envenom_weapon::sword`: MemberDetailsDrawer processes it through special rules system → shows "Poisoned Attacks (sword)" under Special Rules instead of "Envenom Weapon (Sword)" under Wargear. CompanyDetails Store Equipment tab doesn't list it at all.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Plain wargear ID lookups (e.g. `bow`, `shield`) must continue to resolve correctly in both cost and label functions
- The gold confirmation dialog must still appear when gold is genuinely unspent (gold remaining > 0 in both display and validation)
- The gold confirmation dialog must NOT appear when gold is fully spent (gold remaining = 0)
- Toolkit items with a separate `parameter` field displayed via `getToolkitItemLabel()` in MatchTrackingPage must continue to work
- `StepGoldEquipment.goldCost()` and `StepGoldEquipment.wargearLabel()` must continue to work correctly (they are already correct)

**Scope:**
All inputs that do NOT involve equipment/creature cost lookups or `::` parameterised label display should be completely unaffected by this fix. This includes:
- Standard wargear purchases (items found in wargear.json)
- Label display for plain IDs (no `::` separator)
- All other wizard steps and match tracking functionality

## Hypothesized Root Cause

Based on the code analysis, the root causes are confirmed:

1. **Gold Calculation Mismatch**: `CreateCompanyPage.goldRemaining()` (line ~530) implements its own inline cost lookup that only searches `wargearData` and falls back to `1`. It does not:
   - Parse `itemId::parameter` entries to extract the base item ID
   - Check `equipmentData` for equipment items
   - Check `creaturesData` for creature items
   
   Meanwhile, `StepGoldEquipment.goldCost()` correctly handles all three data sources and parses parameterised entries.

2. **Envenom Weapon Display Bug**: The `MemberDetailsDrawer` component builds its wargear list from `allWargear = Array.from(new Set([...baseEquip, ...assignedEquip]))`. The `envenom_weapon::sword` entry is included in `assignedEquip` (from `member.equipment`), but when the drawer renders wargear chips, it calls `formatWargearEntry(eq)` which already handles the `envenom_weapon::` prefix correctly (producing "Envenom Weapon (Sword)"). 
   
   However, the actual issue is that the envenom weapon's `grantsSpecialRules` (["poisoned_attacks"]) gets processed by the special rules section. The equipment entry `envenom_weapon` in equipment.json has `grantsSpecialRules: ["poisoned_attacks"]` with the weapon parameter. When the company is formed, the system likely adds "Poisoned Attacks" with the weapon ID as a parameterised special rule to `member.specialRules`, AND the `envenom_weapon::weapon_id` entry may not be properly included in the member's equipment array that the drawer reads.
   
   The root cause needs investigation: either (a) the envenom weapon entry is not being stored in `member.equipment` at all (only the special rule is added), or (b) it IS in `member.equipment` but the wargear display logic filters it out because it doesn't match any entry in `wargearData` or `baseEquipment`.

3. **Store Equipment Tab**: The CompanyDetails Store Equipment tab likely filters equipment items by checking against known equipment/wargear IDs, and `envenom_weapon::sword` doesn't match any plain ID in the lookup.

3. **Duplication of Logic**: The gold cost calculation was duplicated rather than reusing the already-correct `goldCost()` export from `StepGoldEquipment.tsx`. This is the fundamental design issue.

## Correctness Properties

Property 1: Bug Condition - Gold Remaining Consistency

_For any_ set of gold purchases containing equipment items, creature items, or parameterised entries (where isBugCondition returns true for context "gold_calculation"), the `CreateCompanyPage.goldRemaining()` function SHALL return the same value as computing `company.gold - sum(StepGoldEquipment.goldCost(entry) for entry in allPurchases)`.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Envenom Weapon Display as Equipment

_For any_ member whose equipment array contains an entry in the format `envenom_weapon::weapon_id`, the MemberDetailsDrawer SHALL display it as a wargear chip with label "Envenom Weapon (<weapon label>)" and SHALL NOT display it as a special rule "Poisoned Attacks (weapon_id)". The CompanyDetails Store Equipment tab SHALL also list it with the correct label.

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - Plain ID Behavior

_For any_ input where the bug condition does NOT hold (plain wargear IDs without `::`, items that exist in wargear.json), the fixed functions SHALL produce the same results as the original functions, preserving all existing cost calculations and label displays.

**Validates: Requirements 3.1, 3.3**

Property 4: Preservation - Gold Confirmation Dialog

_For any_ company creation where gold is genuinely unspent (gold remaining > 0 consistently), the confirmation dialog SHALL still appear. Where gold is fully spent (gold remaining = 0), the dialog SHALL NOT appear.

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/CreateCompanyPage.tsx`

**Function**: `goldRemaining()`

**Specific Changes**:
1. **Import goldCost from StepGoldEquipment**: Add import of the already-correct `goldCost` function
2. **Replace inline cost calculation**: Replace the inline wargear-only lookup with a call to `goldCost(entry)` for each purchased item
3. **Remove redundant wargear data usage**: The local `wg` variable and manual lookup become unnecessary

**File**: `src/utils/labels.ts`

**Function**: `getWargearLabel()`

**Specific Changes**:
1. **Parse parameterised entries**: Check if the input contains `::` and split into base ID and parameter
2. **Handle envenom_weapon specifically**: When base ID is `envenom_weapon`, resolve the parameter as a weapon label and format as "Envenom Weapon (<weapon label>)"
3. **Fallback for other parameterised entries**: For any other `baseId::parameter` format, resolve base label and parameter label separately and format as "Base Label (Parameter Label)"

**File**: `src/components/common/MemberDetailsDrawer.tsx`

**Specific Changes**:
1. **Ensure envenom_weapon::weapon_id entries appear in wargear section**: The `formatWargearEntry()` function already handles the `envenom_weapon::` prefix correctly. Verify the entry is included in `allWargear` and rendered as a chip.
2. **Prevent duplicate display as special rule**: If `envenom_weapon::weapon_id` is in equipment, ensure "Poisoned Attacks (weapon_id)" is NOT separately shown under special rules (or if it is, it should show the weapon label not ID).

**File**: `src/pages/CompanyDetailsPage.tsx`

**Specific Changes**:
1. **Store Equipment tab**: Ensure `envenom_weapon::weapon_id` entries are recognized and displayed in the equipment list with proper label formatting via `formatWargearEntry()` or equivalent.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that exercise `goldRemaining()` with equipment/creature/parameterised purchases and compare against `goldCost()`. Write tests that pass `envenom_weapon::sword` to `getWargearLabel()` and check the output format. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Equipment Cost Test**: Purchase `backpack` (rating 2) — `goldRemaining()` will compute cost as 1 instead of 2 (will fail on unfixed code)
2. **Creature Cost Test**: Purchase a creature with pointsCost > 1 — `goldRemaining()` will compute cost as 1 (will fail on unfixed code)
3. **Parameterised Entry Cost Test**: Purchase `envenom_weapon::sword` — verify cost resolution uses base item ID (may pass by accident since envenom rating[0] is 1)
4. **Envenom Label Test**: Call `getWargearLabel("envenom_weapon::sword")` — will produce "Envenom Weapon::Sword" instead of "Envenom Weapon (Sword)" (will fail on unfixed code)

**Expected Counterexamples**:
- `goldRemaining()` returns a higher value than expected when equipment or creatures are purchased (cost underestimated due to fallback of 1)
- `getWargearLabel("envenom_weapon::sword")` returns "Envenom Weapon::Sword" instead of "Envenom Weapon (Sword)"

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL purchases WHERE isBugCondition(purchase, "gold_calculation") DO
  result := goldRemaining_fixed(purchases)
  expected := company.gold - SUM(goldCost(p) for p in allPurchases)
  ASSERT result == expected
END FOR

FOR ALL entry WHERE isBugCondition(entry, "label_display") DO
  result := getWargearLabel_fixed(entry)
  ASSERT result MATCHES "Envenom Weapon (<weapon_label>)"
  ASSERT result DOES NOT CONTAIN "::"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL purchases WHERE NOT isBugCondition(purchase, "gold_calculation") DO
  ASSERT goldRemaining_original(purchases) == goldRemaining_fixed(purchases)
END FOR

FOR ALL wargearId WHERE NOT isBugCondition(wargearId, "label_display") DO
  ASSERT getWargearLabel_original(wargearId) == getWargearLabel_fixed(wargearId)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (all wargear IDs, random purchase combinations)
- It catches edge cases that manual unit tests might miss (e.g. items with unusual rating formats)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for plain wargear purchases and label lookups, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Plain Wargear Cost Preservation**: Verify that all items in wargear.json still resolve to `rating[0]` cost in both old and new implementations
2. **Plain Wargear Label Preservation**: Verify that all plain IDs (no `::`) produce identical labels before and after fix
3. **Gold Dialog Preservation**: Verify confirmation dialog still triggers when gold > 0 and doesn't trigger when gold = 0
4. **Toolkit Label Preservation**: Verify `getToolkitItemLabel()` continues to work for items with separate `parameter` field

### Unit Tests

- Test `goldRemaining()` with equipment-only purchases (backpack, badge_of_courage, etc.)
- Test `goldRemaining()` with creature purchases
- Test `goldRemaining()` with parameterised entries (`envenom_weapon::sword`)
- Test `goldRemaining()` with mixed wargear + equipment + creature purchases
- Test `getWargearLabel()` with `envenom_weapon::sword`, `envenom_weapon::spear`
- Test `getWargearLabel()` with plain IDs (bow, shield, backpack)

### Property-Based Tests

- Generate random subsets of all purchasable items and verify `goldRemaining()` matches `gold - sum(goldCost(item))` for each
- Generate random wargear IDs from wargear.json and verify `getWargearLabel()` returns the same label as before the fix
- Generate random `envenom_weapon::X` entries where X is a valid weapon ID and verify label format is "Envenom Weapon (<label>)"

### Integration Tests

- Full company creation flow purchasing equipment items and verifying no spurious gold confirmation dialog
- Full company creation flow purchasing envenom weapon and verifying correct label in subsequent pages
- Match tracking page rendering members with envenom weapon entries and verifying correct display
