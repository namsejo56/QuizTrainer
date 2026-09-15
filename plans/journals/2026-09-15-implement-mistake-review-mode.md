---
title: Implement mistake review mode
date: 2026-09-15
summary: Added a persistent per-quiz mistake bank with automatic and manual mastery flows.
---

# Implement mistake review mode

## What happened
QuizTrainer previously randomized or ranged over the full saved quiz. Test results already kept question snapshots and correctness, but results only identified quizzes by name and there was no mutable mistake-bank state.

## Decision
Store `mistakeQuestionKeys` and a one-time `mistakeBankVersion` marker directly on each saved quiz. Pass `quizId` into quiz sessions and new result records. Build stable question keys from source ID, URL, or canonical question content so membership is independent of sorting and shuffled choices.

The Review Mistakes mode snapshots the active bank before range/random selection. Wrong and unanswered questions enter or remain in the bank. Correct answers remove a question only when automatic removal is enabled; manual mode exposes Mastered and Review again after grading, with Mastered disabled following a wrong answer.

## Verification
Node syntax checks passed for `db.js`, `index.js`, and `quiz_trainer.js`. `git diff --check` passed. A temporary headless-Chrome harness verified normal-practice insertion, manual wrong-answer controls, automatic removal after a correct answer, stable current-session questions, legacy-history bootstrap including a question without URL, and disabled mistake review for an unsaved quiz. Temporary browser profiles, fixtures, servers, and browser processes were removed after the run.

## Next steps
No follow-up is required for the requested scope. If editable quiz questions are added later, define how changed question identities should remap or prune existing mistake keys.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
