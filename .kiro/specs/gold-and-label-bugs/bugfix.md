# Bugfix Requirements Document

## Introduction

Two bugs in the company creation and match tracking flows:

1. **Gold remaining off-by-one**: During company creation, the gold step displays "Gold Remaining 0" but clicking "Form Company" triggers a confirmation dialog claiming there is still 1 gold remaining. The root cause is that `CreateCompanyPage.goldRemaining()` uses a different (incorrect) cost calculation than `StepGoldEquipment.goldCost()` — it only checks `wargearData` and falls back to `1` for equipment/creature items and parameterised entries like `envenom_weapon::weapon_id`.

2. **Envenom weapon display in MemberDetailsDrawer**: When an envenom weapon is permanently purchased with gold during company creation, the member's details drawer does not show it as an equipment item "Envenom Weapon (weapon_label)". Instead, it appears under special rules as "Poisoned Attacks (wargear_ID)" — showing the raw ID rather than the weapon's label. Additionally, the envenom weapon does not appear in the CompanyDetails > Store > Equipment tab for that member.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user purchases equipment items (from equipment.json) or creatures during the gold step AND the displayed gold remaining reaches 0 THEN the system incorrectly reports gold remaining > 0 in the "Form Company" confirmation dialog because `CreateCompanyPage.goldRemaining()` only looks up costs in `wargearData` (falling back to 1 for unrecognised items) while the display uses `StepGoldEquipment.goldCost()` which correctly checks wargear, equipment, and creatures data

1.2 WHEN a user purchases parameterised items stored as `itemId::parameter` (e.g. `envenom_weapon::sword`) during the gold step THEN the system calculates cost as 1 (the fallback) instead of the item's actual rating because `CreateCompanyPage.goldRemaining()` searches for the full `envenom_weapon::sword` string in wargearData which yields no match

1.3 WHEN a member permanently owns an envenom weapon (stored as `envenom_weapon::weapon_id` in their equipment array) AND that member's details are viewed in the MemberDetailsDrawer THEN the system displays it under special rules as "Poisoned Attacks (wargear_ID)" instead of showing it as an equipment item "Envenom Weapon (weapon_label)"

1.4 WHEN a member permanently owns an envenom weapon AND the CompanyDetails Store Equipment tab is viewed THEN the envenom weapon does not appear in the equipment list for that member

### Expected Behavior (Correct)

2.1 WHEN a user purchases any item (wargear, equipment, or creature) during the gold step THEN the system SHALL calculate gold remaining identically in both the display (`StepGoldEquipment`) and the validation (`CreateCompanyPage.goldRemaining()`), using the same cost resolution logic

2.2 WHEN a user purchases parameterised items stored as `itemId::parameter` THEN the system SHALL parse the entry to extract the base item ID and calculate cost based on that item's rating from the appropriate data source (wargear.json or equipment.json)

2.3 WHEN a member permanently owns an envenom weapon (stored as `envenom_weapon::weapon_id` in their equipment array) AND that member's details are viewed in the MemberDetailsDrawer THEN the system SHALL display it as an equipment item with label "Envenom Weapon (<weapon label>)" where `<weapon label>` is the human-readable label from wargear.json — NOT as a special rule

2.4 WHEN a member permanently owns an envenom weapon AND the CompanyDetails Store Equipment tab is viewed THEN the envenom weapon SHALL appear in the equipment list for that member with label "Envenom Weapon (<weapon label>)"

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has genuinely unspent gold remaining (gold remaining > 0 in both display and validation) THEN the system SHALL CONTINUE TO show the confirmation dialog warning about unspent gold

3.2 WHEN a user has spent all gold (gold remaining = 0 in both display and validation) THEN the system SHALL CONTINUE TO proceed directly to company creation without showing the unspent gold warning

3.3 WHEN equipment entries are plain IDs (not parameterised with `::`) THEN the system SHALL CONTINUE TO display them using their label from wargear.json via `getWargearLabel()`

3.4 WHEN toolkit items with a separate `parameter` field are displayed in the match tracking page THEN the system SHALL CONTINUE TO display them correctly via `getToolkitItemLabel()`
