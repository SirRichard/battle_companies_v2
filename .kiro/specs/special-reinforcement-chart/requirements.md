# Requirements Document

## Introduction

Some company types in the Battle Companies app have a special reinforcement chart (`specialTable`) in addition to the standard reinforcement chart (`reinforcementTable`). Currently, the Store tab's Reinforce section displays a "Table Reference" that only shows the standard reinforcement chart. Companies that have a `specialTable` defined (e.g. Minas Tirith, Rohan, Fornost, Osgiliath & Ithilien) do not show that chart to the user, leaving them without a reference for what they can roll when they reach the special chart.

This feature adds a special reinforcement chart reference display beneath the standard chart reference, visible only for companies that have a `specialTable` defined.

## Glossary

- **CompanyDetailsPage**: The page that displays a company's roster, history, and store tabs.
- **Store Tab**: The third tab on the CompanyDetailsPage, containing the Reinforce, Wargear, Equipment, Creatures, Wanderers, and Injuries sub-sections.
- **Reinforce Section**: The sub-section of the Store Tab where the user rolls for reinforcements and views the table reference.
- **Standard Reinforcement Chart**: The `reinforcementTable` array on a `CompanyDefinition`, always present, listing roll results 1–6 for standard reinforcement rolls.
- **Special Reinforcement Chart**: The optional `specialTable` array on a `CompanyDefinition`, present only for some companies, listing roll results 1–6 consulted when the standard chart produces a "Roll on Special Chart" result.
- **Table Reference**: The read-only display at the bottom of the Reinforce section showing the roll-to-result mapping for the reinforcement charts.
- **CompanyDefinition**: The static data model describing a company type, including its `reinforcementTable` and optional `specialTable`.

## Requirements

### Requirement 1: Display Special Reinforcement Chart Reference

**User Story:** As a player, I want to see the special reinforcement chart in the Reinforce section, so that I know what results are possible when I roll on the special chart.

#### Acceptance Criteria

1. WHEN the Reinforce section is displayed AND the current company's `CompanyDefinition` has a non-empty `specialTable`, THE Page SHALL render a special reinforcement chart reference below the standard reinforcement chart reference.
2. WHEN the Reinforce section is displayed AND the current company's `CompanyDefinition` does not have a `specialTable` (or it is empty), THE Page SHALL NOT render a special reinforcement chart reference.
3. THE Special Reinforcement Chart Reference SHALL display a heading that visually distinguishes it from the standard chart reference heading.
4. THE Special Reinforcement Chart Reference SHALL display one row per entry in `specialTable`, showing the roll number(s) and the corresponding result description.
5. WHEN a `specialTable` entry has a `baseUnitId`, THE Special Reinforcement Chart Reference SHALL display the human-readable unit label for that entry using the same label resolution as the standard chart.
6. WHEN a `specialTable` entry has a `result` of `"choice"`, THE Special Reinforcement Chart Reference SHALL append "with choice of option" to the unit label, consistent with the standard chart display.
7. WHEN a `specialTable` entry has a `rare` value, THE Special Reinforcement Chart Reference SHALL append the rare limit indicator (e.g. `Rare 2`) to the entry description, consistent with the standard chart display.
8. WHEN a `specialTable` entry has a `count` greater than 1, THE Special Reinforcement Chart Reference SHALL append the count multiplier (e.g. `×2`) to the entry description, consistent with the standard chart display.
9. THE Special Reinforcement Chart Reference SHALL use the same visual style (typography, spacing, colour, opacity) as the standard reinforcement chart reference rows.
