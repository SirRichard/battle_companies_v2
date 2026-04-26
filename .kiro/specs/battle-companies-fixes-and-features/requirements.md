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
