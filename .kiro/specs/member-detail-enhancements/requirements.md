# Requirements Document

## Introduction

This feature enhances the Member Details Drawer and Company Details Page to provide richer interactivity and information display. Key improvements include: clickable equipment and special rules with description popups, equipment-granted special rules that do not double-count in the ratings calculator, shield mutual exclusivity enforcement for the small shield equipment item, proper handling of the torching_brand item's multiple granted rules, correct population of parameterised special rule labels, creature display with ownership hierarchy and dedicated detail drawers, and wanderer display in a distinct roster section.

## Glossary

- **Member_Details_Drawer**: The bottom-sheet drawer component (`MemberDetailsDrawer.tsx`) that displays full details for a single company member including stats, wargear, equipment, special rules, and injuries.
- **Equipment_Item**: A non-combat item from `equipment.json` stored in a member's `ownedEquipment` array, displayed in the Equipment section of the drawer.
- **Special_Rule**: A game rule from `specialRules.json` stored in a member's `specialRules` array, which may be a plain string ID or a parameterised object `{ id, parameter }`.
- **Granted_Special_Rule**: A special rule conferred to a member by an Equipment_Item via the `grantsSpecialRules` field in `equipment.json`. These rules provide gameplay effects but must not contribute additional points to the member's rating beyond the equipment's own rating cost.
- **Ratings_Calculator**: The `calcMemberRating` function in `src/utils/rating.ts` (and its mirror in `ratingCalculator.ts`) that computes a member's point value for company rating purposes.
- **Small_Shield**: The equipment item with id `small_shield` that grants +1 Defence and the Shieldwall rule, which is mutually exclusive with other shield-type wargear.
- **Torching_Brand**: The equipment item with id `torching_brand` that grants multiple special rules: Terror (Beast), Terror (Cavalry), and Dominant (2).
- **Parameterised_Rule**: A special rule whose label contains a placeholder `(X)` that must be replaced with a concrete parameter value when displayed.
- **Creature**: A beast companion from `creatures.json` that can be attached to a Leader or Sergeant hero, with its own stats, special rules, and description.
- **Wanderer**: A temporary hired hero from `wanderers.json` attached to a company via `company.wandererId`.
- **Company_Details_Page**: The page (`CompanyDetailsPage.tsx`) containing Roster, History, and Store tabs for managing a company.
- **Roster_Tab**: The first tab of the Company_Details_Page showing Heroes, Warriors, and (after this feature) Wanderers and Creatures.

## Requirements

### Requirement 1: Clickable Equipment with Description Popups

**User Story:** As a player, I want to tap on any equipment item in the Member Details Drawer to view its description, so that I can quickly reference what each piece of equipment does during gameplay.

#### Acceptance Criteria

1. WHEN a user taps an Equipment_Item chip that has a non-empty `description` field in `equipment.json`, THE Member_Details_Drawer SHALL display a popup dialog showing the equipment's label as the title and its description as the body text.
2. WHEN a user taps an Equipment_Item chip that has no `description` field but has a non-empty `grantsSpecialRules` array, THE Member_Details_Drawer SHALL display a popup dialog showing the equipment's label as the title and a formatted list of granted rules as the body text.
3. WHEN a user taps the close button or outside area of an equipment description popup, THE Member_Details_Drawer SHALL dismiss the popup and return to the normal equipment display.
4. THE Member_Details_Drawer SHALL render all Equipment_Item chips with a pointer cursor to indicate they are interactive.

### Requirement 2: Equipment-Granted Special Rules Display

**User Story:** As a player, I want to see the special rules granted by my equipment listed in the member's Special Rules section, so that I have a complete reference of all active rules during gameplay.

#### Acceptance Criteria

1. WHEN a member owns an Equipment_Item that has a `grantsSpecialRules` field, THE Member_Details_Drawer SHALL display each Granted_Special_Rule in the Special Rules section of the drawer regardless of member status or equipment state.
2. THE Member_Details_Drawer SHALL visually distinguish Granted_Special_Rules from innate special rules by using a different chip border style or annotation indicating the source equipment.
3. WHEN a user taps a Granted_Special_Rule chip, THE Member_Details_Drawer SHALL display the rule's description popup identical to tapping any other special rule.

### Requirement 3: Granted Special Rules Rating Exclusion

**User Story:** As a player, I want equipment-granted special rules to not inflate my member's rating beyond the equipment's own cost, so that the company rating accurately reflects the rules as written.

#### Acceptance Criteria

1. THE Ratings_Calculator SHALL exclude Granted_Special_Rules from the special rules point calculation for a member's rating.
2. THE Ratings_Calculator SHALL continue to include the Equipment_Item's own `rating` field value in the member's total rating.
3. FOR ALL members with Equipment_Items that grant special rules, THE Ratings_Calculator SHALL produce the same rating as if those granted rules were not present in the member's `specialRules` array.

### Requirement 4: Small Shield Mutual Exclusivity

**User Story:** As a player, I want the system to prevent equipping a small shield when I already have another shield (and vice versa), so that I cannot violate the game's equipment restrictions.

#### Acceptance Criteria

1. WHILE a member has the Small_Shield in their `ownedEquipment`, THE system SHALL prevent equipping any wargear item with category `shield` to that member.
2. WHILE a member has any wargear item with category `shield` in their `equipment` array, THE system SHALL prevent purchasing or assigning the Small_Shield to that member (symmetric exclusivity).
3. IF a user attempts to equip a shield-type item that violates the mutual exclusivity rule, THEN THE system SHALL display an informative message explaining that the Small_Shield cannot be used in conjunction with another shield.

### Requirement 5: Torching Brand Special Handling

**User Story:** As a player, I want the torching_brand item to correctly grant its multiple parameterised special rules (Terror (Beast), Terror (Cavalry), Dominant (2)), so that all its effects are visible and properly tracked.

#### Acceptance Criteria

1. WHEN a member owns the Torching_Brand equipment, THE Member_Details_Drawer SHALL display all three Granted_Special_Rules: Terror (Beast), Terror (Cavalry), and Dominant (2) in the Special Rules section.
2. WHEN a user taps any of the Torching_Brand's Granted_Special_Rules, THE Member_Details_Drawer SHALL display the corresponding rule description popup.
3. THE Ratings_Calculator SHALL not count the Torching_Brand's three Granted_Special_Rules toward the member's special rule rating points.
4. WHEN a user taps the Torching_Brand equipment chip, THE Member_Details_Drawer SHALL display the Torching_Brand's own description in a popup dialog (shown only on tap, not proactively).

### Requirement 6: Clickable Special Rules with Description Popups

**User Story:** As a player, I want to tap on any special rule in the Member Details Drawer to view its description, so that I can reference rule text without needing the rulebook.

#### Acceptance Criteria

1. WHEN a user taps a Special_Rule chip that has a matching description in `specialRules.json`, THE Member_Details_Drawer SHALL display a popup dialog showing the rule's label as the title and its description as the body text.
2. WHEN a user taps a Parameterised_Rule chip, THE Member_Details_Drawer SHALL actively display a visible popup dialog showing the rule's description with the parameter value contextually noted.
3. THE Member_Details_Drawer SHALL render all Special_Rule chips that have descriptions with a pointer cursor to indicate they are interactive.
4. WHEN a Special_Rule has no description available, THE Member_Details_Drawer SHALL render the chip without a pointer cursor and without click behaviour.

### Requirement 7: Parameterised Rule Label Population

**User Story:** As a player, I want all parameterised special rules to display their actual parameter values instead of a generic "(X)" placeholder, so that I can see the specific details of each rule at a glance.

#### Acceptance Criteria

1. THE Member_Details_Drawer SHALL display every Parameterised_Rule with its concrete parameter value substituted for the `(X)` placeholder in the label.
2. WHEN a Parameterised_Rule has `parameter_type` of `weapon`, THE system SHALL resolve the parameter to the weapon's display label using the wargear label lookup.
3. WHEN a Parameterised_Rule has `parameter_type` of `friendly_hero`, THE system SHALL resolve the parameter to the referenced hero's name.
4. WHEN a Parameterised_Rule has `parameter_type` of `integer`, `distance`, `target_integer`, or `target_keyword`, THE system SHALL display the raw parameter value in parentheses.
5. FOR ALL members with parameterised special rules, THE Member_Details_Drawer SHALL never display a rule label containing the literal text "(X)".

### Requirement 8: Creature Display in Roster with Ownership Hierarchy

**User Story:** As a player, I want creatures bought by a hero to be displayed in the Company Details Page roster in a way that visually communicates ownership, so that I can quickly see which hero owns which creature.

#### Acceptance Criteria

1. WHEN a hero member has a `creatureId` assigned, THE Roster_Tab SHALL display the creature visually nested beneath or attached to that hero's row, indicating ownership.
2. THE Roster_Tab SHALL display the creature's label, point cost, and key stats in the ownership indicator.
3. WHEN a user taps on a creature in the Roster_Tab, THE system SHALL open a dedicated Creature Details Drawer showing the creature's full stats, special rules, and description.
4. THE Creature Details Drawer SHALL display the creature's stats in the same grid format used for member stats.
5. THE Creature Details Drawer SHALL display the creature's special rules as clickable chips that show description popups when tapped.
6. THE Creature Details Drawer SHALL display the creature's description text.

### Requirement 9: Wanderer Display in Roster Tab

**User Story:** As a player, I want wanderers to be listed in a distinct section below the warriors in the Roster tab, so that I can see my full company composition at a glance while understanding that wanderers are temporary additions.

#### Acceptance Criteria

1. WHILE a company has a `wandererId` assigned, THE Roster_Tab SHALL display a "Wanderers" section below the Warriors section.
2. WHILE a wanderer is assigned, THE Roster_Tab SHALL display the wanderer's label, point cost, stats summary, equipment, and special rules in the Wanderers section.
3. WHEN a user taps on the wanderer row in the Roster_Tab, THE system SHALL open a Member Details Drawer (or equivalent detail view) showing the wanderer's full profile.
4. THE Roster_Tab SHALL visually distinguish the Wanderers section from the Warriors section using a distinct header style.
5. THE Store_Tab SHALL retain the existing wanderer hire and dismiss functionality without changes.
