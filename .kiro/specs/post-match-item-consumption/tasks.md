# Implementation Plan: Post-Match Item Consumption

## Overview

Implement post-match consumption logic for Wondrous Cram and Healing Herbs. New utility module with pure functions, block battle-time usage in MatchTrackingPage, extend PostMatchData, add pre-injury resolution phase in PostMatchSummaryPage with user prompts for permanent items.

## Tasks

- [ ] 1. Create item consumption utility module
  - [x] 1.1 Create `src/utils/itemConsumption.ts` with `isPostMatchOnlyItem()`, `findWondrousCramCandidates()`, `findHealingHerbsCandidates()`, and `removeOwnedEquipment()` pure functions
    - Define `POST_MATCH_ONLY_ITEMS` set containing `'wondrous_cram'` and `'healing_herbs'`
    - `isPostMatchOnlyItem(itemId)` returns true if itemId in set
    - `findWondrousCramCandidates` returns candidates where member is casualty AND has item (toolkit or ownedEquipment), with `source: 'temporary' | 'permanent'`
    - `findHealingHerbsCandidates` returns candidates where member is hero, NOT casualty, AND has item
    - `removeOwnedEquipment` returns new Member with item removed from `ownedEquipment`
    - Export `ItemConsumptionCandidate` interface
    - _Requirements: 2.1, 2.3, 3.1, 3.3, 2.4, 3.4_

  - [x] 1.2 Write property test: `isPostMatchOnlyItem` correctness
    - **Property 1: Post-match-only items render as passive chips during battle**
    - **Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.2, 6.3**
    - Test file: `src/utils/__tests__/itemConsumption.property.test.ts`

  - [x] 1.3 Write property test: Wondrous Cram eligibility requires casualty status
    - **Property 2: Wondrous Cram eligibility requires casualty status**
    - **Validates: Requirements 2.1, 2.3**

  - [x] 1.4 Write property test: Healing Herbs eligibility requires non-casualty hero
    - **Property 5: Healing Herbs eligibility requires non-casualty hero status**
    - **Validates: Requirements 3.1, 3.3**

  - [x] 1.5 Write property test: `removeOwnedEquipment` removes exactly target item
    - **Property 4: Permanent Wondrous Cram removal after consumption**
    - **Validates: Requirements 2.4**

  - [x] 1.6 Write property test: Healing Herbs always removed on consumption
    - **Property 7: Healing Herbs always removed on consumption**
    - **Validates: Requirements 3.4**

  - [x] 1.7 Write property test: temporary vs permanent source classification
    - **Property 8: Temporary items auto-consume without prompt**
    - **Property 9: Permanent items require user confirmation**
    - **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Block battle-time consumption in MatchTrackingPage
  - [x] 3.1 Import `isPostMatchOnlyItem` into `src/pages/MatchTrackingPage.tsx`
    - In `MemberMatchCard` toolkit rendering, gate "Use" button: show only if `isConsumable(item.itemId) && !isPostMatchOnlyItem(item.itemId)`
    - For post-match-only items, render passive `Chip` (no click handler) showing item label
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3_

- [ ] 4. Extend PostMatchData with toolkit items
  - [x] 4.1 Add `toolkitItems: ToolkitItem[]` field to `PostMatchData` interface in `src/models/postmatch.ts`
    - Import `ToolkitItem` type from `'./match'`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Pass `toolkitItems` from `ActiveMatchState` into `PostMatchData` in `MatchTrackingPage.handleEndMatch()`
    - Add `toolkitItems: match.toolkitItems` to the postMatchData object built in handleEndMatch
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 5. Implement pre-injury item resolution phase in PostMatchSummaryPage
  - [x] 5.1 Add `ItemResolutionState` and item resolution logic to `PostMatchSummaryPage`
    - Add state: `phase ('cram' | 'herbs' | 'done')`, `cramCandidates`, `herbsCandidates`, `cramIndex`, `herbsIndex`, `injuryModifier (0 | 1)`, `resolvedCramMembers (Set<string>)`
    - On page load (before injuries step), compute candidates using utility functions
    - Auto-consume temporary cram candidates (remove from injury queue, set Full Recovery)
    - Auto-consume temporary herbs candidates (set modifier to 1, remove item not needed since toolkit)
    - For permanent candidates, show `ItemConsumptionPrompt` dialog
    - Process cram before herbs (requirement 7.3)
    - After all resolution done, proceed to existing injury step with modifier applied
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3_

  - [x] 5.2 Create `ItemConsumptionPrompt` dialog component inline or as separate file
    - Props: `open`, `memberName`, `itemLabel`, `itemDescription`, `onAccept`, `onDecline`
    - Show item name, description, member name, and Accept/Decline buttons
    - Match existing app dialog styling (dark theme, gold accents)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.3 Apply injury modifier (+1) to injury rolls when Healing Herbs consumed
    - When `injuryModifier === 1`, add +1 to 2D6 injury roll result (cap at 12)
    - Modifier not cumulative — multiple herbs still only +1
    - Apply to ALL casualties remaining in queue (after cram removal)
    - _Requirements: 3.2, 7.2_

  - [x] 5.4 Write property test: Cram-consumed members excluded from injury queue
    - **Property 3: Cram-consumed members excluded from injury queue**
    - **Validates: Requirements 2.2, 7.1**

  - [x] 5.5 Write property test: Healing Herbs modifier is +1 and not cumulative
    - **Property 6: Healing Herbs modifier is +1 and not cumulative**
    - **Validates: Requirements 3.2, 7.2**

  - [x] 5.6 Write property test: Wondrous Cram resolved before Healing Herbs
    - **Property 10: Wondrous Cram resolved before Healing Herbs**
    - **Validates: Requirements 7.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Wire permanent item removal into company state
  - [x] 7.1 When user accepts permanent item consumption, call `removeOwnedEquipment()` and update `workingCompany` state
    - For Wondrous Cram: remove from member's `ownedEquipment`, member skips injury roll
    - For Healing Herbs: remove from hero's `ownedEquipment`, set injuryModifier to 1
    - When user declines: leave item, proceed normally (member stays in injury queue / no modifier from that hero)
    - _Requirements: 2.4, 3.4, 5.3, 5.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document
- Unit tests validate specific examples and edge cases
- All property tests use fast-check (already in project)
- Test file: `src/utils/__tests__/itemConsumption.property.test.ts`
