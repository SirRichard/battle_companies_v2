# Temp Wanderer Post-Match Exclusion — Bugfix Design

## Overview

`handleEndMatch()` in MatchTrackingPage builds `casualties` array from ALL members with `isCasualty === true` — missing `isAtoWanderer` filter that `xpGained` already uses. Result: PostMatchSummaryPage hangs on injury step because `workingCompany.members.find()` returns undefined for temp wanderer, causing early return without advancing injury index. Secondary issue: XP counter rendered for temp wanderers during match tracking despite being irrelevant.

Fix: add same `isAtoWanderer` filter to casualties array construction, hide XP counter in MemberMatchCard when `isAtoWanderer` prop is true.

## Glossary

- **Bug_Condition (C)**: Member is temporary ATO wanderer — `isAtoWanderer(memberId)` returns true (memberId exists in wanderers.json but NOT in company.members)
- **Property (P)**: Temp wanderers excluded from `casualties` and `xpGained` arrays; XP counter hidden during tracking
- **Preservation**: Permanent company members (leader, sergeant, hero_in_making, warrior) continue to have casualties processed, XP tracked, and counters displayed
- **handleEndMatch**: Function in `MatchTrackingPage.tsx` that builds `PostMatchData` and navigates to post-match summary
- **MemberMatchCard**: Sub-component rendering individual member during match tracking
- **isAtoWanderer**: Helper function checking if memberId is in wanderers.json but NOT in company.members

## Bug Details

### Bug Condition

Bug manifests when temporary ATO wanderer (selected via WandererSelectionPage for single-match use) is marked as casualty during match tracking. `handleEndMatch` includes them in `casualties` array without filtering. PostMatchSummaryPage then hangs because `handleDiceSettled` (line ~533) does `workingCompany.members.find(m => m.id === casualty.memberId)` → returns undefined → early return without calling `advanceInjuryIndex` → injury step stuck forever.

Secondary: XP counter always rendered in MemberMatchCard regardless of `isAtoWanderer` prop.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type MemberMatchState
  OUTPUT: boolean
  
  LET wandererIds = SET of all IDs from wanderers.json
  LET companyMemberIds = SET of all IDs from company.members
  
  RETURN wandererIds.has(input.memberId)
         AND NOT companyMemberIds.has(input.memberId)
END FUNCTION
```

### Examples

- Temp wanderer "Gandalf the Wanderer" (id: `gandalf_wanderer`) marked casualty → included in `casualties` array → PostMatchSummaryPage hangs on injury roll step (expected: excluded from casualties entirely)
- Temp wanderer with `xpCounterGains: 3` → XP counter displayed with +/- buttons during match (expected: no XP counter shown)
- Permanent company member "Aragorn" (id in company.members) marked casualty → correctly included in casualties, injury processed normally (this works correctly today)
- Permanent wanderer hired via `company.wandererId` → their ID IS in company.members → `isAtoWanderer` returns false → processed normally (this works correctly today)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Permanent company members (leader, sergeant, hero_in_making, warrior) with `isCasualty === true` continue to appear in `casualties` array and get injury processing
- Permanent company members continue to have XP counter displayed during match tracking
- Permanent wanderer (hired via `company.wandererId`, present in `company.members`) continues to be processed for both casualties and XP
- Temp ATO wanderer still displayed in match tracking member list with stats, M/W/F controls, casualty toggle, and "Temporary" chip
- Temp ATO wanderer still counted in break point calculations (active member count)

**Scope:**
All members where `isAtoWanderer(memberId)` returns false are completely unaffected by this fix. This includes:
- All permanent company members (any role)
- Permanent wanderers (hired via company.wandererId)
- Any member whose ID is in company.members array

## Hypothesized Root Cause

Based on code analysis, root causes confirmed:

1. **Missing filter on casualties array** (MatchTrackingPage.tsx, `handleEndMatch`, ~line 220):
   - `xpGained` correctly filters with `.filter((mm) => !isAtoWanderer(mm.memberId))`
   - `casualties` uses `.filter((m) => m.isCasualty)` with NO `isAtoWanderer` check
   - Simple omission — developer added filter to xpGained but forgot casualties

2. **XP counter always rendered** (MatchTrackingPage.tsx, `MemberMatchCard`, ~line 1195):
   - XP counter section has no conditional on `isAtoWanderer` prop
   - Prop `isAtoWanderer` is passed to component but never used to gate XP display
   - Component receives prop for "Temporary" chip display but doesn't use it for XP hiding

3. **PostMatchSummaryPage silent hang** (PostMatchSummaryPage.tsx, `handleDiceSettled`, ~line 533):
   - `workingCompany.members.find(m => m.id === casualty.memberId)` returns undefined
   - Guard `if (!member) return` exits without advancing to next casualty
   - Injury step gets permanently stuck — no crash per se, but UI is frozen

## Correctness Properties

Property 1: Bug Condition - Temp Wanderer Excluded From Post-Match Arrays

_For any_ match state containing a mix of permanent members and temporary ATO wanderers, where some members have `isCasualty === true`, the fixed `handleEndMatch` function SHALL produce a `PostMatchData` where no temporary ATO wanderer appears in either the `casualties` or `xpGained` arrays, regardless of their `isCasualty` or `xpCounterGains` values.

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - Permanent Members Unaffected In Post-Match Arrays

_For any_ match state containing permanent company members (members whose ID exists in `company.members`), the fixed code SHALL produce identical `casualties` and `xpGained` entries for those members as the original code would for non-ATO-wanderer members, preserving all injury processing and XP tracking for permanent roster.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming root cause analysis is correct:

**File**: `src/pages/MatchTrackingPage.tsx`

**Function**: `handleEndMatch`

**Specific Changes**:
1. **Add isAtoWanderer filter to casualties**: Add `.filter((m) => !isAtoWanderer(m.memberId))` before `.map(...)` in casualties construction (same pattern as xpGained)

**Current code (~line 220):**
```typescript
casualties: match.members
  .filter((m) => m.isCasualty)
  .map((m) => ({...})),
```

**Fixed code:**
```typescript
casualties: match.members
  .filter((m) => m.isCasualty && !isAtoWanderer(m.memberId))
  .map((m) => ({...})),
```

**File**: `src/pages/MatchTrackingPage.tsx`

**Component**: `MemberMatchCard`

**Specific Changes**:
2. **Hide XP counter for ATO wanderers**: Wrap XP counter section (Row 5, ~line 1195) in conditional `{!isAtoWanderer && (...)}` to suppress rendering when member is temp wanderer

**Current code:**
```typescript
{/* Row 5: XP counter */}
<Box sx={{...}}>
  ...XP counter UI...
</Box>
```

**Fixed code:**
```typescript
{!isAtoWanderer && (
  <>
    <Divider sx={{ opacity: 0.2, mb: 1 }} />
    {/* Row 5: XP counter */}
    <Box sx={{...}}>
      ...XP counter UI...
    </Box>
  </>
)}
```

## Testing Strategy

### Validation Approach

Two-phase approach: first surface counterexamples demonstrating bug on unfixed code, then verify fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating bug BEFORE implementing fix. Confirm root cause.

**Test Plan**: Extract `handleEndMatch` logic into testable pure function that builds PostMatchData from match state + company. Run against inputs containing ATO wanderers marked as casualties.

**Test Cases**:
1. **Single ATO wanderer casualty**: Match with 1 temp wanderer marked casualty → assert wanderer appears in casualties (will fail after fix)
2. **Mixed casualties**: Match with 2 permanent + 1 temp wanderer all casualties → assert temp wanderer in casualties (will fail after fix)
3. **XP counter rendering**: Render MemberMatchCard with `isAtoWanderer=true` → assert XP counter present (will fail after fix)

**Expected Counterexamples**:
- ATO wanderer memberId found in `casualties` array output
- XP counter DOM elements present when `isAtoWanderer=true`

### Fix Checking

**Goal**: Verify for all inputs where bug condition holds, fixed function produces expected behavior.

**Pseudocode:**
```
FOR ALL matchState WHERE matchState.members contains ATO wanderers DO
  postMatchData := buildPostMatchData_fixed(matchState, company)
  FOR ALL member IN matchState.members WHERE isAtoWanderer(member.memberId) DO
    ASSERT member.memberId NOT IN postMatchData.casualties[].memberId
    ASSERT member.memberId NOT IN postMatchData.xpGained[].memberId
  END FOR
END FOR
```

### Preservation Checking

**Goal**: Verify for all inputs where bug condition does NOT hold, fixed function produces same result as original.

**Pseudocode:**
```
FOR ALL matchState, FOR ALL member WHERE NOT isAtoWanderer(member.memberId) DO
  LET original_casualties = buildPostMatchData_original(matchState, company).casualties
  LET fixed_casualties = buildPostMatchData_fixed(matchState, company).casualties
  // For this specific non-ATO member:
  ASSERT (member IN original_casualties) IFF (member IN fixed_casualties)
  // XP entries identical for non-ATO members:
  LET original_xp = buildPostMatchData_original(matchState, company).xpGained
  LET fixed_xp = buildPostMatchData_fixed(matchState, company).xpGained
  ASSERT original_xp[member] = fixed_xp[member]
END FOR
```

**Testing Approach**: Property-based testing recommended for preservation checking because:
- Generates many random match configurations (varying member counts, roles, casualty states)
- Catches edge cases like all members being casualties, no casualties, mixed wanderer/permanent
- Strong guarantees behavior unchanged for all non-ATO inputs

**Test Plan**: Extract post-match data building logic into pure function. Generate random `ActiveMatchState` + `Company` pairs. Assert permanent member entries identical between original and fixed versions.

**Test Cases**:
1. **Permanent casualty preservation**: Generate random company with permanent members as casualties → verify all appear in fixed output
2. **XP preservation**: Generate random company with permanent members having various xpCounterGains → verify XP entries identical
3. **Permanent wanderer preservation**: Company with `wandererId` set and that member as casualty → verify still processed
4. **Break point preservation**: Verify temp wanderer still counted in `match.members.length` for break point calc

### Unit Tests

- Test `isAtoWanderer` helper returns true for wanderer IDs not in company.members
- Test `isAtoWanderer` helper returns false for permanent wanderer (in company.members)
- Test casualties array excludes ATO wanderer when marked casualty
- Test XP counter not rendered when `isAtoWanderer=true`

### Property-Based Tests

- Generate random match states with mix of ATO wanderers and permanent members, verify ATO wanderers never in casualties/xpGained output
- Generate random match states with only permanent members, verify output identical to original logic
- Generate random `isAtoWanderer` prop values, verify XP counter visibility matches expectation

### Integration Tests

- Full flow: select ATO wanderer → mark casualty during match → end match → verify PostMatchSummaryPage loads without hanging
- Full flow: permanent member casualty → end match → verify injury processing works normally
- Verify break point calculation still includes temp wanderer in active count
