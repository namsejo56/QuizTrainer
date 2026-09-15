---
title: Fix overflowing question navigation
date: 2026-09-14
summary: Keep large question grids from covering quiz content.
---

# Fix overflowing question navigation

## What happened
The question-number sidebar was fixed at 420px wide while the quiz container reserved only 290px, so it overlapped question content on wide screens. With many questions, its uncapped height could also extend beyond the viewport.

## Decision
Use a two-column grid for the active quiz on wide screens. Keep the sidebar within its column and cap its height so its own contents scroll. On narrower screens, stack it above the question with a smaller height cap. Size number cells to a minimum of 44px.

## Verification
Rendered a 200-question layout with the project CSS at 1440px and 500px widths in headless Chrome. Both kept the question visible. git diff --check and node --check quiz_trainer.js passed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
