# Bugfix Requirements Document

## Introduction

Hero upgrades defined in `companies.json` (the `heroUpgrade` array on each `CompanyDefinition`) are being automatically assigned to heroes during company creation. This is incorrect. Hero upgrades are a post-match promotion reward — heroes may only receive them during the `PostMatchSummaryPage` when promotions are given out, by swapping a rolled advancement result for a Company-Specific Hero Upgrade they do not already possess. Companies with multiple hero upgrades (e.g. The Shire) allow each hero to eventually gain all of them, but only one of each at a time.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a new company is created via the wizard THEN the system assigns hero upgrade IDs from `companyDef.heroUpgrade` to hero members' `equipment` arrays automatically

1.2 WHEN a hero member is created with a role of `leader` or `sergeant` THEN the system includes company hero upgrade IDs in the member's starting `equipment` without any player action

1.3 WHEN a company has multiple hero upgrades (e.g. The Shire with `of_a_party_sort` and others) THEN the system assigns all of them to heroes at creation time rather than making them available as promotion rewards

### Expected Behavior (Correct)

2.1 WHEN a new company is created via the wizard THEN the system SHALL create hero members with no hero upgrade IDs in their `equipment` arrays

2.2 WHEN a hero member is created with a role of `leader` or `sergeant` THEN the system SHALL NOT include any company hero upgrade IDs in the member's starting `equipment`

2.3 WHEN a hero reaches an advancement threshold during the `PostMatchSummaryPage` progression step THEN the system SHALL offer the hero the option to swap their rolled promotion result for any eligible Company-Specific Hero Upgrade they do not already possess

2.4 WHEN a hero selects a Company-Specific Hero Upgrade as their promotion result THEN the system SHALL add that upgrade's ID to the hero's `equipment` array

2.5 WHEN a company has multiple hero upgrades THEN the system SHALL allow each hero to gain each upgrade individually over time, but SHALL NOT assign the same upgrade ID to a hero more than once

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a hero already possesses a hero upgrade (its ID is in `member.equipment`) THEN the system SHALL CONTINUE TO exclude that upgrade from the list of eligible swap options offered during post-match progression

3.2 WHEN `getEligibleHeroUpgrades` is called for a hero member THEN the system SHALL CONTINUE TO filter upgrades by `baseUnitIds` and `allowedKeywords` constraints as currently implemented

3.3 WHEN a hero upgrade is displayed in `MemberDetailsDrawer` THEN the system SHALL CONTINUE TO show only upgrades the hero already possesses (those present in `member.equipment`)

3.4 WHEN a warrior is promoted or gains a stat increase during post-match progression THEN the system SHALL CONTINUE TO apply those advancements without interference from the hero upgrade swap flow

3.5 WHEN a company is loaded from the database THEN the system SHALL CONTINUE TO correctly read hero upgrade IDs from `member.equipment` to determine which upgrades a hero already has
