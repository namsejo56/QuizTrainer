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
  testHistorySection: document.getElementById("testHistorySection"),
  testHistoryList: document.getElementById("testHistoryList"),
  filterQuiz: document.getElementById("filterQuiz"),
  filterStatus: document.getElementById("filterStatus"),
  toast: document.getElementById("toast"),
  downloadTemplateBtn: document.getElementById("downloadTemplateBtn"),
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
      await loadTestHistory();
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
            <button class="btn-start" data-quiz-id="${quiz.id
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

// Load test history
async function loadTestHistory() {
  try {
    const results = await quizDB.getAllResults();

    // Update quiz filter dropdown
    const quizNames = [...new Set(results.map((r) => r.quizName))];
    let filterOptions = '<option value="">All Quizzes</option>';
    quizNames.forEach((name) => {
      filterOptions += `<option value="${escapeHtml(name)}">${escapeHtml(
        name
      )}</option>`;
    });
    els.filterQuiz.innerHTML = filterOptions;

    // Render history
    renderTestHistory(results);
  } catch (err) {
    console.error("Failed to load test history:", err);
    els.testHistoryList.innerHTML =
      '<p class="empty-state">Failed to load test history</p>';
  }
}

// Render test history with current filters
function renderTestHistory(results = null) {
  // Apply filters if not provided
  if (!results) {
    applyHistoryFilters();
    return;
  }

  if (results.length === 0) {
    els.testHistoryList.innerHTML =
      '<p class="empty-state">No test results yet. Complete a quiz to see your history!</p>';
    return;
  }

  let html = "";
  results.forEach((result) => {
    const date = new Date(result.date);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    const passed = result.passed;
    const badgeClass = passed ? "passed" : "failed";
    const badgeText = passed ? "✓ Passed" : "✗ Failed";

    // Mode icon
    const modeIcons = {
      practice: "✏️",
      timed: "⏱️",
      flashcard: "🎴",
    };
    const modeIcon = modeIcons[result.mode] || "📝";

    // Duration
    const duration = formatDuration(result.durationSeconds);

    html += `
      <div class="history-card" data-result-id="${result.id}">
        <div class="history-card-header">
          <div class="history-quiz-name">${escapeHtml(result.quizName)}</div>
        </div>
        <div class="history-card-body">
          <div class="history-stats">
            <span class="score-badge ${badgeClass}">${badgeText}</span>
            <span class="history-stat">
              <span class="stat-icon">${modeIcon}</span>
              <span class="stat-text">${result.mode}</span>
            </span>
            <span class="history-stat">
              <span class="stat-icon">📊</span>
              <span class="stat-text">${result.score}/${result.total
      } (${result.percent.toFixed(1)}%)</span>
            </span>
            <span class="history-stat">
              <span class="stat-icon">⏱️</span>
              <span class="stat-text">${duration}</span>
            </span>
            <span class="history-stat">
              <span class="stat-icon">📅</span>
              <span class="stat-text">${dateStr} ${timeStr}</span>
            </span>            
          </div>
          <div class="history-card-actions">
              <button class="btn-view-detail" data-result-id="${result.id
      }">View Details</button>
              <button class="btn-delete-result" data-result-id="${result.id
      }">Delete</button>
            </div>
        </div>
      </div>
    `;
  });

  els.testHistoryList.innerHTML = html;

  // Add event listeners
  document.querySelectorAll(".btn-view-detail").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const resultId = parseInt(e.target.dataset.resultId);
      viewResultDetail(resultId);
    });
  });

  document.querySelectorAll(".btn-delete-result").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const resultId = parseInt(e.target.dataset.resultId);
      deleteResultWithUndo(resultId);
    });
  });
}

// Apply history filters
async function applyHistoryFilters() {
  try {
    const quizFilter = els.filterQuiz.value;
    const statusFilter = els.filterStatus.value;

    const filters = {};
    if (quizFilter) filters.quizName = quizFilter;
    if (statusFilter === "passed") filters.passed = true;
    if (statusFilter === "failed") filters.passed = false;

    const results = await quizDB.getAllResults(filters);
    renderTestHistory(results);
  } catch (err) {
    console.error("Failed to apply filters:", err);
    showToast("Failed to load results", "error");
  }
}

// View result detail
async function viewResultDetail(resultId) {
  try {
    const result = await quizDB.getResultById(resultId);

    // Store in sessionStorage and navigate to quiz-trainer page to show result
    sessionStorage.setItem("viewResult", JSON.stringify(result));
    window.location.href = "quiz-trainer.html";
  } catch (err) {
    console.error("Failed to load result:", err);
    showToast("Failed to load result details", "error");
  }
}

// Delete result with undo toast
let lastDeletedResult = null;
let deleteTimeout = null;

async function deleteResultWithUndo(resultId) {
  try {
    // Get result before deleting (for undo)
    lastDeletedResult = await quizDB.getResultById(resultId);

    // Delete from database
    await quizDB.deleteResult(resultId);

    // Reload history
    await loadTestHistory();

    // Show undo toast
    showToastWithUndo("Result deleted", async () => {
      // Undo: restore result
      if (lastDeletedResult) {
        await quizDB.saveResult(lastDeletedResult);
        await loadTestHistory();
        showToast("Result restored", "success");
        lastDeletedResult = null;
      }
    });
  } catch (err) {
    console.error("Failed to delete result:", err);
    showToast("Failed to delete result", "error");
  }
}

// Format duration from seconds
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}

// Show toast notification
function showToast(message, type = "info") {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.className = `toast toast-${type}`;
  els.toast.classList.remove("hidden");

  setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3000);
}

// Show toast with undo button
function showToastWithUndo(message, undoCallback) {
  if (!els.toast) return;

  clearTimeout(deleteTimeout);

  els.toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-undo-btn" id="undoBtn">Undo</button>
  `;
  els.toast.className = "toast toast-undo";
  els.toast.classList.remove("hidden");

  const undoBtn = document.getElementById("undoBtn");
  undoBtn.addEventListener("click", () => {
    clearTimeout(deleteTimeout);
    els.toast.classList.add("hidden");
    undoCallback();
  });

  deleteTimeout = setTimeout(() => {
    els.toast.classList.add("hidden");
    lastDeletedResult = null;
  }, 5000);
}

// Add filter event listeners
els.filterQuiz.addEventListener("change", applyHistoryFilters);
els.filterStatus.addEventListener("change", applyHistoryFilters);

// Download template JSON
els.downloadTemplateBtn.addEventListener("click", () => {
  const template = [
    {
      "url": "https://www.example.com/question-1",
      "text": "Sample question text here. What is the correct answer?",
      "choices": [
        {
          "letter": "A.",
          "content": "First answer option",
          "is_correct": true,
          "has_images": false,
          "images": []
        },
        {
          "letter": "B.",
          "content": "Second answer option",
          "is_correct": false,
          "has_images": false,
          "images": []
        },
        {
          "letter": "C.",
          "content": "Third answer option",
          "is_correct": false,
          "has_images": false,
          "images": []
        },
        {
          "letter": "D.",
          "content": "Fourth answer option",
          "is_correct": false,
          "has_images": false,
          "images": []
        }
      ],
      "correct_answer": "[{\"voted_answers\": \"A\", \"vote_count\": 10, \"is_most_voted\": true}]",
      "correct_content": "Detailed content explanation: This field can contain comprehensive information about the correct answer, including references, documentation links, or additional learning materials.",
      "question_images": [],
      "meta": {
        "explain": "This is an optional explanation for the correct answer. You can provide additional context, reasoning, or details to help learners understand why this is the correct choice."
      },
      "exam_code": "SAMPLE-001"
    },
    {
      "url": "https://www.example.com/question-2",
      "text": "Another sample question with multiple correct answers. Which options are correct? (Choose two.)",
      "choices": [
        {
          "letter": "A.",
          "content": "First correct option",
          "is_correct": true,
          "has_images": false,
          "images": []
        },
        {
          "letter": "B.",
          "content": "Incorrect option",
          "is_correct": false,
          "has_images": false,
          "images": []
        },
        {
          "letter": "C.",
          "content": "Second correct option",
          "is_correct": true,
          "has_images": false,
          "images": []
        },
        {
          "letter": "D.",
          "content": "Another incorrect option",
          "is_correct": false,
          "has_images": false,
          "images": []
        }
      ],
      "correct_answer": "[{\"voted_answers\": \"AC\", \"vote_count\": 15, \"is_most_voted\": true}, {\"voted_answers\": \"AB\", \"vote_count\": 3, \"is_most_voted\": false}]",
      "correct_content": "Both options A and C are correct because they complement each other in solving this problem. Option A provides the foundational approach while option C adds the necessary configuration.",
      "question_images": [],
      "meta": {
        "explain": "For multiple-answer questions, the explanation can describe why each correct option is valid and why the others are not."
      },
      "exam_code": "SAMPLE-001"
    }
  ];

  // Create blob and download
  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quiz_template.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show toast notification
  showToastNotification("✅ Template downloaded successfully!");
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize app on load
initApp();
