# Bugfix Requirements Document

## Introduction

Temporary ATO wanderers (selected via WandererSelectionPage for single-match use) are incorrectly passed to PostMatchSummaryPage in both the `casualties` and `xpGained` arrays. PostMatchSummaryPage then crashes when attempting injury rolls and experience calculations because temp wanderers don't exist in `company.members`. Additionally, the XP counter is displayed for temp wanderers during match tracking despite them not needing experience tracking.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a temporary ATO wanderer is marked as casualty during match tracking AND the match ends THEN the system includes the wanderer in the `casualties` array passed to PostMatchSummaryPage, causing a crash when injury processing attempts to find the member in `workingCompany.members`

1.2 WHEN a temporary ATO wanderer participates in a match THEN the system displays an XP counter with increment/decrement buttons for that wanderer during match tracking, despite XP being irrelevant for temporary units

1.3 WHEN a temporary ATO wanderer has XP counter gains AND the match ends THEN the system may include stale XP data in navigation state passed to post-match summary (even though `isAtoWanderer` filter exists for `xpGained`, the counter UI misleads users into tracking XP for temp units)

### Expected Behavior (Correct)

2.1 WHEN a temporary ATO wanderer is marked as casualty during match tracking AND the match ends THEN the system SHALL exclude the wanderer from the `casualties` array in `PostMatchData`, preventing any injury processing for temporary units

2.2 WHEN a temporary ATO wanderer is rendered in the match tracking member card THEN the system SHALL NOT display the XP counter (increment/decrement buttons and label) for that wanderer

2.3 WHEN the match ends THEN the system SHALL exclude all temporary ATO wanderers from both `casualties` and `xpGained` arrays in the `PostMatchData` passed to PostMatchSummaryPage

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a permanent company member (leader, sergeant, hero_in_making, warrior) is marked as casualty THEN the system SHALL CONTINUE TO include them in the `casualties` array and process their injuries normally in PostMatchSummaryPage

3.2 WHEN a permanent company member participates in a match THEN the system SHALL CONTINUE TO display the XP counter and track XP gains for that member during match tracking

3.3 WHEN a permanent wanderer (hired via `company.wandererId`) participates in a match THEN the system SHALL CONTINUE TO process their XP and casualties normally as they are part of `company.members`

3.4 WHEN a temporary ATO wanderer participates in a match THEN the system SHALL CONTINUE TO display the wanderer in the match tracking member list with stats, M/W/F controls, casualty toggle, and "Temporary" chip

3.5 WHEN a temporary ATO wanderer participates in a match THEN the system SHALL CONTINUE TO include them in break point calculations (active member count)

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type MemberMatchState
  OUTPUT: boolean
  
  // Returns true when the member is a temporary ATO wanderer
  // (their memberId exists in wanderers.json but NOT in company.members)
  RETURN isAtoWanderer(X.memberId)
END FUNCTION
```

```pascal
// Property: Fix Checking — Temp wanderer exclusion from post-match data
FOR ALL X WHERE isBugCondition(X) DO
  postMatchData ← buildPostMatchData'(matchState)
  ASSERT X.memberId NOT IN postMatchData.casualties[].memberId
  ASSERT X.memberId NOT IN postMatchData.xpGained[].memberId
  ASSERT xpCounter NOT rendered for X in MatchTrackingPage
END FOR
```

```pascal
// Property: Preservation Checking — Permanent members unaffected
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT buildPostMatchData(matchState) = buildPostMatchData'(matchState) for member X
  ASSERT xpCounter rendered for X in MatchTrackingPage (unchanged)
END FOR
```
