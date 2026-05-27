# Wound Recovery IP Boost Bugfix Design

## Overview

The wound recovery IP boost mechanic has three defects across two UI locations (CompanyDetailsPage Store Injuries tab and MemberDetailsDrawer). The CompanyDetailsPage presents the IP boost as a pre-roll modifier instead of a post-roll rescue. The MemberDetailsDrawer also has a pre-roll boost AND a post-roll "Spend 1 IP" button that treats the result as automatic success rather than allowing incremental +1 boosts. Neither location properly shows IP balance with increment/decrement controls after a failed roll. The fix unifies both locations to: roll first → show result → on failure, present IP boost controls (1 IP = +1 to roll, any number allowed up to available IP).

## Glossary

- **Bug_Condition (C)**: A hero's recovery roll fails (result < 5) and the system either (a) presented IP boost before the roll, or (b) only offers a single "spend 1 IP = auto-success" option instead of incremental boost controls
- **Property (P)**: After a failed roll, the system displays the roll result, current IP balance, and increment/decrement controls allowing any number of IP to be spent (1 IP = +1 to roll); recovery succeeds only if boosted total ≥ 5
- **Preservation**: Successful rolls (natural ≥ 5), warrior missing-next-game removal (1 IP, no roll), and "Send to Healers" (1 IP, miss next game) must remain unchanged
- **InjuryTreatmentPanel**: Component in `CompanyDetailsPage.tsx` (line ~1045) handling injury treatment in the Store Injuries tab
- **MemberDetailsDrawer**: Component in `MemberDetailsDrawer.tsx` (line ~205) handling injury treatment from the member detail view
- **treatAdjust**: State variable tracking the number of extra IP to spend as a roll boost
- **treatStage**: State machine controlling the treatment dialog flow: `options → rolling → ip_prompt → confirm`

## Bug Details

### Bug Condition

The bug manifests in two locations when a hero attempts wound recovery via "Attempt Recovery — Roll D6":

1. **CompanyDetailsPage** (`InjuryTreatmentPanel`): Shows IP boost increment/decrement controls BEFORE the roll (pre-roll modifier, capped at +3). The user sets a boost, then rolls. If the roll fails, there is no post-roll rescue option — the user can only accept the failed result.

2. **MemberDetailsDrawer**: Also shows a "Pre-roll IP boost" control before rolling (capped at +3). After a failed roll, it shows a single "Spend 1 IP" button that treats the result as automatic success regardless of the roll value, rather than allowing incremental +1 boosts.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { location: 'store_tab' | 'drawer', rollResult: number, preRollBoost: number, postRollAction: string }
  OUTPUT: boolean

  // Bug manifests when:
  // 1. Pre-roll boost controls are shown (should not exist)
  // 2. Post-roll only offers "auto-success for 1 IP" instead of incremental boost
  // 3. Post-roll does not show IP balance + increment/decrement controls

  hasPreRollBoost := preRollBoost > 0 OR preRollBoostControlsVisible(input.location)
  
  IF input.location == 'store_tab' THEN
    RETURN hasPreRollBoost OR (input.rollResult < 5 AND NOT postRollBoostControlsVisible())
  END IF
  
  IF input.location == 'drawer' THEN
    RETURN hasPreRollBoost OR (input.rollResult < 5 AND postRollAction == 'auto_success_1ip')
  END IF

  RETURN FALSE
END FUNCTION
```

### Examples

- **Store tab, pre-roll boost shown**: User selects "Attempt Recovery", sees +/- controls and sets +2 before rolling → BUG (boost should only appear after failed roll)
- **Store tab, failed roll no rescue**: User rolls a 3, sees "Failed — injury remains" with no option to spend IP to boost → BUG (should show IP boost controls)
- **Drawer, pre-roll boost shown**: User selects "Attempt Recovery", sees "Pre-roll IP boost (optional)" with +/- controls → BUG (boost should only appear after failed roll)
- **Drawer, auto-success**: User rolls a 2, sees "Spend 1 IP" button that auto-succeeds → BUG (should allow spending multiple IP at +1 each, success only if total ≥ 5)
- **Drawer, roll 4 + spend 1 IP**: User rolls 4, spends 1 IP (+1), total = 5 → should succeed (currently auto-succeeds regardless of math, which happens to be correct for this case but wrong semantics)
- **Drawer, roll 1 + spend 1 IP**: User rolls 1, spends 1 IP (+1), total = 2 → should still fail (currently auto-succeeds, which is WRONG)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Natural successful rolls (≥ 5) show success result and allow confirming without any IP boost prompt
- Warrior "Missing Next Game" injury removal (1 IP, no roll) continues to work as-is
- Hero "Send to Healers" (1 IP, miss next game to remove injury) continues to work as-is
- When user has insufficient IP for any boost, increment control is disabled
- The animated die rolling sequence in MemberDetailsDrawer remains unchanged
- Treatment option selection UI (choosing between roll/healers) remains unchanged
- IP deduction logic for base cost (1 IP for attempting recovery) remains unchanged

**Scope:**
All inputs that do NOT involve the post-roll IP boost flow should be completely unaffected by this fix. This includes:
- Successful recovery rolls (natural ≥ 5)
- Non-roll treatment options (remove warrior injury, send to healers)
- Treatment dialog open/close/cancel flows
- IP balance display in the options stage

## Hypothesized Root Cause

Based on code analysis, the root causes are:

1. **CompanyDetailsPage — Pre-roll boost UI placement**: The `InjuryTreatmentPanel` shows the `treatAdjust` increment/decrement controls in the `treatDialog === 'roll'` stage BEFORE the roll button is clicked. The boost controls appear alongside the "Roll D6" button. After rolling, the result is shown but there are no post-roll boost controls — only a "Confirm" button.

2. **CompanyDetailsPage — No post-roll rescue**: After `treatRollResult` is set and the result is < 5, the dialog only shows the result and a "Confirm" button. There is no mechanism to spend additional IP after seeing the failed result.

3. **MemberDetailsDrawer — Pre-roll boost UI**: The `treatType === 'roll_hero'` selection in the `options` stage reveals a "Pre-roll IP boost (optional)" section with +/- controls capped at 3. This should not exist.

4. **MemberDetailsDrawer — Auto-success semantics**: The `handleSpendIP` function (line ~348) always treats spending 1 IP as automatic success — it removes the injury regardless of the roll value. The correct behavior is: each IP spent adds +1 to the roll, and success only occurs if the boosted total ≥ 5.

5. **MemberDetailsDrawer — Single IP limitation**: The "Spend 1 IP" button only allows a single click/spend. There are no increment/decrement controls to choose how many IP to spend as a boost.

## Correctness Properties

Property 1: Bug Condition - Post-Roll IP Boost Replaces Pre-Roll Boost

_For any_ hero recovery attempt where the roll result is less than 5 (failed), the fixed UI SHALL display the roll result, the company's current IP balance, and increment/decrement controls allowing the user to spend N IP (where N is any amount from 0 up to available IP minus the base cost of 1). The recovery SHALL succeed if and only if rollResult + N ≥ 5. No pre-roll boost controls SHALL be shown.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Boost Flows Unchanged

_For any_ recovery attempt where the roll succeeds naturally (≥ 5), or for any non-roll treatment (warrior injury removal, send to healers), the fixed code SHALL produce exactly the same behavior as the original code, preserving successful roll confirmation, warrior treatment, and healer treatment flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/CompanyDetailsPage.tsx`

**Function**: `InjuryTreatmentPanel`

**Specific Changes**:
1. **Remove pre-roll boost controls**: Delete the `treatAdjust` increment/decrement UI from the `treatDialog === 'roll'` stage (the section shown before the "Roll D6" button is clicked)
2. **Add post-roll boost UI**: After `treatRollResult` is set and result < 5, show IP balance and increment/decrement controls for `treatAdjust` (no cap at 3 — allow any amount up to available IP minus base cost)
3. **Update success logic**: Keep existing `treatRollResult + treatAdjust >= 5` check (already correct)
4. **Show IP balance in post-roll view**: Display `company.influence` alongside the failed result
5. **Disable increment when insufficient IP**: Disable the + button when `company.influence < 1 + treatAdjust + 1`

---

**File**: `src/components/common/MemberDetailsDrawer.tsx`

**Function**: `MemberDetailsDrawer` (injury treatment section)

**Specific Changes**:
1. **Remove pre-roll boost controls**: Delete the "Pre-roll IP boost (optional)" section shown when `treatType === 'roll_hero'` in the `options` stage (lines ~1590–1635)
2. **Replace `handleSpendIP` with incremental boost**: Remove the `handleSpendIP` function that auto-succeeds. Replace the single "Spend 1 IP" button in the `ip_prompt` stage with increment/decrement controls for `treatAdjust`
3. **Remove the +3 cap**: The `treatAdjust >= 3` limit should be removed; allow any amount up to `company.influence - 1` (base cost is 1 IP)
4. **Update ip_prompt UI**: Show increment/decrement controls with current boost value, updated total (`rolledValue + treatAdjust`), and dynamic success/failure indicator
5. **Update "Accept Result" button**: The existing `handleTreatConfirm` already handles `rolledValue + treatAdjust >= 5` correctly — keep this logic but ensure it's used for the boosted result
6. **Remove "Spend 1 IP" action button**: Replace with the increment/decrement controls in the dialog content area

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that verify the treatment dialog flow — specifically that no pre-roll boost controls exist, and that after a failed roll the UI presents increment/decrement controls with correct IP math. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Store tab pre-roll boost visible**: Render InjuryTreatmentPanel, open treatment dialog, select "Attempt Recovery" → assert no boost controls visible before rolling (will fail on unfixed code)
2. **Store tab no post-roll controls**: Render InjuryTreatmentPanel, simulate failed roll → assert post-roll boost controls exist (will fail on unfixed code)
3. **Drawer pre-roll boost visible**: Render MemberDetailsDrawer, open treatment, select roll_hero → assert no "Pre-roll IP boost" controls (will fail on unfixed code)
4. **Drawer auto-success semantics**: Simulate roll of 1, spend 1 IP → assert result is still failure (total 2 < 5) (will fail on unfixed code — currently auto-succeeds)

**Expected Counterexamples**:
- Pre-roll boost controls are rendered when they should not be
- Post-roll boost controls are missing from store tab
- Spending 1 IP on a roll of 1 incorrectly removes the injury (auto-success)
- Possible causes: UI shown in wrong stage, `handleSpendIP` bypasses threshold check

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedTreatmentFlow(input)
  ASSERT noPreRollBoostControlsShown(result)
  ASSERT postRollBoostControlsShown(result) WHEN rollResult < 5
  ASSERT ipBalanceDisplayed(result) WHEN rollResult < 5
  ASSERT recoverySucceeds(result) IFF rollResult + ipSpent >= 5
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalTreatmentFlow(input) = fixedTreatmentFlow(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of roll results, IP balances, and treatment types
- It catches edge cases like exactly 0 IP remaining, boundary roll values (4 vs 5)
- It provides strong guarantees that non-boost flows are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for successful rolls, warrior treatments, and healer treatments, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Successful roll preservation**: Generate random rolls ≥ 5 → verify injury removed, 1 IP deducted, no boost prompt shown
2. **Warrior treatment preservation**: Generate warrior with missing_next_game → verify 1 IP removal works identically
3. **Send to Healers preservation**: Generate hero with injury → verify miss-next-game + injury removal works identically
4. **Insufficient IP preservation**: Generate company with 1 IP, failed roll → verify increment disabled, user can only accept failure

### Unit Tests

- Test that no pre-roll boost controls render in either location
- Test post-roll boost controls appear only after failed roll (< 5)
- Test increment/decrement buttons update `treatAdjust` correctly
- Test increment disabled when `company.influence < 1 + treatAdjust + 1`
- Test recovery succeeds when `rollResult + treatAdjust >= 5`
- Test recovery fails when `rollResult + treatAdjust < 5` even with IP spent
- Test IP deduction equals `1 + treatAdjust` (base + boost)

### Property-Based Tests

- Generate random (rollResult, ipBalance, ipSpent) tuples → verify success IFF rollResult + ipSpent >= 5 AND ipSpent <= ipBalance - 1
- Generate random treatment types (warrior removal, healer, roll) → verify non-roll types unchanged
- Generate random successful rolls (5, 6) → verify no boost prompt shown and injury removed with 1 IP cost

### Integration Tests

- Full flow: open treatment → select roll → see die animation → see failed result → boost with IP → confirm success
- Full flow: open treatment → roll → natural success → confirm without boost
- Both locations produce identical behavior for the same inputs
- IP balance updates correctly across multiple treatments in sequence
