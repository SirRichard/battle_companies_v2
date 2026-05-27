# Requirements Document

## Introduction

Enhancements to the company creation wizard improving information accessibility, equipment purchasing UX, and confirmation flow. Covers: full-text path special rules, equipment description info icons, Envenom Weapon parameterised purchase with weapon selection, and smart gold-confirmation suppression when all gold is spent.

## Glossary

- **Wizard**: The multi-step company creation flow rendered by `CreateCompanyPage`
- **Path_Card**: The swipeable card UI in `PathCardSelector` that displays a hero path's details during path selection (Step 6)
- **Equipment_Tab**: The "Equipment" tab within `StepGoldEquipment` showing purchasable equipment items
- **Info_Icon**: A small "i" button rendered beside an equipment item that opens a popover/dialog with the item's description
- **Envenom_Weapon**: The equipment item (`envenom_weapon`) that applies the Poisoned Attacks special rule to a chosen weapon on the bearer
- **Member_Drawer**: The `MemberDetailsDrawer` bottom-sheet component showing full member details
- **Gold_Confirm_Dialog**: The `ConfirmDialog` shown when the user attempts to finalise the company from the Gold step

## Requirements

### Requirement 1: Full Path Special Rule Text

**User Story:** As a player, I want to read path special rules in their entirety during path selection, so that I can make an informed decision about which path to choose for my hero.

#### Acceptance Criteria

1. WHEN a path card is displayed, THE Path_Card SHALL render the full description text of each path special rule without truncation.
2. WHEN a path special rule description exceeds the visible area, THE Path_Card SHALL allow the user to scroll or expand to read the complete text.
3. THE Path_Card SHALL display all path special rules listed in the progression table for rolls 2, 3, 11, and 12.

### Requirement 2: Equipment Description Info Icon

**User Story:** As a player, I want to see an info icon next to equipment items during gold purchasing, so that I can read what each piece of equipment does before buying it.

#### Acceptance Criteria

1. WHEN an equipment item has a `description` field defined, THE Equipment_Tab SHALL display an Info_Icon adjacent to that item's label.
2. WHEN an equipment item does not have a `description` field defined, THE Equipment_Tab SHALL NOT display an Info_Icon for that item.
3. WHEN the user presses the Info_Icon, THE Equipment_Tab SHALL display a popover or dialog containing the full description text of that equipment item.
4. WHEN the description popover is open, THE Equipment_Tab SHALL provide a way to dismiss the popover (tap outside or close button).

### Requirement 3: Envenom Weapon Purchase with Weapon Selection

**User Story:** As a player, I want to purchase the Envenom Weapon equipment and select which weapon receives the poison, so that the envenom is correctly tracked on a specific weapon.

#### Acceptance Criteria

1. WHEN the user purchases the Envenom_Weapon item, THE Equipment_Tab SHALL prompt the user to select one weapon from the target member's weapon list.
2. THE Equipment_Tab SHALL only present melee and ranged weapons (wargear with category "weapon", "bow", "crossbow", or similar combat equipment) as valid envenom targets, excluding shields, armour, and mounts.
3. WHEN the user selects a weapon for envenom, THE Wizard SHALL store the purchase as a parameterised entry associating the envenom with the chosen weapon identifier.
4. WHEN a member has an envenomed weapon, THE Member_Drawer SHALL display the equipment entry as "Envenom Weapon (<weaponLabel>)" where `<weaponLabel>` is the human-readable name of the chosen weapon.
5. WHEN a weapon on a member already has the envenom feature applied, THE Equipment_Tab SHALL NOT offer that weapon as a valid target for a subsequent Envenom_Weapon purchase.
6. WHEN a weapon on a member already has the envenom feature applied, THE Wizard SHALL NOT allow that weapon to receive envenom through Against the Odds bonuses.
7. IF the user cancels the weapon selection prompt without choosing a weapon, THEN THE Equipment_Tab SHALL NOT complete the Envenom_Weapon purchase.

### Requirement 4: Suppress Gold Confirmation When All Gold Spent

**User Story:** As a player, I want to skip the "unspent gold" confirmation dialog when I have already spent all my gold, so that I can finish company creation faster without unnecessary prompts.

#### Acceptance Criteria

1. WHEN the user attempts to finalise the company and gold remaining equals zero, THE Wizard SHALL proceed directly to company creation without displaying the Gold_Confirm_Dialog.
2. WHEN the user attempts to finalise the company and gold remaining is greater than zero, THE Wizard SHALL display the Gold_Confirm_Dialog warning about unspent gold.
3. THE Wizard SHALL calculate gold remaining as the company's starting gold minus the sum of all gold costs of purchased items across all members.
