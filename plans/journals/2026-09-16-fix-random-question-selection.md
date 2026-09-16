---
title: Fix random question selection
date: 2026-09-16
summary: Shuffle the full question pool whenever Random is selected.
---

# Fix random question selection

## What happened

Random question selection only shuffled when the available pool was larger than the requested count. When users selected every available question, repeated starts preserved the source order even though Random was selected.

## Decision

Always shuffle the question pool before slicing it to the requested count. Range selection and answer-choice shuffling remain unchanged. Added a Node regression test that runs the browser script in a VM and covers the full-pool case.

## Verification

The regression test failed before the fix with both runs returning IDs 1 through 12, then passed after the fix. JavaScript syntax and git diff checks passed. A temporary browser fixture also showed different first questions across repeated 12-of-12 Random starts.

## Next steps

No follow-up is required for this bug.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
