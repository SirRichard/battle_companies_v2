# Requirements Document

## Introduction

Some base units in the Battle Companies app carry a `derivedFrom` field that references a parent unit. These derived units share the same base stats as their parent but differ in at least one way (name, stat overrides, additional special rules, equipment, etc.). Currently the app treats derived units as entirely independent entries, requiring the user to enter their stats from scratch even when the parent's stats are already known.

This feature makes the stats-entry flow aware of the `derivedFrom` relationship so that:

1. When a derived unit's stats are needed and the parent's stats are already on file, the app automatically pre-populates the derived unit's stats from the parent (applying any `statOverrides` declared on the derived unit) and **saves them immediately without showing the user a review form**. The differences between parent and derived unit are fully captured by the declared `statOverrides` and other structured fields, so no manual review step is needed.
2. When the parent's stats are not yet on file, the app asks the user to enter the **parent** unit's stats first, then automatically derives and saves the child's stats from them.
3. The `warg_marauder` unit is a special case: it derives from `moria_goblin_warrior` but also carries `riderCount` and `additionalRiders` fields that have no equivalent on the parent. The app must handle these rider-specific fields as part of its pre-population logic for this unit.

Affected units (from `src/data/baseUnits.json`):

| Derived unit | Parent unit | Difference |
|---|---|---|
| `ranger_of_ithilien` | `ranger_of_gondor` | `additionalSpecialRules` |
| `helminga` | `warrior_of_rohan` | `statOverrides: { strength: 4 }` |
| `lorien_guard` | `galadhrim_warrior` | `additionalSpecialRules` |
| `noldorin_exile` | `lothlorien_warrior` | `statOverrides: { move: 8 }` |
| `battlin_brandybuck` | `hobbit_militia` | `statOverrides: { strength: 3 }` |
| `tookish_hunter` | `hobbit_archer` | `additionalSpecialRules` |
| `warg_marauder` | `moria_goblin_warrior` | `riderCount`, `additionalRiders` |
| `goblin_hulk` | `gundabad_ogre` | `keywordOverride` |

---

## Glossary

- **Derived_Unit**: A base unit entry in `baseUnits.json` that has a `derivedFrom` field pointing to a parent unit ID.
- **Parent_Unit**: The base unit referenced by a Derived_Unit's `derivedFrom` field.
- **Stats_Library**: The persistent store of `StoredBaseUnitStats` records keyed by `baseUnitId`, accessed via `getStatsForUnit` / `saveStats` in `AppContext`.
- **Stat_Override**: A `statOverrides` map declared on a Derived_Unit that specifies which stats differ from the Parent_Unit's values.
- **Stats_Entry_Flow**: The `EditStatsPage` component and its wizard-mode path that collects `MemberStats` for a given list of unit IDs.
- **Pre-population**: The act of copying a Parent_Unit's stats (with Stat_Overrides applied) into a `StoredBaseUnitStats` record for a Derived_Unit so the user does not have to type them from scratch.
- **Wizard_Mode**: The stats-entry session launched mid-wizard from `CreateCompanyPage` when one or more unit stats are missing.
- **Auto-save**: The act of saving a Derived_Unit's pre-populated stats directly to the Stats_Library without presenting a form to the user.

---

## Requirements

### Requirement 1: Detect derived units in the stats work queue

**User Story:** As a user creating or managing a company, I want the app to recognise when a unit is derived from another unit, so that I am not asked to enter duplicate information.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow builds its work queue of units needing stats, THE Stats_Entry_Flow SHALL identify each unit in the queue that has a `derivedFrom` field in `baseUnits.json`.
2. THE Stats_Entry_Flow SHALL resolve the Parent_Unit ID for every Derived_Unit in the work queue.
3. IF a Derived_Unit is in the work queue AND its Parent_Unit's stats are already in the Stats_Library, THEN THE Stats_Entry_Flow SHALL not add the Parent_Unit to the work queue as a separate entry.
4. IF a Derived_Unit is in the work queue AND its Parent_Unit's stats are NOT in the Stats_Library, THEN THE Stats_Entry_Flow SHALL insert the Parent_Unit into the work queue immediately before the Derived_Unit.

### Requirement 2: Auto-save derived unit stats from the parent

**User Story:** As a user entering stats, I want the app to automatically save a derived unit's stats from its parent without interrupting my flow, so that I can move on to the next unit that actually needs manual input.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow reaches a Derived_Unit in the work queue AND the Parent_Unit's stats are in the Stats_Library, THE Stats_Entry_Flow SHALL automatically compute the Derived_Unit's stats by copying the Parent_Unit's stats and applying any `statOverrides` declared on the Derived_Unit.
2. WHEN a Derived_Unit has a `statOverrides` map, THE Stats_Entry_Flow SHALL apply each override to the copied values before saving (e.g. if `statOverrides: { strength: 4 }`, the Strength field SHALL be saved as `4`).
3. THE Stats_Entry_Flow SHALL save the computed stats as a new `StoredBaseUnitStats` entry for the Derived_Unit's own ID, leaving the Parent_Unit's entry unchanged.
4. THE Stats_Entry_Flow SHALL NOT display a stats-entry form to the user for the Derived_Unit when its stats can be fully derived from the Parent_Unit.
5. AFTER auto-saving the Derived_Unit's stats, THE Stats_Entry_Flow SHALL immediately advance to the next unit in the work queue that requires manual input.

### Requirement 3: Prompt for parent stats when not yet on file

**User Story:** As a user entering stats for a derived unit whose parent stats are unknown, I want the app to ask me for the parent's stats first, so that the derived unit can be pre-populated correctly.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow reaches a Derived_Unit AND the Parent_Unit's stats are NOT in the Stats_Library, THE Stats_Entry_Flow SHALL present the Parent_Unit's stats-entry form before the Derived_Unit's form.
2. THE Stats_Entry_Flow SHALL label the Parent_Unit's form with the Parent_Unit's name so the user knows which unit they are entering stats for.
3. WHEN the user saves the Parent_Unit's stats, THE Stats_Entry_Flow SHALL immediately auto-save the Derived_Unit's stats using those newly saved stats (with Stat_Overrides applied) and advance to the next unit in the queue that requires manual input, without showing the Derived_Unit's form.
4. THE Stats_Entry_Flow SHALL save the Parent_Unit's stats to the Stats_Library as a normal entry so they are available for future sessions.

### Requirement 4: Special handling for `warg_marauder`

**User Story:** As a user entering stats for a company that includes a Warg Marauder, I want the app to handle its rider-specific fields correctly, so that the unit's full data is captured even though those fields have no equivalent on its parent unit.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow auto-saves stats for `warg_marauder`, THE Stats_Entry_Flow SHALL pre-populate the base combat stats from the `moria_goblin_warrior` parent entry in the Stats_Library.
2. THE Stats_Entry_Flow SHALL preserve the `riderCount` value declared on the `warg_marauder` unit definition (`riderCount: 3`) in the saved stats record.
3. THE Stats_Entry_Flow SHALL preserve the `additionalRiders` array declared on the `warg_marauder` unit definition in the saved stats record.
4. THE Stats_Entry_Flow SHALL NOT require the user to manually enter or confirm the rider-specific fields when the parent's base stats are already on file.
5. IF the `moria_goblin_warrior` parent stats are not in the Stats_Library, THEN THE Stats_Entry_Flow SHALL prompt the user to enter the parent's stats first, then auto-save the `warg_marauder` stats (including rider fields) without showing the user a separate form for the derived unit.

### Requirement 5: Correct progress tracking with injected parent entries

**User Story:** As a user, I want the progress indicator to accurately reflect the total number of stats-entry steps including any parent units that were injected, so that I am not surprised by extra steps.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow inserts a Parent_Unit into the work queue, THE Stats_Entry_Flow SHALL include that Parent_Unit in the total step count displayed to the user.
2. THE Stats_Entry_Flow SHALL update the progress indicator to reflect the expanded queue before the user reaches the first injected step.
3. WHEN a Parent_Unit is injected into the queue, THE Stats_Entry_Flow SHALL display a contextual message explaining why the extra step is present (e.g. "Required for [Derived Unit Name]").

### Requirement 6: Idempotent behaviour when parent stats already exist

**User Story:** As a user returning to stats entry after previously entering a parent unit's stats, I want the app to skip re-entering the parent and go straight to the derived unit, so that I am not asked for the same information twice.

#### Acceptance Criteria

1. WHEN the Stats_Entry_Flow builds its work queue AND the Parent_Unit's stats are already in the Stats_Library, THE Stats_Entry_Flow SHALL NOT include the Parent_Unit as a separate queue entry.
2. WHEN the Stats_Entry_Flow builds its work queue AND both the Parent_Unit's stats AND the Derived_Unit's stats are already in the Stats_Library, THE Stats_Entry_Flow SHALL NOT include either unit in the work queue.
3. THE Stats_Entry_Flow SHALL compute the Derived_Unit's auto-saved stats from the Stats_Library entry for the Parent_Unit (with Stat_Overrides applied) regardless of whether the parent was entered in the current session or a previous one.
