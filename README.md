# QuizTrainer

This is a quiz training application built with HTML, CSS, and JavaScript.

QuizTrainer supports practice, timed tests, flashcards, and mistake review. Saved
quizzes keep a persistent mistake bank that can remove mastered questions
automatically after a correct answer or manually through self-assessment.

Imported questions can include a `comments` array with nested `replies` arrays.
The collapsible Discussion section preserves that hierarchy and shows author,
date, text, selected answer, and upvotes. It appears after answering in practice
or mistake review, after flipping a flashcard to its answer, and in result
details. Discussion stays hidden during timed tests. Quizzes without comments
continue to work as before.

[Live Demo](https://namsejo56.github.io/QuizTrainer/)
