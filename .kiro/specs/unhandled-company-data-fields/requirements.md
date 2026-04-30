# Requirements Document

## Introduction

Several fields defined in `companies.json` are currently parsed by the TypeScript data models but never read by any application logic. This feature implements full enforcement of all six unhandled fields so that company-specific rules are correctly applied during company creation, reinforcement rolling, wargear purchase, hero upgrade selection, and match break-point calculation.

The six areas of work are:

1. **`uniqueWargear`** on `CompanyDefinition` — company-specific purchasable wargear items that must appear in the Store's Wargear tab alongside global wargear.
2. **`reinforcementSubstitution`** on `CompanySpecialRule` — allows the player to substitute any qualifying rolled result with a specific unit.
3. **`heroRestrictions`** on `CompanySpecialRule` — restricts which `baseUnitId`s may be assigned as heroes during company creation.
4. **`count` on `ReinforcementEntry`** — entries with `count > 1` must recruit that many units simultaneously.
5. **`allowedKeywords`** on `HeroUpgrade` and on `uniqueWargear` entries — restricts which hero unit types may take a given upgrade or purchase a given wargear item.
6. **`breaking_point` special rule** — the company's break point is 66 % instead of the standard 50 %.

---

## Glossary

- **Store**: The in-game shop UI rendered by `StoreTab` inside `CompanyDetailsPage`.
- **Wargear Tab**: The "Wargear" section of the Store where heroes and warriors purchase equipment with Influence Points (IP).
- **Reinforcement Roll**: The dice-roll flow in the Store's "Reinforce" section that adds new members to the company.
- **Company Creation Wizard**: The multi-step wizard (`CreateCompanyPage` + step components) used to create a new company.
- **StepLeaderSelection**: The wizard step where the player assigns one Leader and two Sergeants from the starting roster.
- **Hero**: A company member whose `role` is `leader`, `sergeant`, or `hero_in_making`.
- **Warrior**: A company member whose `role` is `warrior`.
- **CompanyDefinition**: The static data record for a company type, sourced from `companies.json`.
- **CompanySpecialRule**: A rule object embedded in `CompanyDefinition.companySpecialRules`.
- **ReinforcementEntry**: A row in `CompanyDefinition.reinforcementTable` or `specialTable`.
- **HeroUpgrade**: An upgrade option in `CompanyDefinition.heroUpgrade` purchasable by heroes in the Store.
- **UniqueWargear**: A wargear entry defined in `CompanyDefinition.uniqueWargear` rather than in `wargear.json`.
- **allowedKeywords**: An array of keyword strings on a `HeroUpgrade` or `UniqueWargear` entry that restricts eligibility to heroes whose `baseUnitId` resolves to a unit possessing at least one of those keywords.
- **heroRestrictions**: An array on `CompanySpecialRule` listing `allowedBaseUnitIds`; only units in this list may be assigned as heroes.
- **reinforcementSubstitution**: An array on `CompanySpecialRule` describing an optional substitution the player may apply to a reinforcement roll result.
- **Break Point**: The fraction of a company's starting model count at which the company is considered broken for morale purposes. The standard value is 50 % for all companies. The `breaking_point` special rule overrides this with a custom percentage supplied via its `breakPointPercentage` parameter (e.g. 0.66 for 66 %).
- **IP**: Influence Points, the in-game currency spent in the Store.

---

## Requirements

### Requirement 1: Unique Wargear Displayed in Store

**User Story:** As a player, I want to see and purchase company-specific wargear items in the Store's Wargear tab, so that I can equip my heroes with items unique to my company.

#### Acceptance Criteria

1. WHEN the Wargear tab is open and the company has one or more `uniqueWargear` entries, THE Store SHALL display each unique wargear item alongside the global purchasable wargear list for eligible members.
2. WHEN a `uniqueWargear` entry has no `allowedKeywords` field, THE Store SHALL make that item available to all heroes in the company.
3. WHEN a `uniqueWargear` entry has an `allowedKeywords` array, THE Store SHALL make that item available only to heroes whose `baseUnitId` resolves to a unit that has at least one matching keyword.
4. WHEN a `uniqueWargear` entry has `heroOnly: true`, THE Store SHALL make that item available only to heroes, not warriors.
5. WHEN a `uniqueWargear` entry has a `limit` value, THE Store SHALL prevent purchase of that item once the number of company members already carrying it equals the `limit`.
6. WHEN a hero purchases a unique wargear item, THE Store SHALL deduct the item's `influenceCost` from the company's IP balance and add the `equipmentId` to the member's `equipment` array.
7. WHEN a hero already carries a unique wargear item, THE Store SHALL not display that item as available for purchase for that hero.
8. THE Store SHALL display the `label` and `influenceCost` of each unique wargear item in the same visual style as global wargear items.

---

### Requirement 2: Reinforcement Substitution Option

**User Story:** As a player, I want to be offered the option to substitute my reinforcement roll result with the company's designated substitute unit, so that I can take advantage of my company's special recruitment rule.

#### Acceptance Criteria

1. WHEN a reinforcement roll result is displayed and the company has a `reinforcementSubstitution` rule whose `appliesTo` array includes the final adjusted roll number — whether that number was resolved against the standard reinforcement table or the special table — THE Store SHALL display a substitution prompt using the rule's `prompt` text.
2. WHEN the player accepts the substitution, THE Store SHALL replace the current roll result with a `unit` result for the `baseUnitId` specified in the `reinforcementSubstitution` entry.
3. WHEN the player declines the substitution, THE Store SHALL retain the original roll result unchanged.
4. WHEN the substitution result would cause the company to exceed its maximum size, THE Store SHALL disable the substitution option and display an appropriate message.
5. WHEN the substitution result would violate a bow, throwing, or cavalry composition limit, THE Store SHALL disable the substitution option and display an appropriate limit warning.
6. WHEN the player accepts the substitution, THE Store SHALL proceed through the same name-entry and recruitment confirmation flow used for standard reinforcement results.

---

### Requirement 3: Hero Restrictions During Company Creation

**User Story:** As a player, I want the company creation wizard to enforce hero eligibility restrictions, so that only permitted unit types can be assigned as Leader or Sergeant.

#### Acceptance Criteria

1. WHEN a company's `companySpecialRules` contains a rule with a `heroRestrictions` entry, THE StepLeaderSelection SHALL restrict hero assignment to members whose `baseUnitId` is listed in `allowedBaseUnitIds`.
2. WHEN a member's `baseUnitId` is not in the `allowedBaseUnitIds` list, THE StepLeaderSelection SHALL render that member as non-selectable for any hero role.
3. WHEN all hero slots are filled exclusively from the allowed unit types, THE StepLeaderSelection SHALL allow the wizard to advance to the next step.
4. WHEN a member is non-selectable due to hero restrictions, THE StepLeaderSelection SHALL display a visual indicator (e.g. a lock icon or dimmed state) distinguishing restriction-based ineligibility from slot-full ineligibility.
5. WHEN a company has no `heroRestrictions` rule, THE StepLeaderSelection SHALL apply no additional filtering beyond the existing forced-role logic.

---

### Requirement 4: Reinforcement Count Recruits Multiple Units

**User Story:** As a player, I want a reinforcement roll result with `count > 1` to recruit all indicated units at once, so that the game rule of multi-unit recruitment is correctly applied.

#### Acceptance Criteria

1. WHEN a reinforcement roll resolves to a `ReinforcementEntry` with `count` equal to 1 or absent, THE Store SHALL recruit exactly one unit, preserving existing behaviour.
2. WHEN a reinforcement roll resolves to a `ReinforcementEntry` of result type `unit` with `count` greater than 1, THE Store SHALL recruit exactly `count` units of the specified `baseUnitId` simultaneously. The `count` field applies only to `unit` result types; entries with result types of `choice`, `pair`, or any other type SHALL ignore the `count` field and recruit as normal.
3. WHEN a multi-count result would cause the total company size to exceed `maxCompanySize`, THE Store SHALL block recruitment and display an appropriate message.
4. WHEN a multi-count result would cause any composition limit (bow, throwing, cavalry) to be exceeded, THE Store SHALL block recruitment and display an appropriate limit warning.
5. WHEN a multi-count result is confirmed, THE Store SHALL open the name-entry dialog with one name field per unit being recruited.
6. WHEN the player confirms names for a multi-count result, THE Store SHALL add all recruited members to the company in a single save operation and deduct the reinforcement cost once regardless of the number of units recruited.
7. THE Store SHALL display the `count` value in the reinforcement result card so the player can see how many units will be recruited.

---

### Requirement 5: Hero Upgrade Keyword Filtering

**User Story:** As a player, I want the hero upgrade list to show only upgrades my hero is eligible for based on their unit type, so that I cannot accidentally purchase an upgrade restricted to a different unit type.

#### Acceptance Criteria

1. WHEN a `HeroUpgrade` entry has no `allowedKeywords` field, THE Store SHALL display that upgrade as available to all heroes (subject to existing `baseUnitIds` filtering).
2. WHEN a `HeroUpgrade` entry has an `allowedKeywords` array, THE Store SHALL display that upgrade only to heroes whose `baseUnitId` resolves to a unit possessing at least one keyword from the array.
3. WHEN a hero does not meet the `allowedKeywords` requirement for an upgrade, THE Store SHALL not display that upgrade in the hero's available upgrade list.
4. WHEN a hero meets both the `baseUnitIds` requirement (if present) and the `allowedKeywords` requirement (if present), THE Store SHALL display the upgrade as available for purchase.
5. WHEN a hero has already purchased an upgrade, THE Store SHALL not display that upgrade again for that hero, regardless of keyword eligibility.

---

### Requirement 6: Break Point Calculation

**User Story:** As a player, I want the app to correctly calculate and display my company's break point, so that I know the correct threshold during a match.

#### Acceptance Criteria

1. THE App SHALL calculate the break point for every company in every match as 50 % of the company's starting model count, rounded down, unless overridden by a special rule.
2. WHEN a company's `companySpecialRules` contains a rule with `id` equal to `"breaking_point"`, THE App SHALL read the `breakPointPercentage` value from that rule's `parameters` object and use it in place of the standard 50 % to calculate the break point (rounded down).
3. WHEN the `breaking_point` rule is present but its `parameters.breakPointPercentage` value is absent or invalid, THE App SHALL fall back to the standard 50 % break point and log a warning.
4. WHEN the break point is displayed in the match tracking UI, THE App SHALL show the correct threshold value derived from the active rule.
5. WHEN the company's current active member count falls at or below the break point threshold, THE App SHALL indicate the broken state in the match tracking UI.

---

### Requirement 7: Data Model Completeness

**User Story:** As a developer, I want the TypeScript data models to fully represent all fields used in `companies.json`, so that the compiler enforces correct data access throughout the codebase.

#### Acceptance Criteria

1. THE `CompanyDefinition` model SHALL include a `uniqueWargear` field typed as an optional array of `UniqueWargearEntry` objects.
2. THE `UniqueWargearEntry` type SHALL include `equipmentId`, `label`, `influenceCost`, `rating`, and optional `allowedKeywords`, `heroOnly`, and `limit` fields.
3. THE `HeroUpgrade` model SHALL include an optional `allowedKeywords` field typed as `string[]`.
4. THE `CompanySpecialRule` model SHALL include an optional `heroRestrictions` field typed as an array of objects with an `allowedBaseUnitIds: string[]` property.
5. WHEN the TypeScript compiler processes the updated models, THE Compiler SHALL produce zero type errors related to the new fields.
