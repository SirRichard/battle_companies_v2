# Requirements Document

## Introduction

Implement enforcement of company special rules that exist in `companies.json` data but lack corresponding application logic. Nine rules across eight companies need code-level enforcement covering reinforcement constraints, limit exemptions, automatic promotions, profile swaps, roster slot overrides, and injury table routing.

## Glossary

- **Reinforcement_Engine**: Logic in CompanyDetailsPage that rolls on reinforcement tables, validates limits, and adds new members to roster.
- **Progression_Engine**: Logic in PostMatchSummaryPage that handles warrior advancement rolls (1-6) and hero path progression.
- **Limit_Checker**: Functions (`wouldExceedBowLimit`, `wouldExceedThrowingLimit`, `wouldExceedCavalryLimit`) that validate weapon/mount ratios before confirming recruitment.
- **Company_Definition**: Static JSON structure defining a company's rules, tables, advancements, and special rules.
- **Member**: A single model on the company roster with baseUnitId, role, equipment, and stats.
- **Hero_In_The_Making**: Warrior promotion to hero status (roll 6 on warrior progression), granting 1 Might, 1 Will, 1 Fate.
- **Roster_Slot**: One position in the company's member count toward `maxCompanySize`.
- **Base_Unit_Id**: Unique identifier for a unit profile (e.g., `ranger_of_arnor`, `ranger_of_the_north`).
- **Keyword**: A tag on a base unit (e.g., "Elf", "Dwarf", "Dale") used for rule filtering.
- **Substitution**: Mechanism allowing a player to replace a reinforcement roll result with a specific unit under defined conditions.

## Requirements

### Requirement 1: Arnor Ranger Hero Promotion Profile Swap

**User Story:** As a player of Arnor, I want my Ranger of Arnor to automatically swap to a Ranger of the North profile when achieving Hero in the Making status, so that the company special rule is correctly enforced.

#### Acceptance Criteria

1. WHEN a Ranger of Arnor rolls 6 on warrior progression (Hero in the Making), THE Progression_Engine SHALL replace the member's baseUnitId with the `toBaseUnitId` from the matching `heroPromotionOnly` advancement entry.
2. WHEN the hero promotion profile swap occurs, THE Progression_Engine SHALL carry over only equipment listed in the advancement's `equipmentCarryOver` array (spear, if present on the member).
3. WHEN the hero promotion profile swap occurs, THE Progression_Engine SHALL discard armour from the member's equipment list.
4. WHEN the hero promotion profile swap occurs, THE Progression_Engine SHALL still grant 1 Might, 1 Will, 1 Fate and set role to `hero_in_making`.
5. IF no `heroPromotionOnly` advancement matches the member's `baseUnitId`, THEN THE Progression_Engine SHALL apply standard Hero in the Making logic (grant +1 Might, +1 Will, +1 Fate, set role to `hero_in_making`) without profile swap for all unit types.

### Requirement 2: We Stand Together Dwarf-Dale Ratio Enforcement

**User Story:** As a player of Defenders of the North, I want the app to prevent recruiting Dwarf models that would exceed the number of Dale models, so that the We Stand Together rule is enforced.

#### Acceptance Criteria

1. WHEN a reinforcement result would add a Dwarf-keyword model, THE Reinforcement_Engine SHALL verify the resulting Dwarf count does not exceed the Dale-keyword count.
2. IF adding the reinforcement would cause Dwarf count to exceed Dale count, THEN THE Reinforcement_Engine SHALL block confirmation and display a warning indicating the ratio violation.
3. WHEN the ratio would be violated, THE Reinforcement_Engine SHALL offer the player the option to choose any lower roll result from the reinforcement table.
4. THE Reinforcement_Engine SHALL count Dwarf and Dale models using the `keywords` array on each member's base unit definition.

### Requirement 3: Helm's Deep Elf Keyword Limit

**User Story:** As a player of Helm's Deep, I want the app to prevent recruiting Elf-keyword models beyond 33% of the company, so that the Elf limit rule is enforced.

#### Acceptance Criteria

1. WHEN a reinforcement result would add an Elf-keyword model, THE Reinforcement_Engine SHALL verify the resulting Elf-keyword count does not exceed 33% of total company size (including the new member).
2. IF adding the reinforcement would exceed the 33% Elf limit, THEN THE Reinforcement_Engine SHALL block confirmation and display a warning indicating the Elf limit violation.
3. THE Reinforcement_Engine SHALL count Elf models using the `keywords` array on each member's base unit definition, checking for the "Elf" keyword.

### Requirement 4: Whips Throwing Weapon Exemption

**User Story:** As a player of Sharkey's Rogues, I want whips to not count against the throwing weapon limit, so that the Whips special rule is enforced.

#### Acceptance Criteria

1. WHILE the company has the `whips` special rule, THE Limit_Checker SHALL exclude members whose only throwing-category equipment is a whip from the throwing weapon count.
2. WHEN calculating throwing weapon ratio, THE Limit_Checker SHALL read a `throwingExemptions` list (containing `"whip"`) from the company special rule data.
3. THE Limit_Checker SHALL apply throwing exemptions using the same pattern as existing `limitExemptions.bow` and `limitExemptions.cavalry` exemptions (equipment-id-based filtering).

### Requirement 5: Company of Heroes Auto-Promotion

**User Story:** As a player of Wanderers in the Wild, I want all newly recruited reinforcements to automatically become Heroes in the Making, so that the Company of Heroes rule is enforced.

#### Acceptance Criteria

1. WHEN a new member is added via reinforcement to a company with the `company_of_heroes` rule, THE Reinforcement_Engine SHALL automatically apply Hero in the Making status (role = `hero_in_making`, +1 Might, +1 Will, +1 Fate).
2. WHEN auto-promoting a new recruit, THE Reinforcement_Engine SHALL trigger path selection for the newly promoted hero before finalizing recruitment.
3. THE Reinforcement_Engine SHALL apply auto-promotion after all limit checks pass and the member is confirmed for addition.

### Requirement 6: Led By the Ranger Substitution

**User Story:** As a player of The Shire, I want to be able to swap any successful reinforcement roll for a Ranger of the North when my existing Ranger has been slain, so that the Led By the Ranger rule is enforced.

#### Acceptance Criteria

1. WHEN the company has the `led_by_the_ranger` rule AND no living member has `baseUnitId` of `ranger_of_the_north`, THE Reinforcement_Engine SHALL offer a substitution option on any successful roll (2-6).
2. WHEN the player accepts the substitution, THE Reinforcement_Engine SHALL replace the rolled result with a Ranger of the North unit.
3. WHEN the substituted Ranger of the North is added, THE Reinforcement_Engine SHALL prompt the player to assign the role of Leader or Sergeant to the new member.
4. IF the company already has a living member with `baseUnitId` of `ranger_of_the_north`, THEN THE Reinforcement_Engine SHALL NOT offer the substitution (limit of 1).
5. THE Reinforcement_Engine SHALL read the `substitution` field from the company special rule, using `condition.unitSlain`, `minRoll`, `limit`, and `heroRoleOptions` to drive behavior.

### Requirement 7: Khandish Horsemen Bow Limit Exemption

**User Story:** As a player of Grand Army of the South, I want Khandish Horsemen to not count toward the bow limit, so that the Khandish Horsemen special rule is enforced.

#### Acceptance Criteria

1. WHILE the company has the `khandish_horsemen` rule, THE Limit_Checker SHALL exclude members with `baseUnitId` of `khandish_horseman` from the bow count.
2. THE Limit_Checker SHALL read the exemption from a `limitExemptions.bow` array on the company special rule (value: `["khandish_horseman"]`).
3. WHEN the `limitExemptions.bow` field is missing from the data, THE Limit_Checker SHALL add it to the `khandish_horsemen` rule in `companies.json`.

### Requirement 8: Vault Wardens Company Limit Override

**User Story:** As a player of Durin's Folk, I want the app to handle Vault Warden Team recruitment when it would exceed the company limit, and allow replacement of missing team members, so that the Vault Wardens rule is enforced.

#### Acceptance Criteria

1. WHEN recruiting a Vault Warden Team specifically from the Special chart would exceed the company's `maxCompanySize` of 12, THE Reinforcement_Engine SHALL allow the player to choose any other option from the Special chart instead; this override applies only to Vault Warden Team recruitment, not to other unit types.
2. WHEN any existing Vault Warden Team member has been slain (fewer than expected count for that unit), THE Reinforcement_Engine SHALL offer the player the option to substitute any Special chart roll for a replacement Vault Warden Team member.
3. IF the player declines the Vault Warden substitution, THEN THE Reinforcement_Engine SHALL proceed with the original rolled result.
4. THE Reinforcement_Engine SHALL determine "missing member" status by comparing current Vault Warden Team count against the expected count from the special table entry.

### Requirement 9: Dark Union Roster Slot and Bow Limit Override

**User Story:** As a player of Mirkwood, I want Warg Marauders to correctly occupy 3 roster slots and count as 1 model for bow limit purposes, so that the Dark Union rule is enforced.

#### Acceptance Criteria

1. WHILE the company has the `dark_union` rule, THE Reinforcement_Engine SHALL count each Warg Marauder as occupying the number of roster slots specified by `unitRosterOverrides[].rosterSlots` (3) when checking against `maxCompanySize`.
2. WHILE the company has the `dark_union` rule, THE Limit_Checker SHALL count each Warg Marauder as the value specified by `unitRosterOverrides[].bowLimitCount` (1) toward the bow limit, regardless of how many bow-equipped riders it contains.
3. WHEN displaying company member count, THE Reinforcement_Engine SHALL reflect the adjusted roster slot total (e.g., a Warg Marauder shows as 3/15 slots used).
4. WHEN a Warg Marauder is removed as a casualty, THE Progression_Engine SHALL perform a single injury roll on the Warrior Injury Table for the entire Warg Marauder model; the result determines whether the whole model is removed, not individual rider or mount components.
5. THE Reinforcement_Engine SHALL read `unitRosterOverrides` from the company special rule data to determine slot and limit adjustments.
