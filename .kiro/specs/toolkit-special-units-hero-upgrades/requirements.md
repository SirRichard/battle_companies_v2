# Requirements Document

## Introduction

This feature set adds three capabilities to the Battle Companies app:
1. Multi-select Toolkit ATO bonus (up to 5 times) with sequential kit assignment flow
2. Display of hero upgrade information during company creation wizard
3. Purchase of special units in the Store > Reinforce tab for eligible companies

## Glossary

- **Match_Setup_Page**: The page where users configure opponent rating, ATO bonuses, and scenario before starting a match
- **Toolkit_Assignment_Page**: The page where users select a kit and assign its items to company members
- **ATO_Bonus**: "Against the Odds" bonus — a benefit selected during match setup when the company rating is lower than the opponent
- **Kit**: A predefined collection of temporary items (e.g., Healer's Kit, Explorer's Kit) assigned to members for one match
- **Company_Creation_Wizard**: The multi-step wizard used to create a new company (faction, company type, leader, etc.)
- **Hero_Upgrade**: A special rule granted to a company's hero upon promotion, defined per company type in companies.json
- **Special_Unit**: A unique unit type available for purchase by specific companies (e.g., Cave Troll for Moria), defined in the specialUnits field
- **Store_Tab**: The "Store" tab on the Company Details page containing reinforcements, wargear, equipment, creatures, wanderers, and injuries sections
- **Company_Definition**: The static data definition for a company type, including specialUnits, heroUpgrade, and companySpecialRules fields
- **Rating_Budget**: The difference between opponent rating and company rating that constrains ATO bonus selection

## Requirements

### Requirement 1: Toolkit ATO Bonus Multi-Select

**User Story:** As a player, I want to select the Toolkit ATO bonus multiple times (up to 5) during match setup, so that I can equip my company with multiple kits for a single match.

#### Acceptance Criteria

1. WHEN the user selects the Toolkit ATO bonus on the Match_Setup_Page, THE Match_Setup_Page SHALL allow the Toolkit bonus to be selected up to 5 times total, each selection consuming 30 rating points from the Rating_Budget.
2. WHILE the Toolkit bonus has been selected fewer than 5 times AND the remaining Rating_Budget is at least 30, THE Match_Setup_Page SHALL permit an additional Toolkit selection.
3. IF the Toolkit bonus has already been selected 5 times, THEN THE Match_Setup_Page SHALL reject further Toolkit selections regardless of remaining Rating_Budget.
4. IF adding another Toolkit selection (30 points) would cause the cumulative ATO rating total to exceed the Rating_Budget, THEN THE Match_Setup_Page SHALL reject the selection.
5. WHEN the user deselects one instance of the Toolkit bonus, THE Match_Setup_Page SHALL reduce the Toolkit count by exactly one and free exactly 30 rating points back to the Rating_Budget.
6. WHILE the Toolkit count is greater than zero, THE Match_Setup_Page SHALL display the current Toolkit selection count (e.g., "×2") adjacent to the Toolkit bonus label.
7. WHEN the Toolkit count is zero, THE Match_Setup_Page SHALL display the Toolkit bonus in its default unselected state with no count indicator.
8. THE Match_Setup_Page SHALL store the Toolkit count in the ActiveMatchState.atoBonuses array as N repeated 'toolkit' entries (where N is the selection count), so downstream pages can derive the kit allowance by filtering for 'toolkit' entries.

### Requirement 2: Sequential Kit Selection Enforcement

**User Story:** As a player, I want to select one kit per Toolkit bonus purchased and assign all items from each kit before moving to the next, so that the assignment process is orderly and complete.

#### Acceptance Criteria

1. WHEN the user proceeds to the Toolkit_Assignment_Page, THE Toolkit_Assignment_Page SHALL derive the total number of kits allowed by counting the number of 'toolkit' entries in ActiveMatchState.atoBonuses.
2. THE Toolkit_Assignment_Page SHALL present the kit selection list with all previously-selected kit types disabled (greyed out), preventing the user from selecting the same kit type more than once across all kit selections in a single match.
3. WHEN the user selects a kit, THE Toolkit_Assignment_Page SHALL display the kit's item list and assignment controls, locking the kit selection until the current kit is confirmed or cancelled.
4. IF the user has not yet assigned all items from the current kit to members, THEN THE Toolkit_Assignment_Page SHALL disable the confirm button for that kit.
5. WHEN the user confirms a fully-assigned kit, THE Toolkit_Assignment_Page SHALL append that kit's ToolkitItem entries to the accumulated list and advance to the next kit selection step (incrementing the current kit index). IF the user attempts to confirm a kit that is not fully assigned, THE Toolkit_Assignment_Page SHALL ignore the confirmation and keep the current kit active.
6. WHEN the user has confirmed assignments for all purchased kits (current kit index equals total kit count), THE Toolkit_Assignment_Page SHALL save all accumulated ToolkitItem entries to ActiveMatchState.toolkitItems and navigate to Wanderer selection if 'wanderer' is present in atoBonuses, otherwise navigate to Match Tracking.
7. THE Toolkit_Assignment_Page SHALL display a progress indicator showing which kit number the user is currently assigning (e.g., "Kit 2 of 3").
8. WHEN only one Toolkit bonus was purchased, THE Toolkit_Assignment_Page SHALL behave identically to the current single-kit flow (no progress indicator needed, immediate navigation after confirmation).

### Requirement 3: Hero Upgrade Display in Company Creation Wizard

**User Story:** As a player, I want to see the hero upgrade information for a company during company creation, so that I can make an informed decision about which company to choose.

#### Acceptance Criteria

1. WHEN a company type with a non-empty heroUpgrade field is displayed in the Company_Creation_Wizard expanded details, THE Company_Creation_Wizard SHALL display each hero upgrade entry's label and description within the expanded details panel, positioned after the Company Special Rules section and before the Starting Roster section.
2. WHEN a company type has multiple hero upgrades (array with more than one entry), THE Company_Creation_Wizard SHALL display all hero upgrade entries in the order they appear in the data source.
3. WHEN a company type has no heroUpgrade field or the heroUpgrade array is empty, THE Company_Creation_Wizard SHALL not render a hero upgrade section for that company.
4. THE Company_Creation_Wizard SHALL display a separate uppercase heading labeled "Hero Upgrades" above the hero upgrade entries, visually consistent with the existing "Company Special Rules" and "Starting Roster" headings but distinct in text.
5. WHEN a hero upgrade entry contains a baseUnitIds field with one or more unit identifiers, THE Company_Creation_Wizard SHALL display the associated unit labels alongside that hero upgrade entry so the player can identify which units the upgrade applies to.
6. IF the heroUpgrade field is a single object instead of an array, THEN THE Company_Creation_Wizard SHALL normalize it to a single-element array and display it identically to an array with one entry.

### Requirement 4: Special Units in Store Reinforce Tab

**User Story:** As a player, I want to purchase special units from the Store tab when my company type supports them, so that I can add powerful unique units to my roster.

#### Acceptance Criteria

1. WHEN the user views the Store_Tab for a company whose Company_Definition includes a non-empty specialUnits array, THE Store_Tab SHALL display a "Special Units" section within the reinforcements area.
2. WHEN the company's Company_Definition does not include a specialUnits field or the array is empty, THE Store_Tab SHALL not display the Special Units section.
3. WHILE the Special Units section is displayed, THE Store_Tab SHALL display each special unit entry with its label (resolved from baseUnitId via the baseUnits data), its influenceCost as a numeric value, and its rare value displayed as a maximum-allowed count (e.g., "Limit: 1").
4. WHEN the user purchases a special unit, THE Store_Tab SHALL deduct the unit's influenceCost from the company's available influence and add a new member to the company roster with the special unit's baseUnitId, the role "warrior", and the base unit's default wargear.
5. IF the company's current influence is less than the special unit's influenceCost, THEN THE Store_Tab SHALL disable the purchase action for that unit.
6. IF the company roster member count equals or exceeds the Company_Definition's maxCompanySize, THEN THE Store_Tab SHALL disable the purchase action for all special units.
7. WHEN a special unit has a rare value, THE Store_Tab SHALL enforce that no more than that number of members with the same baseUnitId (from the specialUnits entry) may exist in the company roster at one time.
8. IF the company roster already contains a count of members matching a special unit's baseUnitId equal to that unit's rare value, THEN THE Store_Tab SHALL disable the purchase action for that unit and display a message indicating the unit limit has been reached. IF the roster count is below the rare value, THE Store_Tab SHALL NOT display any limit-reached message for that unit.
