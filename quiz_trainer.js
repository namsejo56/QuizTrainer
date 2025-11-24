// Global state
let questions = null;
let fileName = "";
let testSession = null;
let userAnswers = {};
let questionResults = {}; // Store if each question was answered correctly
let currentQuestion = 0;
let testStartTime = null;
let timerInterval = null;

// DOM elements
const els = {
  errorMsg: document.getElementById("errorMsg"),
  configModal: document.getElementById("configModal"),
  numQuestions: document.getElementById("numQuestions"),
  maxQuestions: document.getElementById("maxQuestions"),
  timeGroup: document.getElementById("timeGroup"),
  timeMinutes: document.getElementById("timeMinutes"),
  shuffleChoices: document.getElementById("shuffleChoices"),
  startBtn: document.getElementById("startBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  testSection: document.getElementById("testSection"),
  questionProgress: document.getElementById("questionProgress"),
  timer: document.getElementById("timer"),
  progressFill: document.getElementById("progressFill"),
  questionContainer: document.getElementById("questionContainer"),
  questionGrid: document.getElementById("questionGrid"),
  answeredCount: document.getElementById("answeredCount"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  submitBtn: document.getElementById("submitBtn"),
  submitAnswerBtn: document.getElementById("submitAnswerBtn"),
  exitBtn: document.getElementById("exitBtn"),
  resultModal: document.getElementById("resultModal"),
  resultIcon: document.getElementById("resultIcon"),
  resultTitle: document.getElementById("resultTitle"),
  resultSubtitle: document.getElementById("resultSubtitle"),
  scoreValue: document.getElementById("scoreValue"),
  percentValue: document.getElementById("percentValue"),
  durationValue: document.getElementById("durationValue"),
  detailsList: document.getElementById("detailsList"),
  saveBtn: document.getElementById("saveBtn"),
  newTestBtn: document.getElementById("newTestBtn"),
};

// Utility: Sanitize HTML to prevent XSS
function sanitizeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Utility: Shuffle array with seed
function shuffleArray(array, seed = Date.now()) {
  const arr = [...array];
  let currentSeed = seed;

  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Utility: Format time
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Show error
function showError(message) {
  els.errorMsg.textContent = message;
  els.errorMsg.classList.remove("hidden");
  setTimeout(() => {
    els.errorMsg.classList.add("hidden");
  }, 5000);
}

// Initialize app - load quiz data from sessionStorage
function initApp() {
  try {
    const quizData = sessionStorage.getItem("quizData");

    if (!quizData) {
      // No quiz data, redirect to home
      window.location.href = "index.html";
      return;
    }

    const data = JSON.parse(quizData);
    questions = data.questions;
    fileName = data.fileName;

    // Clear session storage
    sessionStorage.removeItem("quizData");

    // Open config modal
    openConfigModal();
  } catch (err) {
    console.error("Failed to load quiz data:", err);
    showError("Failed to load quiz data");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  }
}

// Open config modal
function openConfigModal() {
  els.numQuestions.value = Math.min(65, questions.length);
  els.numQuestions.max = questions.length;
  els.maxQuestions.textContent = `(max: ${questions.length})`;

  // Set range defaults
  const rangeFrom = document.getElementById("rangeFrom");
  const rangeTo = document.getElementById("rangeTo");
  rangeFrom.max = questions.length;
  rangeTo.max = questions.length;
  rangeFrom.value = 1;
  rangeTo.value = Math.min(65, questions.length);

  els.configModal.classList.remove("hidden");
}

// Handle mode change
document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "timed") {
      els.timeGroup.style.display = "block";
    } else {
      els.timeGroup.style.display = "none";
    }
  });
});

// Handle question selection change
document
  .querySelectorAll('input[name="questionSelection"]')
  .forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const rangeGroup = document.getElementById("rangeGroup");
      const numQuestionsInput = document.getElementById("numQuestions");
      if (e.target.value === "range") {
        rangeGroup.style.display = "block";
        numQuestionsInput.disabled = true;
      } else {
        rangeGroup.style.display = "none";
        numQuestionsInput.disabled = false;
      }
    });
  });

// Cancel config
els.cancelBtn.addEventListener("click", () => {
  testSession = null;
  userAnswers = {};
  questionResults = {};
  currentQuestion = 0;
  testStartTime = null;
  clearInterval(timerInterval);

  // Redirect to home page
  window.location.href = "index.html";
});

// Start test
els.startBtn.addEventListener("click", () => {
  const numQuestions = parseInt(els.numQuestions.value);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const timeMinutes = parseInt(els.timeMinutes.value);
  const shuffle = els.shuffleChoices.checked;
  const questionSelection = document.querySelector(
    'input[name="questionSelection"]:checked'
  ).value;
  const sortOrder = document.getElementById("sortOrder").value;

  let rangeFrom = 1;
  let rangeTo = questions.length;

  if (questionSelection === "range") {
    rangeFrom = parseInt(document.getElementById("rangeFrom").value);
    rangeTo = parseInt(document.getElementById("rangeTo").value);

    if (rangeFrom < 1 || rangeFrom > questions.length) {
      alert(`"From" must be between 1 and ${questions.length}`);
      return;
    }
    if (rangeTo < 1 || rangeTo > questions.length) {
      alert(`"To" must be between 1 and ${questions.length}`);
      return;
    }
    if (rangeFrom > rangeTo) {
      alert('"From" must be less than or equal to "To"');
      return;
    }
  } else {
    if (numQuestions < 1 || numQuestions > questions.length) {
      alert(`Number of questions must be between 1 and ${questions.length}`);
      return;
    }
  }

  if (mode === "timed" && timeMinutes < 1) {
    alert("Time limit must be at least 1 minute");
    return;
  }

  generateTest({
    numQuestions,
    mode,
    timeMinutes,
    shuffle,
    questionSelection,
    rangeFrom,
    rangeTo,
    sortOrder,
  });
});

// Generate test
function generateTest(config) {
  const seed = Date.now();

  // Sort questions if needed
  let sortedQuestions = [...questions];
  if (config.sortOrder === "newest") {
    sortedQuestions = sortedQuestions.reverse();
  } else if (config.sortOrder === "oldest") {
    // Keep original order (already in sortedQuestions)
  }
  // If "original", no change needed

  // Select questions
  let selectedQuestions;
  if (config.questionSelection === "range") {
    // Select by range (convert from 1-based to 0-based index)
    const startIdx = config.rangeFrom - 1;
    const endIdx = config.rangeTo;
    selectedQuestions = sortedQuestions.slice(startIdx, endIdx);
  } else {
    // Random selection
    selectedQuestions = [...sortedQuestions];
    if (selectedQuestions.length > config.numQuestions) {
      selectedQuestions = shuffleArray(selectedQuestions, seed).slice(
        0,
        config.numQuestions
      );
    }
  }

  // Shuffle choices if enabled
  if (config.shuffle) {
    selectedQuestions = selectedQuestions.map((q) => ({
      ...q,
      choices: shuffleArray(q.choices, seed + q.url.length),
    }));
  }

  testSession = {
    questions: selectedQuestions,
    config: { ...config, seed },
    startTime: new Date().toISOString(),
    fileName: fileName,
  };

  userAnswers = {};
  questionResults = {};
  currentQuestion = 0;
  testStartTime = Date.now();

  // Hide config modal
  els.configModal.classList.add("hidden");

  // Show test section
  els.testSection.classList.remove("hidden");

  // Start timer if timed mode
  if (config.mode === "timed" && config.timeMinutes > 0) {
    startTimer(config.timeMinutes * 60);
  } else {
    els.timer.classList.add("hidden");
  }

  // Show question grid for both practice and timed mode
  els.questionGrid.classList.remove("hidden");
  renderQuestionGrid();

  renderQuestion();
}

// Start timer
function startTimer(seconds) {
  let timeLeft = seconds;
  els.timer.classList.remove("hidden");
  els.timer.textContent = formatTime(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    els.timer.textContent = formatTime(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitTest();
    }
  }, 1000);
}

// Render question grid (for both practice and timed mode)
function renderQuestionGrid() {
  if (!testSession) return;

  const totalQuestions = testSession.questions.length;
  const isPracticeMode = testSession.config.mode === "practice";

  let html = '<div class="question-grid-title">Questions</div>';
  html += '<div class="question-grid-items">';

  for (let i = 0; i < totalQuestions; i++) {
    let statusClass = "unanswered";

    if (isPracticeMode) {
      // Practice mode: show correct (green), incorrect (red), unanswered (gray)
      if (questionResults[i] === true) {
        statusClass = "correct";
      } else if (questionResults[i] === false) {
        statusClass = "incorrect";
      }
    } else {
      // Timed mode: show answered (green), unanswered (gray)
      if (userAnswers.hasOwnProperty(i)) {
        statusClass = "answered";
      }
    }

    const isActive = i === currentQuestion ? "active" : "";
    html += `<div class="question-grid-item ${statusClass} ${isActive}" data-question="${i}">${
      i + 1
    }</div>`;
  }

  html += "</div>";
  els.questionGrid.innerHTML = html;

  // Add click listeners
  document.querySelectorAll(".question-grid-item").forEach((item) => {
    item.addEventListener("click", () => {
      const questionIndex = parseInt(item.dataset.question);
      currentQuestion = questionIndex;
      renderQuestion();
      renderQuestionGrid();
    });
  });
}

// Render question
function renderQuestion() {
  const q = testSession.questions[currentQuestion];
  const totalQuestions = testSession.questions.length;

  // Update progress
  els.questionProgress.textContent = `Question ${
    currentQuestion + 1
  } of ${totalQuestions}`;
  els.progressFill.style.width = `${
    ((currentQuestion + 1) / totalQuestions) * 100
  }%`;

  // Update answered count
  const answeredCount = Object.keys(userAnswers).length;
  els.answeredCount.textContent = `Answered: ${answeredCount} / ${totalQuestions}`;

  // Build question HTML
  let html = `<div class="question-text">${sanitizeHTML(q.text)}</div>`;

  // Add question images
  if (q.question_images && q.question_images.length > 0) {
    html += '<div class="question-images">';
    q.question_images.forEach((img) => {
      html += `<img src="${sanitizeHTML(img)}" alt="Question image">`;
    });
    html += "</div>";
  }

  // Add choices
  const isPracticeMode = testSession.config.mode === "practice";
  const isAnswered = questionResults.hasOwnProperty(currentQuestion);
  const correctChoice = q.choices.find((c) => c.is_correct);
  const correctAnswer = correctChoice ? correctChoice.letter : null;

  html += '<div class="choices">';
  q.choices.forEach((choice) => {
    const isSelected = userAnswers[currentQuestion] === choice.letter;
    const isCorrect = choice.letter === correctAnswer;

    let choiceClass = "";
    if (isPracticeMode && isAnswered) {
      if (isSelected && isCorrect) {
        choiceClass = "choice-correct";
      } else if (isSelected && !isCorrect) {
        choiceClass = "choice-incorrect";
      } else if (isCorrect) {
        choiceClass = "choice-correct-answer";
      }
    } else if (isSelected) {
      choiceClass = "selected";
    }

    const disabled = isPracticeMode && isAnswered ? "disabled" : "";

    html += `
      <div class="choice ${choiceClass}" data-letter="${choice.letter}" ${
      disabled ? 'style="pointer-events: none;"' : ""
    }>
        <input type="radio" name="current-question" value="${choice.letter}" ${
      isSelected ? "checked" : ""
    } ${disabled}>
        <span class="choice-letter">${sanitizeHTML(choice.letter)}</span>
        <span class="choice-content">${sanitizeHTML(choice.content)}</span>
    `;

    if (choice.has_images && choice.images && choice.images.length > 0) {
      html += '<div class="choice-images">';
      choice.images.forEach((img) => {
        html += `<img src="${sanitizeHTML(img)}" alt="Choice ${
          choice.letter
        }">`;
      });
      html += "</div>";
    }

    html += "</div>";
  });
  html += "</div>";

  // Add feedback message in practice mode
  if (isPracticeMode && isAnswered) {
    const wasCorrect = questionResults[currentQuestion];
    const feedbackClass = wasCorrect
      ? "feedback-correct"
      : "feedback-incorrect";
    const feedbackIcon = wasCorrect ? "✓" : "✗";
    const feedbackText = wasCorrect
      ? "Correct!"
      : `Incorrect. The correct answer is ${correctAnswer}.`;
    html += `<div class="answer-feedback ${feedbackClass}">${feedbackIcon} ${feedbackText}</div>`;
  }

  els.questionContainer.innerHTML = html;

  // Add click listeners to choices (only if not already answered in practice mode)
  const isPractice = testSession.config.mode === "practice";
  const alreadyAnswered = questionResults.hasOwnProperty(currentQuestion);

  if (!isPractice || !alreadyAnswered) {
    document.querySelectorAll(".choice").forEach((choiceEl) => {
      choiceEl.addEventListener("click", () => {
        const letter = choiceEl.dataset.letter;
        selectAnswer(letter);
      });
    });
  }

  // Update navigation buttons
  els.prevBtn.disabled = currentQuestion === 0;

  // Show/hide submit answer button in practice mode
  const hasSelectedAnswer = userAnswers.hasOwnProperty(currentQuestion);

  if (isPractice) {
    els.submitAnswerBtn.classList.remove("hidden");
    // Enable/disable based on whether answer is selected and not yet submitted
    els.submitAnswerBtn.disabled = !hasSelectedAnswer || alreadyAnswered;
  } else {
    els.submitAnswerBtn.classList.add("hidden");
  }

  if (currentQuestion === totalQuestions - 1) {
    els.nextBtn.classList.add("hidden");
    els.submitBtn.classList.remove("hidden");
  } else {
    els.nextBtn.classList.remove("hidden");
    els.submitBtn.classList.add("hidden");
  }
}

// Select answer
function selectAnswer(letter) {
  const isPracticeMode = testSession.config.mode === "practice";

  // In practice mode, don't allow changing answer if already submitted
  if (isPracticeMode && questionResults.hasOwnProperty(currentQuestion)) {
    return;
  }

  // Save the selected answer
  userAnswers[currentQuestion] = letter;

  // In timed mode, update grid immediately
  if (!isPracticeMode) {
    renderQuestionGrid();
  }

  renderQuestion();
}

// Submit current answer (for practice mode)
function submitCurrentAnswer() {
  const isPracticeMode = testSession.config.mode === "practice";

  if (!isPracticeMode) return;
  if (!userAnswers[currentQuestion]) return;
  if (questionResults.hasOwnProperty(currentQuestion)) return;

  // Check if answer is correct
  const q = testSession.questions[currentQuestion];
  const correctChoice = q.choices.find((c) => c.is_correct);
  const correctAnswer = correctChoice ? correctChoice.letter : null;
  questionResults[currentQuestion] =
    userAnswers[currentQuestion] === correctAnswer;

  // Update question grid and re-render
  renderQuestionGrid();
  renderQuestion();
}

// Submit answer button (for practice mode)
els.submitAnswerBtn.addEventListener("click", () => {
  submitCurrentAnswer();
});

// Navigation
els.prevBtn.addEventListener("click", () => {
  // Auto-submit current answer before moving if in practice mode and answer is selected
  const isPracticeMode = testSession.config.mode === "practice";
  if (
    isPracticeMode &&
    userAnswers[currentQuestion] &&
    !questionResults.hasOwnProperty(currentQuestion)
  ) {
    submitCurrentAnswer();
  }

  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
});

els.nextBtn.addEventListener("click", () => {
  // Auto-submit current answer before moving if in practice mode and answer is selected
  const isPracticeMode = testSession.config.mode === "practice";
  if (
    isPracticeMode &&
    userAnswers[currentQuestion] &&
    !questionResults.hasOwnProperty(currentQuestion)
  ) {
    submitCurrentAnswer();
  }

  if (currentQuestion < testSession.questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  }
});

els.submitBtn.addEventListener("click", () => {
  submitTest();
});

els.exitBtn.addEventListener("click", () => {
  const answeredCount = Object.keys(userAnswers).length;
  const totalQuestions = testSession.questions.length;
  const unanswered = totalQuestions - answeredCount;

  let message = "Are you sure you want to submit the test?";
  if (unanswered > 0) {
    message += `\n\nYou have ${unanswered} unanswered question${
      unanswered > 1 ? "s" : ""
    }. They will be marked as incorrect.`;
  }

  if (confirm(message)) {
    submitTest();
  }
});

// Submit test
function submitTest() {
  clearInterval(timerInterval);

  const endTime = Date.now();
  const duration = Math.floor((endTime - testStartTime) / 1000);

  let correct = 0;
  const details = testSession.questions.map((q, idx) => {
    const userAnswer = userAnswers[idx] || "Not answered";
    const correctChoice = q.choices.find((c) => c.is_correct);
    const correctAnswer = correctChoice ? correctChoice.letter : "Unknown";
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) correct++;

    return {
      questionIndex: idx,
      questionText: q.text,
      userAnswer,
      correctAnswer,
      isCorrect,
    };
  });

  const result = {
    score: correct,
    total: testSession.questions.length,
    percent: ((correct / testSession.questions.length) * 100).toFixed(1),
    duration: formatTime(duration),
    durationSeconds: duration,
    details,
    date: new Date().toISOString(),
  };

  showResult(result);
}

// Show result
function showResult(result) {
  const passed = parseFloat(result.percent) >= 70;

  els.resultIcon.textContent = passed ? "✅" : "❌";
  els.resultTitle.textContent = passed
    ? "Congratulations!"
    : "Keep Practicing!";
  els.resultSubtitle.textContent = "You've completed the test";

  els.scoreValue.textContent = `${result.score}/${result.total}`;
  els.percentValue.textContent = `${result.percent}%`;
  els.durationValue.textContent = result.duration;

  // Build details list
  let detailsHTML = "";
  result.details.forEach((detail, idx) => {
    const className = detail.isCorrect ? "correct" : "incorrect";
    const status = detail.isCorrect
      ? "✓ Correct"
      : `✗ Wrong (Selected: ${detail.userAnswer} Correct: ${detail.correctAnswer})`;
    detailsHTML += `
      <div class="detail-item ${className}">
        <strong>Q${idx + 1}:</strong> ${status}
      </div>
    `;
  });
  els.detailsList.innerHTML = detailsHTML;

  // Hide test section and show result modal
  els.testSection.classList.add("hidden");
  els.resultModal.classList.remove("hidden");

  // Store result for saving
  window.currentResult = result;
}

// Save markdown
els.saveBtn.addEventListener("click", () => {
  const result = window.currentResult;
  if (!result) return;

  let md = `# Quiz Result\n`;
  md += `- quizTitle: ${testSession.fileName}\n`;
  md += `- date: ${result.date}\n`;
  md += `- mode: ${testSession.config.mode}\n`;
  md += `- duration: ${result.duration}\n`;
  md += `- questionsCount: ${result.total}\n`;
  md += `- score: ${result.score}/${result.total}\n`;
  md += `- percent: ${result.percent}%\n\n`;

  md += `## Answers\n`;
  result.details.forEach((d, idx) => {
    const status = d.isCorrect ? "✅" : "❌";
    const correctInfo = d.isCorrect ? "" : ` (correct: "${d.correctAnswer}")`;
    md += `${idx + 1}. Question ${idx + 1} — selected: "${d.userAnswer}" — ${
      d.isCorrect ? "correct" : "incorrect"
    } ${status}${correctInfo}\n`;
  });

  md += `\n## Raw\n`;
  md += `- JSON source file: ${testSession.fileName}\n`;
  md += `- config: ${JSON.stringify(testSession.config)}\n\n`;
  md += `---\n`;

  // Download
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .split(".")[0]
    .replace("T", "-");
  a.download = `quiz-result-${dateStr}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Back to home
els.newTestBtn.addEventListener("click", () => {
  testSession = null;
  userAnswers = {};
  questionResults = {};
  currentQuestion = 0;
  testStartTime = null;
  clearInterval(timerInterval);

  // Redirect to home page
  window.location.href = "index.html";
});

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
