# Bugfix Requirements Document

## Introduction

When using "Attempt Recovery" (roll D6, need 5+) to treat a hero's wound, a failed roll should prompt the user to spend additional IP to boost the result (1 IP = +1 to roll). The user may spend any number of available IP this way. The MemberDetailsDrawer partially implements this but only allows 1 IP spend as auto-success. The CompanyDetailsPage Store Injuries tab has the IP boost functionality but presents it *before* the roll (as a pre-roll boost) rather than *after* a failed roll as a post-roll rescue option.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a hero attempts recovery in the CompanyDetailsPage Store Injuries tab THEN the system presents the IP boost option BEFORE rolling the dice (as a pre-roll modifier) rather than AFTER a failed roll as a post-roll rescue mechanism

1.2 WHEN a hero's recovery roll fails in the MemberDetailsDrawer THEN the system only offers spending exactly 1 IP which treats the result as automatic success, rather than allowing the user to spend any number of IP (1 IP = +1 to roll result) to try to reach the success threshold of 5+

1.3 WHEN a hero's recovery roll fails in the CompanyDetailsPage Store Injuries tab THEN the system does not display the company's current IP balance alongside the failed result or offer a post-roll boost option

### Expected Behavior (Correct)

2.1 WHEN a hero's recovery roll fails in the CompanyDetailsPage Store Injuries tab THEN the system SHALL display the failed roll result, the company's current IP balance, and an option to spend IP to boost the result (1 IP = +1 to roll, any number of available IP may be spent); the pre-roll boost option SHALL be removed

2.2 WHEN a hero's recovery roll fails in the MemberDetailsDrawer THEN the system SHALL allow the user to spend any number of available IP to boost the roll result (1 IP = +1), and the recovery succeeds only if the boosted total reaches 5+

2.3 WHEN a hero's recovery roll fails in either location THEN the system SHALL display the current roll result, the company's current IP balance, and increment/decrement controls to choose how many IP to spend as a boost

2.4 WHEN a hero attempts recovery in either location THEN the system SHALL roll the dice FIRST without any pre-roll IP modifier, and only present the IP boost option if the roll fails

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a hero's recovery roll succeeds (natural roll ≥ 5) THEN the system SHALL CONTINUE TO show the success result and allow confirming without any IP boost prompt

3.2 WHEN a warrior's "Missing Next Game" injury is treated (1 IP removal, no roll) THEN the system SHALL CONTINUE TO remove the injury and deduct 1 IP without any roll or boost prompt

3.3 WHEN a hero chooses "Send to Healers" (miss next game to remove injury, 1 IP) THEN the system SHALL CONTINUE TO process the treatment without any roll or boost prompt

3.4 WHEN the user has insufficient IP to spend on a boost THEN the system SHALL CONTINUE TO disable the boost increment control and allow the user to accept the failed result
