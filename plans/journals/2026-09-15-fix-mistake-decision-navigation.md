---
title: Fix mistake decision navigation
date: 2026-09-15
summary: Manual mistake decisions now persist and immediately advance or finish the quiz.
---

# Fix mistake decision navigation

## What happened
In manual Review Mistakes mode, clicking Mastered or Review again persisted the bank decision but rendered the same question again. The controls therefore appeared unresponsive even though IndexedDB was updated.

## Root cause
Both button handlers ended with `renderQuestion()` and never advanced `currentQuestion` or completed the quiz when the decision belonged to the final question.

## Fix
Added one shared completion helper. It persists the selected decision, advances and renders the next question when available, or submits the quiz on the final question. Both decision buttons are disabled while the async update runs to provide immediate feedback and prevent double actions.

## Verification
A browser regression test first reproduced `Timed out: advance after Review again`. With the fix and a fresh browser profile, it passed both transitions: Review again moved from question 1 to question 2, and Mastered on the final question persisted the bank state and opened results. JavaScript syntax and `git diff --check` also passed; all temporary test artifacts and processes were removed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
