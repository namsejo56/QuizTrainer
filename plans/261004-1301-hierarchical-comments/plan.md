---
title: "Hierarchical Discussion UI"
description: "Render nested read-only question comments across quiz and result surfaces without changing quiz data contracts."
status: completed
priority: P2
effort: 3h
branch: master
tags: [feature, frontend]
blockedBy: []
blocks: []
created: 2026-10-04
---

# Hierarchical Discussion UI

## Overview

Add a read-only Discussion section for `q.comments` with canonical nested `replies`, `author`, `created_at`, `text`, `selected_answer`, and finite nonnegative `upvotes`. The implementation uses the existing vanilla JS/CSS flow, native `<details>/<summary>` disclosure controls for keyboard accessibility, and safe HTML escaping. It does not change import, storage, scoring, or the quiz JSON contract.

## Current State

- Implementation is complete in `quiz_trainer.js` and `quiz_trainer.css`.
- Verification is complete. `node --test` passed 7 tests, including the new hierarchical comment coverage.
- README is updated with the new read-only discussion behavior.
- Browser checks used two actual DEA-C01 questions, including a four-level thread, at desktop width and a 390px mobile viewport. All display gates, current/saved-result render paths, reply toggles, and Enter-key collapse passed. Test data was supplied to sessionStorage without saving quizzes or results; automated file upload was blocked by extension permissions.

## Evidence

- Imported and saved quizzes retain original question objects: `index.js` validates only required question fields, pushes the full question object, and `db.js` stores `questions` without projecting fields.
- Test sessions use selected question objects directly and only clone them when shuffling choices in `generateTest`.
- Results preserve full question objects for later detail review through `saveResultToDatabase`, `saveResult`, and `showSavedResult`.
- The implementation is centered on `renderCommentList` returning `{ html, count }` and `renderDiscussion` returning a native `<details class="discussion">` block.
- Existing `sanitizeHTML` escapes untrusted strings; comment author, `created_at`, text, selected answer, and text-like metadata use it before insertion.
- `tests/hierarchical-comments.test.js` covers nesting, escaping, compatibility, visibility gates, and timed-mode hiding. `tests/random-question-selection.test.js` is unchanged.
- Sample DEA-C01 data exists outside this app with 314 questions; the first question has 19 root comments and 3 direct replies. Do not copy private comment text into implementation or plans.

## Scope

In scope:

- Render multi-level `comments[].replies[]` recursively, preserving JSON order.
- Show `author`, `created_at`, `text`, `selected_answer`, and finite nonnegative `upvotes` when present.
- Gracefully hide Discussion when `comments` is absent, empty, malformed, or contains no valid comments.
- Use native collapsible Discussion/reply controls through `<details>/<summary>`.
- Add responsive styling with bounded visual indentation on nested DOM.

Out of scope:

- Posting, voting, editing, sorting, searching, backend sync, schema migration, timed-question discussion display, and non-`replies` nesting formats.

## Visibility Decision

Resolved by default after no user answer within the waiting window:

- Practice and mistake-review modes show Discussion only after the answer is graded.
- Flashcards show Discussion only after the card is flipped, with the Discussion outside the rotating card.
- Result detail modals always show Discussion when comments exist.
- Timed questions hide Discussion during the test.

## Data Flow

JSON import or saved quiz data enters as full question objects, moves into `testSession.questions`, and later into saved result `questions`. `renderDiscussion(question)` reads `question.comments`, delegates recursion and counting to `renderCommentList`, escapes emitted string fields, filters invalid comments, and returns static HTML. Native browser disclosure controls manage collapse state; no custom listener state is stored and no comment data writes back to storage.

## Steps

| Step | Name | Status | Dependencies | File Ownership |
|---|---|---|---|---|
| 1 | Implement Discussion UI | Complete | Existing render paths | `quiz_trainer.js`, `quiz_trainer.css`, `README.md` |
| 2 | Verify with Tests and Browser Checks | Complete | Step 1 complete | `tests/hierarchical-comments.test.js`; browser/manual checks only |

## Test Matrix

| Area | Current Validation |
|---|---|
| Unit/helper | `tests/hierarchical-comments.test.js` verifies recursive root/reply rendering, source order, compatibility, and escaping. |
| Compatibility | Missing, empty, malformed, and invalid comments return no Discussion without throwing. |
| Visibility | Tests cover graded practice/mistakes display, flipped flashcard display, result detail display, and timed-mode hiding. |
| Regression | `node --test` passed 7 tests; random selection test remains unchanged. |
| Browser/manual | Actual DEA-C01 four-level threads remained readable on desktop/mobile; native disclosure keyboard operation and visibility gates passed. Screenshots remain local because they contain contributor identifiers and real comment text. |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| XSS from imported comment fields | Medium | High | Escape all string metadata and text with `sanitizeHTML`; display `upvotes` only when finite and nonnegative. |
| Flashcard layout breaks because the card uses fixed 3D faces | Medium | Medium | Keep Discussion outside the rotating card and reveal it only when the card is flipped. |
| Deep reply nesting becomes unreadable on mobile | Medium | Medium | Use bounded indentation CSS while preserving the nested DOM structure. |
| Saved results without comments or older quizzes throw errors | Low | Medium | Guard with array checks and return an empty string when no valid comments exist. |

## Rollback

Revert the `quiz_trainer.js`, `quiz_trainer.css`, `README.md`, and `tests/hierarchical-comments.test.js` changes. Because there are no data writes, schema changes, or storage migrations, rollback does not require IndexedDB cleanup and existing quizzes/results remain compatible.

## Success Criteria

- Implementation step remains complete with the resolved visibility behavior.
- `node --test` continues to pass the 7-test suite.
- Actual DEA-C01 desktop and mobile browser checks confirm no overlapping controls, unreadable nesting, or flashcard layout regression.
