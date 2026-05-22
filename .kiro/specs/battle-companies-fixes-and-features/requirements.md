# Requirements Document

## Introduction

This spec covers a set of bug fixes and missing features for the Battle Companies companion app — a React + TypeScript + MUI + Dexie.js progressive web app for managing MESBG Battle Companies campaigns. All data is stored locally via IndexedDB (Dexie.js). The changes address four confirmed bugs and eight missing features identified against the SRS.

**Bugs addressed:**
- BUG-1: Minor special rules not capped in hero rating calculation
- BUG-2: "Wounds of a Hero" D6 roll not shown to the user
- BUG-3: Match history injury outcomes shown as raw type strings
- BUG-4: Stats entry form does not enforce min/max range validation

**Features addressed:**
- FEAT-1: Company size counter on the Roster tab
- FEAT-2: Promotion eligibility indicator in MemberDetailsDrawer
- FEAT-3: Leader/Sergeant death cascade in PostMatchSummaryPage
- FEAT-4: Wanderer shown in match tracking roster
- FEAT-5: Wanderer rating included in company rating
- FEAT-6: Spells/Magical Powers persisted on the Member model
- FEAT-7: Hero wargear accessibility expanded to all company profiles
- FEAT-8: Injury treatment accessible from the Store/Armoury tab

---

## Glossary

- **Battle Company**: A named group of warriors and heroes managed across multiple campaign matches.
- **Company Rating**: The total point value of all non-injured, non-missing members in a company, used for matchmaking balance.
- **Hero**: A company member with role `leader`, `sergeant`, or `hero_in_making`. Heroes have Might/Will/Fate stats and follow a heroic path.
- **Warrior**: A company member with role `warrior`. Warriors do not have heroic stats or a path.
- **Member**: A single entry in `company.members` — either a Hero or a Warrior.
- **Wanderer**: A hired mercenary hero stored as `company.wandererId` (references `wanderers.json`). Not a `Member` object; has a fixed profile and point cost.
- **MemberDetailsDrawer**: The bottom-sheet drawer that shows full details for a selected company member.
- **PostMatchSummaryPage**: The post-match processing page covering injuries, progression, and influence steps.
- **Minor Special Rule**: A special rule flagged `minor: true` in `specialRules.json`. Capped at 10 pts total contribution to hero rating.
- **Major Special Rule**: A special rule flagged `minor: false` (or absent) in `specialRules.json`. Each contributes 5 pts to hero rating with no cap.
- **Heroic Action**: A special rule whose label matches the set of known heroic action labels (e.g. "Heroic Strike"). Does not contribute to rating.
- **Path of Channeling**: The heroic path (`path_of_channeling`) that grants Magical Powers (spells) as progression rewards.
- **Magical Power / Spell**: A castable ability chosen from `CHANNELING_SPELLS` in `StepSpellSelection.tsx`. Stored as a spell ID string.
- **XP**: Experience points accumulated by a member. 5 XP triggers a progression roll.
- **Promotion Eligibility**: The state where a member has accumulated 5 or more XP and is ready to roll for progression.
- **Death Cascade**: The automatic role reassignment that occurs when a Leader or Sergeant dies during post-match injury resolution.
- **Rating Calculator**: The logic in `src/utils/rating.ts` and `src/services/calculator/ratingCalculator.ts` that computes member and company point values.
- **STATS_ENTRY_FIELDS**: The constant array in `src/constants/index.ts` defining per-stat `min`, `max`, `warnBelow`, and `warnAbove` thresholds.
- **EditStatsPage**: The page (`src/pages/EditStatsPage.tsx`) where users enter base unit stats for the stats library.
- **AnimatedDice**: The `src/components/common/AnimatedDice.tsx` component that renders an animated die roll result.
- **paths.json**: Static data file containing all heroic path definitions, including progression entries with spell/magical power options.
- **Reinforcement Chart**: The `reinforcementTable` array on a `CompanyDefinition`, listing units that can be recruited.
- **Special Chart**: The `specialTable` and `specialUnits` arrays on a `CompanyDefinition`, listing special recruitable units.

---

## Requirements

### Requirement 1: Minor Special Rule Rating Cap (BUG-1)

**User Story:** As a player, I want the company rating to correctly cap minor special rule contributions at 10 pts, so that the rating accurately reflects the SRS §4.8.1 rules.

#### Acceptance Criteria

1. THE Rating_Calculator SHALL distinguish between minor special rules (flagged `minor: true` in `specialRules.json`) and major special rules when computing a hero's rating.
2. WHEN computing a hero's rating, THE Rating_Calculator SHALL add 5 pts per minor special rule up to a maximum of 10 pts total for all minor special rules combined.
3. WHEN computing a hero's rating, THE Rating_Calculator SHALL add 5 pts per major special rule with no upper cap on the total contribution from major special rules.
4. THE Rating_Calculator SHALL continue to exclude Heroic Action labels from all special rule rating calculations.
5. WHEN a hero has zero minor special rules, THE Rating_Calculator SHALL contribute 0 pts from the minor special rule cap.
6. WHEN a hero has one minor special rule, THE Rating_Calculator SHALL contribute exactly 5 pts from minor special rules.
7. WHEN a hero has two or more minor special rules, THE Rating_Calculator SHALL contribute exactly 10 pts from minor special rules regardless of the total count.
8. THE Rating_Calculator SHALL apply the minor rule cap consistently in both `src/utils/rating.ts` and `src/services/calculator/ratingCalculator.ts`.

---

### Requirement 2: Wounds of a Hero — D6 Roll Visibility (BUG-2)

**User Story:** As a player, I want to see the animated D6 roll that determines the bonus influence from "Wounds of a Hero", so that the result feels earned and transparent.

#### Acceptance Criteria

1. WHEN a hero's injury roll produces the "Wounds of a Hero" result (2D6 total of 12), THE PostMatchSummaryPage SHALL pause injury processing and display an animated D6 roll to the user before applying the bonus influence.
2. WHEN the animated D6 roll settles, THE PostMatchSummaryPage SHALL display the rolled value and the resulting bonus influence amount (equal to the D6 result) to the user.
3. WHEN the user acknowledges the Wounds of a Hero result, THE PostMatchSummaryPage SHALL apply the bonus influence to the working company and continue to the next casualty.
4. THE PostMatchSummaryPage SHALL use the existing AnimatedDice component to render the D6 roll animation.
5. IF the D6 roll for Wounds of a Hero has already been resolved, THEN THE PostMatchSummaryPage SHALL NOT re-roll it when the user acknowledges the dialog.

---

### Requirement 3: Match History — Human-Readable Injury Labels (BUG-3)

**User Story:** As a player, I want the match history to show injury outcomes as readable labels (e.g. "Arm Wound") instead of raw type strings (e.g. "arm_wound"), so that the history is easy to read.

#### Acceptance Criteria

1. WHEN the History tab renders a match record's casualty list, THE HistoryMatchCard SHALL display each injury outcome using a human-readable label.
2. THE HistoryMatchCard SHALL map the following outcome types to labels: `arm_wound` → "Arm Wound", `leg_wound` → "Leg Wound", `broken_honour` → "Broken Honour", `missing_next_game` → "Missing Next Game", `dead` → "Dead", `full_recovery` → "Full Recovery", `protection_by_valar` → "Protection by the Valar", `wounds_of_a_hero` → "Wounds of a Hero", `warrior_dead` → "Dead", `warrior_injured` → "Injured", `warrior_full_recovery` → "Full Recovery", `warrior_lesson_learned` → "Lesson Learned".
3. IF an injury outcome type is not found in the label map, THEN THE HistoryMatchCard SHALL fall back to humanising the raw string (replacing underscores with spaces and title-casing each word).
4. THE HistoryMatchCard SHALL apply the label mapping to all casualty entries in both the summary row and the expanded detail view.

---

### Requirement 4: Stats Entry — Min/Max Range Validation (BUG-4)

**User Story:** As a player, I want the stats entry form to block saves when a value is outside the valid range and warn me when a value is unusual but technically valid, so that I don't accidentally enter incorrect stats.

#### Acceptance Criteria

1. WHEN a stat input value is below the `min` defined in `STATS_ENTRY_FIELDS` for that stat, THE EditStatsPage SHALL display a visible error message for that field and disable the Save button.
2. WHEN a stat input value is above the `max` defined in `STATS_ENTRY_FIELDS` for that stat, THE EditStatsPage SHALL display a visible error message for that field and disable the Save button.
3. WHEN all stat input values are within their respective `min`/`max` bounds, THE EditStatsPage SHALL enable the Save button.
4. WHEN a stat input value is below the `warnBelow` threshold (and `warnBelow` is not null), THE EditStatsPage SHALL display a non-blocking warning message for that field without disabling the Save button.
5. WHEN a stat input value is above the `warnAbove` threshold (and `warnAbove` is not null), THE EditStatsPage SHALL display a non-blocking warning message for that field without disabling the Save button.
6. THE EditStatsPage SHALL apply the same validation logic to both `STATS_ENTRY_FIELDS` (infantry) and `MOUNT_STATS_ENTRY_FIELDS` (mount) stat sets.
7. WHEN a stat input is empty or non-numeric, THE EditStatsPage SHALL treat the value as invalid and disable the Save button.
8. THE EditStatsPage SHALL display error and warning messages inline, adjacent to the affected stat field.

---

### Requirement 5: Company Size Counter on Roster Tab (FEAT-1)

**User Story:** As a player, I want to see a "X/Y members" counter on the Roster tab, so that I can tell at a glance how many members I have and how many slots remain before hitting the company maximum.

#### Acceptance Criteria

1. THE CompanyDetailsPage SHALL display a member count in the format "X/Y members" in the Roster tab header area, where X is the current number of members and Y is the company's `maxCompanySize` from its `CompanyDefinition`.
2. WHEN the company has a wanderer hired (`company.wandererId` is set), THE CompanyDetailsPage SHALL include the wanderer in the member count (X + 1).
3. WHEN the member count equals the company maximum, THE CompanyDetailsPage SHALL render the counter with a visually distinct style (e.g. warning colour) to indicate the roster is full.
4. THE CompanyDetailsPage SHALL source the maximum company size from the matching `CompanyDefinition.maxCompanySize` field.
5. THE CompanyDetailsPage SHALL update the counter reactively whenever the company's member list changes.

---

### Requirement 6: Promotion Eligibility Indicator in Member Drawer (FEAT-2)

**User Story:** As a player, I want a clear visual indicator in the member details drawer when a warrior or hero has 5+ XP and is ready to roll for promotion, so that I don't miss advancement opportunities.

#### Acceptance Criteria

1. WHEN a member's `experience` is 5 or greater, THE MemberDetailsDrawer SHALL display a visible promotion-eligibility indicator (chip, badge, or banner) near the member's XP display.
2. THE MemberDetailsDrawer SHALL label the indicator with text such as "Ready to Advance" or equivalent.
3. WHEN a member's `experience` is less than 5, THE MemberDetailsDrawer SHALL NOT display the promotion-eligibility indicator.
4. THE MemberDetailsDrawer SHALL display the indicator for both heroes and warriors who meet the XP threshold.
5. THE MemberDetailsDrawer SHALL style the indicator using the app's primary colour palette to make it visually prominent.

---

### Requirement 7: Leader/Sergeant Death Cascade (FEAT-3)

**User Story:** As a player, I want the app to automatically handle role reassignment when a Leader or Sergeant dies during post-match injury resolution, so that my company always has the correct command structure without manual editing.

#### Acceptance Criteria

1. WHEN a member with role `leader` is removed as dead during injury resolution, THE PostMatchSummaryPage SHALL initiate a death cascade to assign a new Leader.
2. WHEN a death cascade for a Leader is initiated, THE PostMatchSummaryPage SHALL promote the surviving Sergeant with the highest XP to Leader; if two or more Sergeants are tied on XP, THE PostMatchSummaryPage SHALL use the highest rating as a tiebreaker; if still tied, THE PostMatchSummaryPage SHALL prompt the user to choose.
3. WHEN a member with role `sergeant` is removed as dead during injury resolution and fewer than 2 Sergeants remain after the death, THE PostMatchSummaryPage SHALL initiate a cascade to fill the vacant Sergeant slot.
4. WHEN a Sergeant slot cascade is initiated and a `hero_in_making` member exists in the company, THE PostMatchSummaryPage SHALL promote the Hero in the Making with the highest XP to Sergeant; if tied on XP, THE PostMatchSummaryPage SHALL use the highest rating as a tiebreaker; if still tied, THE PostMatchSummaryPage SHALL prompt the user to choose.
5. WHEN a Sergeant slot cascade is initiated and no `hero_in_making` exists, THE PostMatchSummaryPage SHALL auto-promote the warrior with the most XP to `hero_in_making` AND `sergeant`; if tied on XP, THE PostMatchSummaryPage SHALL use the highest rating as a tiebreaker; if still tied, THE PostMatchSummaryPage SHALL prompt the user to choose.
6. WHEN a warrior is auto-promoted to `hero_in_making` via cascade, THE PostMatchSummaryPage SHALL present a path selection dialog so the user can choose the new hero's heroic path.
7. WHEN a path selection dialog is presented during a cascade, THE PostMatchSummaryPage SHALL source available paths from `paths.json` and, for Path of Channeling, SHALL also present a spell selection step sourced from the `CHANNELING_SPELLS` list.
8. WHEN a cascade results in a role change, THE PostMatchSummaryPage SHALL display a confirmation summary to the user before applying the changes to the working company.
9. WHEN a cascade is applied, THE PostMatchSummaryPage SHALL persist the updated roles to the working company state so they are saved at the end of the post-match flow.
10. WHEN no eligible member exists to fill a vacant role (e.g. company has only one member remaining), THE PostMatchSummaryPage SHALL skip the cascade for that role and notify the user.

---

### Requirement 8: Wanderer in Match Tracking Roster (FEAT-4)

**User Story:** As a player, I want the wanderer my company has hired to appear in the match tracking roster with an XP counter and casualty toggle, so that I can track their performance during a match.

#### Acceptance Criteria

1. WHEN a company has a `wandererId` set and a match is in progress, THE MatchTrackingPage SHALL include the wanderer as an entry in the member list alongside regular company members.
2. THE MatchTrackingPage SHALL display the wanderer's name and unit label (sourced from `wanderers.json`) in the member card.
3. THE MatchTrackingPage SHALL render an XP counter (increment/decrement) for the wanderer, identical in behaviour to the counter shown for regular members.
4. THE MatchTrackingPage SHALL render a casualty toggle for the wanderer, identical in behaviour to the toggle shown for regular members.
5. THE MatchTrackingPage SHALL display the wanderer's full stat block using the stats defined in `wanderers.json`.
6. THE MatchTrackingPage SHALL display the wanderer's Might/Will/Fate values as interactive counters, since wanderers are heroes.
7. THE MatchTrackingPage SHALL sort the wanderer into the member list according to the existing role sort order (wanderers are heroes and should appear after Sergeants and Heroes in the Making, or at a defined position).
8. WHEN the match ends, THE MatchTrackingPage SHALL include the wanderer's XP gains in the post-match data passed to PostMatchSummaryPage.
9. THE MatchTrackingPage SHALL NOT add the wanderer to `company.members`; the wanderer entry in the match state SHALL be derived from `wandererId` and `wanderers.json` at match setup time.

---

### Requirement 9: Wanderer Rating Included in Company Rating (FEAT-5)

**User Story:** As a player, I want the company rating to include the wanderer's point value when one is hired, so that the displayed rating accurately reflects the full strength of my company.

#### Acceptance Criteria

1. WHEN a company has a `wandererId` set, THE Rating_Calculator SHALL include the wanderer's `pointsCost` (from `wanderers.json`) in the total company rating.
2. WHEN a company has no `wandererId`, THE Rating_Calculator SHALL compute the company rating from `company.members` only, with no change to existing behaviour.
3. THE Rating_Calculator SHALL apply the same "missing next game" exclusion rule to the wanderer: if the wanderer is marked as injured/missing, their points SHALL NOT be included.
4. THE `calcCompanyRating` function in `src/utils/rating.ts` SHALL accept the wanderer's data and include it in the sum.
5. THE CompanyDetailsPage SHALL pass the wanderer data to `calcCompanyRating` so the displayed rating reflects the wanderer's contribution.

---

### Requirement 10: Spells Persisted on Member Model (FEAT-6)

**User Story:** As a player, I want the spells my hero has learned to be saved on their member record, so that I can see which Magical Powers they know and the app can display and use them correctly.

#### Acceptance Criteria

1. THE Member model SHALL include a `spells` field of type `string[]` (an array of spell IDs from `CHANNELING_SPELLS`).
2. WHEN a hero selects Path of Channeling during company creation, THE CreateCompanyPage (wizard) SHALL persist the chosen starting spell ID in `member.spells` on the created Member.
3. WHEN a hero on Path of Channeling gains a new Magical Power during post-match progression (path roll result of type `magical_power`), THE PostMatchSummaryPage SHALL append the chosen spell ID to `member.spells`.
4. WHEN a hero on Path of Channeling gains an `improve_casting_value` result during progression, THE Member model SHALL store the improvement; a `spellImprovements` field of type `Record<string, number>` (spell ID → number of improvements) SHALL be added to the Member model to track casting value upgrades.
5. THE MemberDetailsDrawer SHALL display the hero's known spells (from `member.spells`) with their labels and current casting values when the member is on Path of Channeling.
6. WHEN `member.spells` is undefined or empty, THE MemberDetailsDrawer SHALL NOT render the spells section.
7. THE `spells` field SHALL be optional on the Member interface to maintain backward compatibility with existing persisted company data.

---

### Requirement 11: Hero Wargear Accessibility (FEAT-7)

**User Story:** As a player, I want heroes to be able to purchase wargear available to any profile on the company's reinforcement and special charts, so that the wargear options match the SRS rules for hero equipment.

#### Acceptance Criteria

1. WHEN the Store tab renders wargear purchase options for a hero, THE StoreTab SHALL include wargear available to any `baseUnitId` referenced in the company's `reinforcementTable`, `specialTable`, and `specialUnits` arrays.
2. THE StoreTab SHALL continue to include wargear available to the hero's own `baseUnitId` profile.
3. THE StoreTab SHALL de-duplicate wargear options so that the same item does not appear twice in the purchase list.
4. WHEN a wargear item is already owned by the hero (present in `member.equipment` or `member.ownedEquipment`), THE StoreTab SHALL mark it as already purchased and prevent duplicate purchase.
5. THE StoreTab SHALL apply the existing hero wargear cost rules (lower cost if A+W < 3, higher cost if A+W ≥ 3) to all wargear items regardless of which profile they originate from.
6. THE StoreTab SHALL NOT expose wargear from profiles that are not referenced in the company's reinforcement or special charts.

---

### Requirement 12: Injury Treatment Accessible from Store/Armoury (FEAT-8)

**User Story:** As a player, I want to be able to treat injuries from the Store/Armoury tab on the Company Details page, so that I can manage injury treatment in the same place I manage other spending.

#### Acceptance Criteria

1. THE StoreTab on CompanyDetailsPage SHALL include an "Injury Treatment" section or entry point that allows the user to initiate injury treatment for any injured member.
2. WHEN the user selects a member for injury treatment from the StoreTab, THE StoreTab SHALL present the same injury treatment options currently available in MemberDetailsDrawer (remove `missing_next_game` for warriors, roll/miss for heroes).
3. WHEN an injury treatment action is confirmed from the StoreTab, THE StoreTab SHALL deduct the appropriate influence cost from `company.influence` and update the member's injuries, then persist the updated company via `saveCompany`.
4. WHEN no members have treatable injuries, THE StoreTab SHALL display a message indicating no injuries require treatment.
5. THE StoreTab SHALL display the current influence balance and the cost of each treatment option so the user can make an informed decision.
6. WHEN the company has insufficient influence to pay for a treatment, THE StoreTab SHALL disable that treatment option and display the reason.
7. THE injury treatment logic used in the StoreTab SHALL be consistent with the logic already implemented in MemberDetailsDrawer to avoid divergent behaviour.

---

### Requirement 13: Injury Treatment Real-Time Update in MemberDetailsDrawer (BUG-FIX)

**User Story:** As a player, I want the member details drawer to reflect injury changes immediately after treatment, so that I don't have to close and reopen the drawer to see the updated state.

#### Acceptance Criteria

1. WHEN an injury treatment action is confirmed from within the MemberDetailsDrawer, THE MemberDetailsDrawer SHALL update the displayed injury list in real time without requiring the drawer to be closed and reopened.
2. WHEN a `missing_next_game` injury is removed via treatment, THE MemberDetailsDrawer SHALL immediately remove that injury entry from the displayed injury list.
3. WHEN a hero injury is successfully treated via the roll path, THE MemberDetailsDrawer SHALL immediately remove the treated injury from the displayed injury list.
4. THE MemberDetailsDrawer SHALL reflect the updated `company.influence` balance immediately after any treatment action is confirmed.
5. WHEN a member has a `missing_next_game` status, THE MemberDetailsDrawer SHALL allow the user to spend 1 influence point to remove the status and return the unit to active state without requiring a dice roll.
6. THE MemberDetailsDrawer SHALL NOT require a roll to remove a `missing_next_game` status; spending the influence point SHALL be sufficient to clear the injury.

---

### Requirement 14: Gold Step Ordering and Hero Classification in Company Creation Wizard (BUG-FIX + FEAT)

**User Story:** As a player, I want the gold/equipment step in the company creation wizard to list members in the correct order and show the right hero classification, so that I can easily identify and equip each member.

#### Acceptance Criteria

1. WHEN the StepGoldEquipment step renders the member list, THE StepGoldEquipment SHALL order members as: heroes first (leader first, then sergeants alphabetically), then warriors alphabetically.
2. THE StepGoldEquipment SHALL correctly identify the leader as the first hero in the roster and label them "Leader", and all subsequent heroes as "Sergeant".
3. WHEN a member is a hero, THE StepGoldEquipment SHALL display separate tabs or sections for wargear, equipment, and creatures, allowing the user to switch between them.
4. WHEN a member is a warrior, THE StepGoldEquipment SHALL display only the wargear and equipment tabs or sections applicable to that warrior's profile.
5. THE StepGoldEquipment SHALL source creature options from `creatures.json`, filtered to those available to the hero's company.
6. WHEN a hero purchases a creature, THE StepGoldEquipment SHALL record the creature purchase in the same `goldPurchases` structure used for wargear.

---

### Requirement 15: Remove Non-Armour Weapons from Hero Wargear in MemberDetailsDrawer (FEAT)

**User Story:** As a player, I want to be able to remove non-armour weapons from a hero's wargear in the member details drawer, so that I can correct mistakes or discard unwanted items.

#### Acceptance Criteria

1. WHEN viewing a hero's wargear section in the MemberDetailsDrawer, THE MemberDetailsDrawer SHALL display an "Edit" button that enables wargear removal mode.
2. WHEN wargear removal mode is active, THE MemberDetailsDrawer SHALL display an "X" (remove) button on each non-armour weapon in the hero's wargear list.
3. WHEN the user taps the "X" on a wargear item, THE MemberDetailsDrawer SHALL display a confirmation dialog identifying the item to be removed before applying any change.
4. WHEN the user confirms removal in the confirmation dialog, THE MemberDetailsDrawer SHALL remove the item from `member.equipment` and persist the updated company via `saveCompany`.
5. THE MemberDetailsDrawer SHALL NOT display a remove button on armour items (items with a category of `armour` in `wargear.json`) or on base equipment items that are part of the unit's default profile.
6. WHEN wargear removal mode is active, THE MemberDetailsDrawer SHALL display a "Done" button to exit removal mode without making further changes.
7. THE MemberDetailsDrawer SHALL only expose this wargear removal feature for heroes; warriors SHALL NOT have the edit/remove wargear UI.

---

### Requirement 16: Store Tab Unit Ordering (BUG-FIX)

**User Story:** As a player, I want the unit selector in the Store tab to list members in the correct order, so that I can quickly find the member I want to equip.

#### Acceptance Criteria

1. WHEN the StoreTab renders the member selector for wargear or equipment purchases, THE StoreTab SHALL order members as: heroes first (leader first, then sergeants alphabetically), then warriors alphabetically.
2. WHEN the StoreTab renders the member selector for the creatures tab, THE StoreTab SHALL display only heroes, ordered as: leader first, then sergeants alphabetically.
3. THE StoreTab SHALL apply the same ordering rule consistently across all purchase categories (wargear, equipment, creatures).
4. WHEN a company has no heroes, THE StoreTab SHALL display only warriors in the wargear and equipment selectors, and SHALL display an empty state or hidden creatures tab.

---

### Requirement 17: Show Rank and Equipped Wargear in ToolkitAssignmentPage Member Selector (FEAT)

**User Story:** As a player, I want to see each member's rank and equipped wargear when assigning toolkit items, so that I can make informed assignment decisions.

#### Acceptance Criteria

1. WHEN the ToolkitAssignmentPage renders the member dropdown or selector for item assignment, THE ToolkitAssignmentPage SHALL display each member's rank (e.g. Leader, Sergeant, Hero in the Making, Warrior) alongside their name.
2. WHEN the ToolkitAssignmentPage renders the member selector, THE ToolkitAssignmentPage SHALL display each member's currently equipped wargear items alongside their name and rank.
3. THE ToolkitAssignmentPage SHALL source the member's rank from `member.role` and the wargear from the union of `baseEquipment` (from `baseUnits.json`) and `member.equipment`.
4. THE ToolkitAssignmentPage SHALL display the rank and wargear in a compact format that does not obscure the member's name or make the selector difficult to use on small screens.

---

### Requirement 18: Toolkit Items on MatchTrackingPage with Consumable Usage Tracking (FEAT)

**User Story:** As a player, I want to see assigned toolkit items on each member's match tracking card and be able to mark consumable items as used, so that I can track item usage during a match.

#### Acceptance Criteria

1. WHEN a match has toolkit items assigned (`match.toolkitItems` is non-empty), THE MatchTrackingPage SHALL display each member's assigned toolkit items within that member's match card.
2. WHEN a toolkit item is consumable, THE MatchTrackingPage SHALL display a "Use" button or toggle next to that item on the member's card.
3. WHEN the user marks a consumable toolkit item as used, THE MatchTrackingPage SHALL visually indicate the item has been consumed (e.g. strikethrough, greyed out, or a "Used" label) and persist the used state in the active match state.
4. WHEN a toolkit item is not consumable, THE MatchTrackingPage SHALL display the item as a non-interactive label on the member's card.
5. THE MatchTrackingPage SHALL source the consumable flag for each item from the item's definition in `wargear.json` or the toolkit item data.
6. WHEN a member has no assigned toolkit items, THE MatchTrackingPage SHALL NOT render a toolkit section on that member's card.
7. THE MatchTrackingPage SHALL persist the used/unused state of consumable items in `ActiveMatchState` so that the state survives a page reload during a match.

---

### Requirement 19: PathCardSelector in PostMatchSummaryPage for Heroic Path Selection (FEAT)

**User Story:** As a player, I want to use the swipeable path card interface when choosing a heroic path during post-match hero promotion, so that I have the same rich path information available as in the company creation wizard.

#### Acceptance Criteria

1. WHEN the PostMatchSummaryPage presents a heroic path selection dialog (for a newly promoted Hero in the Making), THE PostMatchSummaryPage SHALL render the PathCardSelector component instead of a plain list of options.
2. THE PathCardSelector SHALL be pre-populated with all available paths from `paths.json` and SHALL allow the user to swipe or navigate between path cards.
3. WHEN the user selects a path via PathCardSelector and confirms, THE PostMatchSummaryPage SHALL apply the selected path to the member and continue post-match processing.
4. THE PostMatchSummaryPage SHALL pass the member's base stats to PathCardSelector so that concrete stat ceilings are displayed rather than relative gains.
5. WHEN the Path of Channeling is selected, THE PostMatchSummaryPage SHALL present a spell selection step after path confirmation, consistent with the existing spell selection flow.

---

### Requirement 20: Reset Selected Option After Each Hero Promotion in PostMatchSummaryPage (BUG-FIX)

**User Story:** As a player, I want the hero advancement selection to reset after each hero confirms their choice, so that I know I have moved on to the next hero's promotion and don't accidentally apply the previous hero's selection.

#### Acceptance Criteria

1. WHEN a hero confirms their advancement selection in the PostMatchSummaryPage progression step, THE PostMatchSummaryPage SHALL reset the selected option (chosen roll A or B, and any sub-choice index) to its default unselected state before presenting the next hero's advancement.
2. WHEN the next hero's advancement is presented, THE PostMatchSummaryPage SHALL display no pre-selected option, requiring the user to make a fresh selection.
3. THE PostMatchSummaryPage SHALL apply this reset for every hero advancement confirmation, regardless of whether the confirmed choice was roll A, roll B, or a bonus roll.
4. WHEN only one hero has levelled up, THE PostMatchSummaryPage SHALL still reset the selection state after confirmation, so the UI is consistent.

---

### Requirement 21: Start Match Button Available from All Tabs in CompanyDetailsPage (FEAT)

**User Story:** As a player, I want to be able to start a match from any tab on the Company Details page, so that I don't have to navigate back to the Roster tab just to begin a game.

#### Acceptance Criteria

1. THE CompanyDetailsPage SHALL display the "Start Match" action (FAB or equivalent) on all three tabs: Roster, History, and Store.
2. WHEN the user taps "Start Match" from any tab, THE CompanyDetailsPage SHALL navigate to the match setup page for the current company, identical to the existing behaviour on the Roster tab.
3. THE CompanyDetailsPage SHALL render the "Start Match" button with the same visual style regardless of which tab is active.

---

### Requirement 22: Against the Odds — Wanderer Selection (NEW-1)

**User Story:** As a player, I want to be able to pick which wanderer my company hires when I select the "wanderer" Against the Odds bonus, so that the chosen wanderer appears in the match tracking roster.

#### Acceptance Criteria

1. WHEN the user selects the "wanderer" ATO bonus in PostMatchSummaryPage, THE PostMatchSummaryPage SHALL present a wanderer selection dialog listing all available wanderers from `wanderers.json` (label, point cost, and key stats).
2. WHEN the user confirms a wanderer selection, THE PostMatchSummaryPage SHALL persist the chosen wanderer's ID to `company.wandererId` and save the updated company.
3. WHEN a wanderer is already hired (`company.wandererId` is set) and the user selects the "wanderer" ATO bonus again, THE PostMatchSummaryPage SHALL allow the user to replace the existing wanderer with a new selection.
4. WHEN the user dismisses the wanderer selection dialog without making a choice, THE PostMatchSummaryPage SHALL leave `company.wandererId` unchanged.
5. THE wanderer selection dialog SHALL display each wanderer's label, influence cost, and a brief summary of their stats so the user can make an informed choice.
6. WHEN a wanderer is selected via the ATO bonus flow, THE MatchSetupPage SHALL include that wanderer in the match roster on the next match (consistent with the existing FEAT-4 / Requirement 8 behaviour).

---

### Requirement 23: Consumable Toolkit Items — Remove on Use (NEW-2)

**User Story:** As a player, I want to be able to permanently remove a consumable toolkit item from a member's assignment after using it during a match, so that the item is properly consumed and no longer appears in future matches.

#### Acceptance Criteria

1. WHEN a consumable toolkit item has been marked as used in MatchTrackingPage, THE MatchTrackingPage SHALL display a "Remove" button (or equivalent) alongside the "Used" visual indicator for that item.
2. WHEN the user taps "Remove" on a used consumable item, THE MatchTrackingPage SHALL remove that item from the member's toolkit assignment in `ActiveMatchState.toolkitItems`.
3. WHEN a consumable item is removed from `ActiveMatchState.toolkitItems`, THE MatchTrackingPage SHALL immediately hide the item from the member's toolkit section on the match card.
4. THE removal action SHALL only be available for consumable items that have already been marked as used; unused consumable items SHALL NOT show a "Remove" button.
5. WHEN the match ends after a consumable item has been removed, THE post-match data SHALL not include that item in the toolkit assignment, so it does not reappear in future matches.
6. THE MatchTrackingPage SHALL persist the updated `toolkitItems` list (with the removed item absent) in `ActiveMatchState` so the removal survives a page reload.

---

### Requirement 24: Hero Progression Roll of 5 — Apply Both Results Automatically (NEW-3)

**User Story:** As a player, I want the app to automatically give me both progression results when a hero rolls a 5, so that I don't have to manually pick between them — both should be applied and I only need to make choices within each result.

#### Acceptance Criteria

1. WHEN a hero's progression roll is 5, THE PostMatchSummaryPage SHALL automatically apply both the roll-A result and the roll-B result to the hero without requiring the user to choose between them.
2. WHEN both results are applied on a roll of 5, THE PostMatchSummaryPage SHALL present any sub-choices required by each result (e.g. which stat to increase, which special rule to gain) to the user in sequence.
3. THE PostMatchSummaryPage SHALL clearly indicate to the user that both results are being applied because the roll was a 5.
4. WHEN one or both of the roll-5 results require no sub-choice (e.g. a fixed stat increase), THE PostMatchSummaryPage SHALL apply that result automatically without prompting the user.
5. THE existing `HeroAdvRecord.bonusRoll` field SHALL be used to store the second result when a roll of 5 occurs, and both `resultA` and `bonusRoll` SHALL be applied when the user confirms.
6. WHEN a roll of 5 occurs and both results have been applied, THE PostMatchSummaryPage SHALL mark the hero's advancement as done and advance to the next hero.

---

### Requirement 25: Injury Treatment — Prompt to Use IP After D6 Roll (NEW-4)

**User Story:** As a player, I want to be prompted to spend Influence Points after seeing the D6 roll result when treating a hero injury, so that I can make an informed decision about whether to use IP and the flow is clear about when IP is spent.

#### Acceptance Criteria

1. WHEN treating a hero injury that requires a D6 roll (`arm_wound`, `leg_wound`, `broken_honour`), THE MemberDetailsDrawer SHALL display the animated D6 roll result to the user before prompting for IP usage.
2. AFTER the D6 roll result is shown, THE MemberDetailsDrawer SHALL prompt the user with the option to spend IP to improve the outcome (if applicable) or confirm the result as-is.
3. WHEN the user chooses to spend IP, THE MemberDetailsDrawer SHALL deduct the IP from `company.influence` and apply the improved outcome.
4. WHEN the user chooses not to spend IP (or no IP option is available), THE MemberDetailsDrawer SHALL apply the rolled outcome without deducting IP.
5. WHEN the D6 roll results in a success (injury treated), THE MemberDetailsDrawer SHALL still offer the IP prompt before finalising, so the user can confirm the result.
6. THE MemberDetailsDrawer SHALL display the current IP balance and the cost of spending IP during the prompt so the user can make an informed decision.
7. WHEN the company has insufficient IP to spend, THE MemberDetailsDrawer SHALL disable the "Spend IP" option and display the reason.

---

### Requirement 26: Store Tab — Capitalize Leader/Sergeant Titles and Fix "Hero in the Making" Label (NEW-5)

**User Story:** As a player, I want the Store tab to display member titles correctly — with "Leader" and "Sergeant" capitalized and heroes in the making shown as "Hero in the Making" — so that the UI is consistent and readable.

#### Acceptance Criteria

1. WHEN the Store tab renders member selectors or member labels under the Wargear, Equipment, or Creatures sub-tabs, THE StoreTab SHALL display the Leader role as "Leader" (capitalized).
2. WHEN the Store tab renders member selectors or member labels, THE StoreTab SHALL display the Sergeant role as "Sergeant" (capitalized).
3. WHEN the Store tab renders member selectors or member labels, THE StoreTab SHALL display the hero_in_making role as "Hero in the Making" (human-readable label, not the raw `hero_in_making` string).
4. THE StoreTab SHALL apply these label corrections consistently across all member selectors and any inline role labels within the Store tab.
5. THE StoreTab SHALL use the existing `roleLabel` helper function (or equivalent) to derive these labels, ensuring consistency with the rest of the app.

---

### Requirement 27: Roster Tab — Warriors Show Only Loadout Choices (NEW-6)

**User Story:** As a player, I want warriors on the Roster tab to show only their wargear loadout choices (not all their base gear), so that the roster is less cluttered and I can quickly see what options each warrior has selected.

#### Acceptance Criteria

1. WHEN the Roster tab renders a warrior's `MemberRow`, THE MemberRow SHALL display only the warrior's wargear loadout choices — items that represent a selection from the warrior's `equipmentOptions` — rather than all base equipment plus purchased equipment.
2. WHEN a warrior has no loadout choices (no `equipmentOptions` defined for their profile, or no option has been selected), THE MemberRow SHALL display no wargear chips for that warrior.
3. THE MemberRow SHALL continue to display all wargear (base equipment + purchased equipment) for heroes; this change applies to warriors only.
4. WHEN a warrior's full wargear list (base equipment + purchased equipment) is needed, it SHALL remain accessible via the MemberDetailsDrawer for that warrior.
5. THE Roster tab warrior wargear display change SHALL NOT affect how warrior wargear is shown in any other view (Store tab, MatchTrackingPage, MemberDetailsDrawer, etc.).

---

### Requirement 28: Store > Wargear Tab — Hide Wargear Type Label, Keep Bow Limit (NEW-7)

**User Story:** As a player, I want the Store's Wargear tab to not show the wargear type label under each item name, so that the list is cleaner — but I still want to see the bow limit warning so I know when I can't buy more ranged weapons.

#### Acceptance Criteria

1. WHEN the Store tab renders the Wargear sub-tab purchase options, THE StoreTab SHALL NOT display the wargear type/category label beneath each wargear item's name (e.g. "mount", "hand_weapon", "bow" labels should be hidden).
2. WHEN a ranged weapon is displayed in the Wargear sub-tab and the company's bow limit has been reached, THE StoreTab SHALL still display a bow-limit warning or indicator for that item (e.g. "Bow limit reached") and disable the purchase button for that item.
3. WHEN the bow limit has NOT been reached, THE StoreTab SHALL display ranged weapons as purchasable without any bow-limit indicator.
4. THE removal of the wargear type label SHALL apply to all wargear items in the Wargear sub-tab, including mounts, weapons, and armour.
5. THE bow limit check and display logic SHALL remain functionally unchanged; only the general wargear type label is hidden.

---

### Requirement 29: Auto-Clear "Missing Next Game" Injury After a Completed Match (BUG-FIX)

**User Story:** As a player, I want a unit's "Missing Next Game" injury to be automatically removed when a match is completed, so that the unit is available for the following game without requiring manual intervention.

#### Acceptance Criteria

1. WHEN the post-match flow completes and the company is saved, THE PostMatchSummaryPage SHALL remove any `missing_next_game` injury from every member who had that status at the start of the match.
2. THE auto-clear SHALL apply to both heroes and warriors.
3. THE auto-clear SHALL occur regardless of whether the member participated in the match (i.e. the injury is cleared for all members with that status, not only those who were in the match roster).
4. WHEN a member has other injuries in addition to `missing_next_game` (e.g. `arm_wound`), THE PostMatchSummaryPage SHALL remove only the `missing_next_game` entry and leave all other injuries intact.
5. THE auto-clear SHALL happen as part of the final company save at the end of the post-match flow, not as a separate user action.
6. WHEN no members have a `missing_next_game` injury, THE PostMatchSummaryPage SHALL complete the save normally with no change in behaviour.

---

### Requirement 30: StepMemberNames — Bottom Bar Overlap Fix (BUG-FIX)

**User Story:** As a player, I want the member name text fields in the wizard to scroll correctly behind the bottom navigation bar, so that the placeholder text and input fields are never obscured by the bar.

#### Acceptance Criteria

1. WHEN the StepMemberNames step is rendered, THE Wizard SHALL ensure the scrollable content area has sufficient bottom padding so that the last TextField is not hidden behind the fixed bottom action bar.
2. WHEN the user scrolls to the bottom of the member name list, THE StepMemberNames step SHALL display the last TextField fully visible above the bottom action bar.
3. THE bottom padding applied to the scroll container SHALL be at least as tall as the bottom action bar so that no content is permanently obscured.
4. THE fix SHALL NOT affect the layout or behaviour of any other wizard step.
5. WHEN the member list is short enough to fit on screen without scrolling, THE StepMemberNames step SHALL display normally with no visual regression.

---

### Requirement 31: The Last Alliance — Variant Roster Selection for Gondor Faction (FEAT)

**User Story:** As a player selecting The Last Alliance from the Gondor faction, I want to be asked whether I want the standard roster or the Númenórean variant roster, so that I can play the Gondor-only version of the company.

#### Acceptance Criteria

1. WHEN the user selects "The Last Alliance" company while `wizard.factionId === 'gondor'`, THE Wizard SHALL present a variant selection prompt asking the user to choose between the standard roster and the Númenórean variant roster before advancing.
2. WHEN the user selects the Númenórean variant, THE Wizard SHALL use the `last_alliance_numenorean` variant's `startingRoster` and `reinforcementTable` for all subsequent wizard steps.
3. WHEN the user selects the standard variant (or when The Last Alliance is selected from the Elven Realms faction), THE Wizard SHALL use the default `startingRoster` and `reinforcementTable` with no change to existing behaviour.
4. THE WizardState SHALL include a `variantId` field (type `string | null`) to record the chosen variant.
5. WHEN a variant is selected, THE `createCompany` factory function SHALL use the variant's `startingRoster` and `reinforcementTable` instead of the company-level defaults when building the company.
6. WHEN the user selects "The Last Alliance" from the Elven Realms faction, THE Wizard SHALL NOT display a variant selection prompt and SHALL proceed as before.
7. WHEN the expandable details panel for The Last Alliance is open in StepCompany and `factionId === 'gondor'`, THE StepCompany SHALL display the Númenórean variant's starting roster as an additional roster option alongside the standard roster.
8. WHEN a variant with `visibleFromFactions` is defined, THE StepCompany SHALL only show that variant's roster in the expandable details when the current `factionId` is included in `visibleFromFactions`.

---

### Requirement 32: StepLeaderSelection — Enforce mustBeLeader / mustBeSergeant Constraints (FEAT)

**User Story:** As a player, I want the leader and sergeant selection step to automatically pre-assign heroes whose roster entry has `mustBeLeader` or `mustBeSergeant` set, so that I cannot accidentally assign the wrong member to a locked role.

#### Acceptance Criteria

1. WHEN a starting roster entry has `mustBeLeader: true`, THE StepLeaderSelection SHALL automatically pre-assign the corresponding member as Leader and display that member's role as locked.
2. WHEN a starting roster entry has `mustBeSergeant: true`, THE StepLeaderSelection SHALL automatically pre-assign the corresponding member as Sergeant and display that member's role as locked.
3. WHEN a member's role is locked (pre-assigned via `mustBeLeader` or `mustBeSergeant`), THE StepLeaderSelection SHALL display a visual lock indicator (e.g. a lock icon or "Required" badge) on that member's card.
4. WHEN a member's role is locked, THE StepLeaderSelection SHALL NOT allow the user to deselect or reassign that member's role by tapping their card.
5. THE WizardState SHALL be pre-populated with the forced `leaderId` and `sergeantIds` before or when step 5 is first rendered, so that `canAdvance()` reflects the pre-assigned roles immediately.
6. WHEN a member is pre-assigned as Leader via `mustBeLeader`, THE StepLeaderSelection SHALL still allow the user to freely assign the remaining Sergeant slots from the non-locked members.
7. WHEN a member is pre-assigned as Sergeant via `mustBeSergeant`, THE StepLeaderSelection SHALL still allow the user to freely assign the Leader slot and any remaining Sergeant slots from the non-locked members (unless those are also locked).
8. THE pre-assignment logic SHALL use the same index mapping as `generateTempMemberIds` to correctly identify which `tempId` corresponds to each roster entry with a `mustBeLeader` or `mustBeSergeant` flag.

---

### Requirement 33: Wizard — Skip StepLeaderSelection When All Roles Are Pre-Assigned (FEAT)

**User Story:** As a player creating a company where all hero roles are determined by the roster (e.g. Helm's Deep), I want the wizard to skip the leader selection step entirely, so that I am not shown a step where there is nothing to choose.

#### Acceptance Criteria

1. WHEN all three hero roles (1 Leader + 2 Sergeants) are pre-determined by `mustBeLeader` and `mustBeSergeant` constraints in the starting roster, THE Wizard SHALL skip step 5 (StepLeaderSelection) and advance directly to step 6 (Hero Paths).
2. WHEN the Wizard skips step 5, THE WizardState SHALL already contain the correct `leaderId` and `sergeantIds` values derived from the `mustBeLeader`/`mustBeSergeant` constraints, so that step 6 receives valid hero IDs.
3. WHEN the user navigates back from step 6 while step 5 was skipped, THE Wizard SHALL skip step 5 again and return to step 4 (Member Names).
4. THE skip logic SHALL only apply when ALL three hero slots are pre-assigned; if even one slot is free, THE Wizard SHALL show step 5 as normal.
5. WHEN step 5 is skipped, THE Stepper indicator in the UI SHALL visually reflect that step 5 is complete (or bypassed), consistent with the existing stepper behaviour for other steps.

---

### Requirement 34: StepLeaderSelection — Next Button Stale State Fix (BUG-FIX)

**User Story:** As a player, I want the Next button in the leader selection step to reliably enable as soon as I have selected a leader and two sergeants, so that I am never stuck unable to advance.

#### Acceptance Criteria

1. WHEN the user has selected a valid Leader and two Sergeants in StepLeaderSelection, THE Wizard SHALL enable the Next button immediately without requiring any additional interaction.
2. WHEN `wizard.leaderId` is set and `wizard.sergeantIds.length === 2`, THE `canAdvance()` check for step 5 SHALL return `true` and the Next button SHALL be enabled.
3. THE `canAdvance` function SHALL NOT capture stale wizard state due to closure issues; it SHALL always read the current `wizard` state when evaluated.
4. THE Enter key shortcut for advancing the wizard SHALL also correctly reflect the current `canAdvance()` result without stale closure issues.
5. WHEN a pre-assigned leader (via `mustBeLeader`) is combined with user-selected sergeants, THE `canAdvance()` check SHALL correctly return `true` once both sergeant slots are filled.
6. WHEN the user deselects a sergeant and then reselects one, THE Next button SHALL update its enabled/disabled state reactively without requiring a page reload or re-render trigger.

---

### Requirement 35: Parameterised Special Rules — Storage and Display (NEW-8)

**User Story:** As a player, I want special rules that require a parameter (such as "Dominant (3)" or "Hatred (Orcs)") to be stored with their parameter value and displayed correctly throughout the app, so that I can see the full meaning of each special rule at a glance.

#### Acceptance Criteria

1. THE Member model SHALL support parameterised special rules by allowing entries in `member.specialRules` to be either a plain string ID (for non-parameterised rules) or an object of the form `{ id: string; parameter: string | number }` (for parameterised rules).
2. WHEN a parameterised special rule is stored on a member, THE Member model SHALL preserve the `parameter` value through serialisation and deserialisation (round-trip via IndexedDB).
3. WHEN displaying a special rule that has `parameterised: true` in `specialRules.json` and a stored `parameter` value, THE app SHALL render the rule label with the parameter in parentheses — e.g. "Dominant (3)" or "Hatred (Orcs)".
4. WHEN displaying a special rule that has `parameterised: true` but no stored `parameter` value, THE app SHALL render the rule label with "(X)" as a placeholder — e.g. "Dominant (X)".
5. WHEN displaying a special rule that has `parameterised: false`, THE app SHALL render the rule label without any parenthetical suffix, unchanged from current behaviour.
6. THE parameterised display format SHALL be applied consistently wherever special rules are shown: in MemberDetailsDrawer, on the MatchTrackingPage member card, and in any other location that renders a member's special rules list.
7. THE `specialRules` field on the Member interface SHALL remain backward-compatible: existing persisted data that stores plain string IDs SHALL continue to be read and displayed correctly.
8. WHEN a wanderer's special rules are displayed (sourced from `wanderers.json`, which already uses `{ id, parameter }` objects), THE app SHALL apply the same parameterised display format as for member special rules.

---

### Requirement 36: Envenom Weapon — Restriction to Carried Weapons and Duplicate Prevention (NEW-9)

**User Story:** As a player, I want the Envenom Weapon toolkit item to only offer weapons that the target member actually carries, and to prevent the same weapon from being envenomed twice on the same member, so that the assignment is always valid and meaningful.

#### Acceptance Criteria

1. WHEN the ToolkitAssignmentPage presents the weapon selection dialog for an Envenom Weapon item, THE ToolkitAssignmentPage SHALL restrict the weapon options to only the weapons present in the target member's equipment (the union of their `baseEquipment` from `baseUnits.json` and their `member.equipment` array), filtered to items whose `category` in `wargear.json` is a weapon type (i.e. not `armour_*`, `mount`, or `shield`).
2. WHEN a member has no eligible weapons (no weapon-category items in their equipment), THE ToolkitAssignmentPage SHALL disable the Envenom Weapon assignment for that member and display a message explaining that the member carries no eligible weapons.
3. WHEN a member has already been assigned an Envenom Weapon for a specific weapon in the current toolkit assignment, THE ToolkitAssignmentPage SHALL exclude that weapon from the options for any subsequent Envenom Weapon assignment to the same member.
4. WHEN all of a member's weapons have already been assigned an Envenom Weapon in the current toolkit assignment, THE ToolkitAssignmentPage SHALL disable further Envenom Weapon assignments to that member and display a message indicating all weapons are already envenomed.
5. THE weapon options presented in the Envenom Weapon dialog SHALL display each weapon's human-readable label (from `wargear.json` or the label utility), not the raw ID.
6. WHEN the ToolkitAssignmentPage displays the Envenom Weapon item on the MatchTrackingPage, THE MatchTrackingPage SHALL render the item label as "Envenom Weapon (WeaponName)" — e.g. "Envenom Weapon (Spear)" — using the stored `parameter` value from the `ToolkitItem`.
7. THE restriction logic SHALL derive the member's weapon list at the time the assignment dialog is opened, using the same member data available to the ToolkitAssignmentPage (active company members from `company.members`).

---

### Requirement 37: Against the Odds — Wanderer Selection Page (NEW-10)

**User Story:** As a player, I want to be directed to a wanderer selection page when I choose the "Wanderer" Against the Odds bonus during match setup, so that I can pick which wanderer joins my company temporarily for the match.

#### Acceptance Criteria

1. WHEN the user selects the "wanderer" ATO bonus in MatchSetupPage and taps the start/next button, THE MatchSetupPage SHALL navigate to a WandererSelectionPage before proceeding to MatchTrackingPage.
2. WHEN both the "toolkit" and "wanderer" ATO bonuses are selected, THE MatchSetupPage SHALL navigate to ToolkitAssignmentPage first, and THE ToolkitAssignmentPage SHALL navigate to WandererSelectionPage after toolkit assignment is complete, before proceeding to MatchTrackingPage.
3. WHEN only the "wanderer" ATO bonus is selected (without "toolkit"), THE MatchSetupPage SHALL navigate directly to WandererSelectionPage, bypassing ToolkitAssignmentPage.
4. THE WandererSelectionPage SHALL display all available wanderers from `wanderers.json`, showing each wanderer's name, point cost, and a summary of their key stats.
5. THE WandererSelectionPage SHALL allow the user to select exactly one wanderer from the list.
6. WHEN the user confirms a wanderer selection on WandererSelectionPage, THE WandererSelectionPage SHALL add the selected wanderer as a synthetic member entry in `ActiveMatchState.members` (with `role: 'wanderer'`) and navigate to MatchTrackingPage.
7. THE ATO wanderer added via WandererSelectionPage SHALL NOT be persisted to `company.wandererId`; it is a temporary match-only addition and SHALL NOT affect the company's permanent wanderer hire.
8. WHEN the match ends, THE MatchTrackingPage SHALL NOT include the ATO wanderer's XP gains in the post-match XP data passed to PostMatchSummaryPage; ATO wanderers do not earn experience.
9. THE WandererSelectionPage SHALL display a back button that returns the user to ToolkitAssignmentPage (if toolkit was also selected) or to MatchSetupPage (if toolkit was not selected), without discarding the active match state.
10. WHEN the user navigates back from WandererSelectionPage to MatchSetupPage, THE MatchSetupPage SHALL not re-trigger the wanderer navigation on the next start attempt unless the user taps the start button again.
11. THE WandererSelectionPage SHALL be accessible at the route `/companies/:companyId/match/wanderer` and SHALL be registered in the app router.
12. WHEN the ATO wanderer is displayed on the MatchTrackingPage, THE MatchTrackingPage SHALL render the wanderer card with a visual indicator (e.g. a "Temporary" or "ATO" badge) distinguishing it from a permanently hired wanderer.
