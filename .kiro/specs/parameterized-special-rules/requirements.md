# Requirements Document

## Introduction

When a parameterised special rule is selected during postmatch advancement (minor special rule picker or path progression), the system must prompt the player to provide the required parameter value. Currently, `applySpecialRule` stores only a plain label string, ignoring the `parameterised` flag and `parameter_type` metadata in `specialRules.json`. This feature adds parameter collection UI for two specific rules:

- **Combat Synergy (X)** — requires selecting a friendly hero from the company (not the receiving member)
- **Poisoned Attacks (X)** — requires selecting a weapon the receiving member owns

The member model already supports `{ id, parameter }` objects in `specialRules`, and `resolveParameterisedLabel` already resolves display labels. The gap is in the postmatch advancement flow where parameterised rules are selected but no parameter is collected or stored.

## Glossary

- **PostMatch_Summary_Page**: The page rendered after a match ends, containing injury resolution, progression/advancement, and influence steps
- **Minor_Rule_Picker**: The UI within the advancement step that displays selectable minor special rules as chips
- **Parameterised_Rule**: A special rule entry in `specialRules.json` where `parameterised` is `true` and `parameter_type` specifies what kind of value is needed
- **Parameter_Selector**: A new sub-UI that appears after a parameterised rule is selected, prompting the player to provide the required parameter value
- **Receiving_Member**: The company member who is gaining the special rule through advancement
- **Company_Member**: Any member in the company's `members` array
- **Wargear**: Items in a member's `equipment` array, sourced from `wargear.json`

## Requirements

### Requirement 1: Detect Parameterised Rule Selection

**User Story:** As a player, I want the system to recognise when I select a parameterised special rule during advancement, so that I am prompted to provide the required parameter.

#### Acceptance Criteria

1. WHEN a player selects a minor special rule with `parameterised: true` in the Minor_Rule_Picker, THE PostMatch_Summary_Page SHALL display the Parameter_Selector corresponding to that rule's `parameter_type` field before allowing confirmation
2. WHILE the Parameter_Selector is displayed, THE PostMatch_Summary_Page SHALL disable the confirm/apply button until the player has chosen a non-empty parameter value that matches the expected `parameter_type` (e.g., a member name for `friendly_hero`, a keyword string for `target_keyword`, a positive integer for `integer` or `target_integer`, a distance value for `distance`, or an equipment label for `weapon`)
3. WHEN a player deselects or changes the selected parameterised rule before confirming, THE PostMatch_Summary_Page SHALL clear any previously chosen parameter value and hide or replace the Parameter_Selector
4. IF the selected rule's `parameter_type` is `friendly_hero`, THEN THE Parameter_Selector SHALL present only company members other than the Receiving_Member as selectable options

### Requirement 2: Combat Synergy Parameter Collection

**User Story:** As a player, I want to select which friendly hero benefits from Combat Synergy, so that the rule is stored with the correct target.

#### Acceptance Criteria

1. WHEN "Combat Synergy (X)" is selected, THE Parameter_Selector SHALL display a list of all Company_Members with a hero role (leader, sergeant, or hero_in_making) excluding the Receiving_Member, showing each eligible member by their `name` field
2. WHILE the Parameter_Selector is displayed for Combat Synergy, THE Parameter_Selector SHALL allow the player to select exactly one Company_Member from the list
3. WHEN the player selects a Company_Member from the list, THE Parameter_Selector SHALL store that member's ID as the parameter value
4. IF no eligible Company_Members exist (Receiving_Member is the only hero), THEN THE Parameter_Selector SHALL display a message indicating no valid targets are available and prevent confirmation
5. IF eligible Company_Members become ineligible while the Parameter_Selector is already open (e.g., removed from the company during the same session), THEN THE Parameter_Selector SHALL close immediately and display the "no valid targets" message

### Requirement 3: Poisoned Attacks Parameter Collection

**User Story:** As a player, I want to select which weapon gains Poisoned Attacks, so that the rule is stored with the correct weapon reference.

#### Acceptance Criteria

1. WHEN "Poisoned Attacks (X)" is selected, THE Parameter_Selector SHALL display a list of wargear items from the Receiving_Member's combined wargear (base unit `baseWargear` merged with the member's `equipment` array, deduplicated) that have a category of "weapon", "bow", or "throwing" in `wargear.json`, excluding any weapons that already have a Poisoned Attacks rule assigned to them for this member
2. THE Parameter_Selector SHALL display each eligible weapon by its `label` field from `wargear.json`
3. WHEN the player selects a weapon from the list, THE Parameter_Selector SHALL store that wargear `id` as the parameter value in the format `{ id: "poisoned_attacks", parameter: "<weapon_id>" }`
4. IF the Receiving_Member has no eligible weapons (no items matching eligible categories exist, or all eligible weapons already have Poisoned Attacks assigned), THEN THE Parameter_Selector SHALL display a message indicating no weapons are available and SHALL prevent confirmation regardless of message display state
5. WHEN exactly one eligible weapon exists in the list, THE Parameter_Selector SHALL still display the list with that single option and require explicit player selection before confirmation

### Requirement 4: Store Parameterised Rule as Object

**User Story:** As a player, I want parameterised rules stored correctly, so that they display with the resolved parameter value throughout the app.

#### Acceptance Criteria

1. WHEN a parameterised rule is confirmed with a parameter value, THE PostMatch_Summary_Page SHALL store the rule in the Receiving_Member's `specialRules` array as `{ id: "<rule_id>", parameter: "<parameter_value>" }` (where parameter is of type `string | number`) instead of a plain label string
2. WHEN a parameterised rule is confirmed with a parameter value, THE PostMatch_Summary_Page SHALL subtract 5 XP from the Receiving_Member (floored at 0) after storing the structured rule object
3. IF the Receiving_Member's `specialRules` array already contains an object with the same `id` and same `parameter` value, THEN THE PostMatch_Summary_Page SHALL not add a duplicate entry and SHALL not subtract XP
4. WHEN a parameterised rule is already stored on the Receiving_Member as an object with a given `id` and `parameter`, THE Minor_Rule_Picker SHALL exclude that rule from the selectable list by matching on the `id` field of stored objects

### Requirement 5: Duplicate Prevention for Parameterised Rules

**User Story:** As a player, I want the system to prevent me from selecting a parameterised rule I already have with the same parameter, so that I don't waste advancement choices.

#### Acceptance Criteria

1. WHEN filtering available minor rules, THE Minor_Rule_Picker SHALL treat a parameterised rule as "already owned" only if the Receiving_Member's `specialRules` array contains an object entry with matching `id` AND a `parameter` value that is an exact, case-sensitive match
2. IF the Receiving_Member has a parameterised rule with the same `id` but a different `parameter` value, THEN THE Minor_Rule_Picker SHALL include that rule in the selectable list
3. WHEN filtering available minor rules, THE Minor_Rule_Picker SHALL treat a non-parameterised rule as "already owned" if the Receiving_Member's `specialRules` array contains a plain string entry matching that rule's `id`
4. IF the Receiving_Member's `specialRules` array contains a plain string entry whose value matches a parameterised rule's `id`, THEN THE Minor_Rule_Picker SHALL treat that as ownership and exclude the parameterised rule from the selectable list (any matching ID regardless of entry type prevents selection)
