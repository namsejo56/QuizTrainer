// Home page - index.js
let questions = null;
let fileName = "";

// DOM elements
const els = {
  errorMsg: document.getElementById("errorMsg"),
  savedQuizzesSection: document.getElementById("savedQuizzesSection"),
  savedQuizzesList: document.getElementById("savedQuizzesList"),
  importSection: document.getElementById("importSection"),
  fileInput: document.getElementById("fileInput"),
  fileStatus: document.getElementById("fileStatus"),
  saveQuizModal: document.getElementById("saveQuizModal"),
  quizName: document.getElementById("quizName"),
  saveQuizBtn: document.getElementById("saveQuizBtn"),
  skipSaveBtn: document.getElementById("skipSaveBtn"),
};

// Show error
function showError(message) {
  els.errorMsg.textContent = message;
  els.errorMsg.classList.remove("hidden");
  setTimeout(() => {
    els.errorMsg.classList.add("hidden");
  }, 5000);
}

// Initialize database and load saved quizzes
async function initApp() {
  if (QuizDB.isSupported()) {
    try {
      await quizDB.init();
      await loadSavedQuizzes();
    } catch (err) {
      console.error("Database initialization failed:", err);
    }
  }
}

// Load saved quizzes
async function loadSavedQuizzes() {
  try {
    const quizzes = await quizDB.getAllQuizzes();

    if (quizzes.length === 0) {
      els.savedQuizzesList.innerHTML =
        '<p class="empty-state">No saved quizzes yet. Import a quiz file to get started!</p>';
      return;
    }

    let html = "";
    quizzes.forEach((quiz) => {
      const date = new Date(quiz.createdAt).toLocaleDateString();
      html += `
        <div class="saved-quiz-item" data-quiz-id="${quiz.id}">
          <div class="quiz-info">
            <h3 class="quiz-name">${escapeHtml(quiz.name)}</h3>
            <p class="quiz-meta">
              <span>📄 ${quiz.fileName}</span> 
              <span>❓ ${quiz.questionCount} questions</span> 
              <span>📅 ${date}</span>
            </p>
          </div>
          <div class="quiz-actions">
            <button class="btn-start" data-quiz-id="${
              quiz.id
            }">Start Quiz</button>
            <button class="btn-delete" data-quiz-id="${quiz.id}">Delete</button>
          </div>
        </div>
      `;
    });

    els.savedQuizzesList.innerHTML = html;

    // Add event listeners
    document.querySelectorAll(".btn-start").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const quizId = parseInt(e.target.dataset.quizId);
        await startSavedQuiz(quizId);
      });
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const quizId = parseInt(e.target.dataset.quizId);
        if (confirm("Are you sure you want to delete this quiz?")) {
          await deleteQuiz(quizId);
        }
      });
    });
  } catch (err) {
    console.error("Failed to load saved quizzes:", err);
    showError("Failed to load saved quizzes");
  }
}

// Start saved quiz
async function startSavedQuiz(quizId) {
  try {
    const quiz = await quizDB.getQuizById(quizId);

    // Store quiz data in sessionStorage to pass to quiz-trainer.html
    sessionStorage.setItem(
      "quizData",
      JSON.stringify({
        questions: quiz.questions,
        fileName: quiz.name,
        fromSaved: true,
      })
    );

    // Redirect to quiz trainer page
    window.location.href = "quiz-trainer.html";
  } catch (err) {
    console.error("Failed to load quiz:", err);
    showError("Failed to load quiz");
  }
}

// Delete quiz
async function deleteQuiz(quizId) {
  try {
    await quizDB.deleteQuiz(quizId);
    await loadSavedQuizzes();
  } catch (err) {
    console.error("Failed to delete quiz:", err);
    showError("Failed to delete quiz");
  }
}

// Load JSON file
els.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  els.errorMsg.classList.add("hidden");

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate schema
    if (!Array.isArray(data)) {
      throw new Error("JSON must be an array of questions");
    }

    if (data.length === 0) {
      throw new Error("JSON file is empty");
    }

    questions = [];

    for (let i = 0; i < data.length; i++) {
      const q = data[i];
      if (!q.text || !q.choices || !Array.isArray(q.choices)) {
        console.log(
          `Invalid question format at index ${i}: missing text or choices`
        );
        continue;
      }
      if (q.choices.length === 0) {
        console.log(`Question at index ${i} must have at least one choice`);
        continue;
      }

      questions.push(q);
    }

    fileName = file.name;

    // Show success message
    els.fileStatus.textContent = `✓ Loaded ${questions.length} questions from ${fileName}`;
    els.fileStatus.classList.remove("hidden");

    // Show save quiz modal
    els.saveQuizModal.classList.remove("hidden");
    els.quizName.value = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
  } catch (err) {
    showError(`Failed to load JSON: ${err.message}`);
    questions = null;
    fileName = "";
    els.fileStatus.classList.add("hidden");
  }
});

// Save quiz to database
els.saveQuizBtn.addEventListener("click", async () => {
  const quizName = els.quizName.value.trim();

  if (!quizName) {
    alert("Please enter a quiz name");
    return;
  }

  try {
    await quizDB.saveQuiz(quizName, questions, fileName);
    els.saveQuizModal.classList.add("hidden");

    // Store quiz data and redirect
    sessionStorage.setItem(
      "quizData",
      JSON.stringify({
        questions: questions,
        fileName: quizName,
        fromSaved: false,
      })
    );

    // Reload saved quizzes
    await loadSavedQuizzes();

    // Redirect to quiz trainer page
    window.location.href = "quiz-trainer.html";
  } catch (err) {
    console.error("Failed to save quiz:", err);
    showError("Failed to save quiz to database");
  }
});

// Skip saving and go directly to quiz
els.skipSaveBtn.addEventListener("click", () => {
  els.saveQuizModal.classList.add("hidden");

  // Store quiz data and redirect
  sessionStorage.setItem(
    "quizData",
    JSON.stringify({
      questions: questions,
      fileName: fileName,
      fromSaved: false,
    })
  );

  // Redirect to quiz trainer page
  window.location.href = "quiz-trainer.html";
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize app on load
initApp();
