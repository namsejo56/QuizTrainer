---
title: Add hierarchical question discussions
date: 2026-10-04
summary: "Read-only nested comments across quiz feedback, flashcards and result details."
---

# Add hierarchical question discussions

Added read-only Discussion to imported questions using recursive comments/replies rendering and native details/summary controls. Metadata and text are escaped; valid upvotes remain display-only. Practice and mistake review reveal comments after grading, flashcards after flipping, and result details on review. Timed tests hide comments.

Validation: node --test passed 7 tests; node --check quiz_trainer.js and git diff --check passed. Browser checks used two real DEA-C01 questions, including four-level nesting, desktop and 390px mobile layouts, visibility gates, current/saved-result rendering and Enter-key disclosure. Automated upload was blocked by extension file-access permissions, so real data was provided to sessionStorage with no quiz/result database writes. Test browser and local server were stopped.

README and completed plan records describe the behavior. No import, schema, scoring or storage contracts changed. AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
