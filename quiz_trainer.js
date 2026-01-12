// Global state
let questions = null;
let fileName = "";
let testSession = null;
let userAnswers = {};
let questionResults = {}; // Store if each question was answered correctly
let currentQuestion = 0;
let testStartTime = null;
let timerInterval = null;
let isFlipped = false; // For flashcard mode
let currentFilter = "all"; // Filter state: 'all', 'correct', 'incorrect'
let allResultDetails = []; // Store all result details for filtering

// DOM elements
const els = {
  errorMsg: document.getElementById("errorMsg"),
  configModal: document.getElementById("configModal"),
  numQuestions: document.getElementById("numQuestions"),
  maxQuestions: document.getElementById("maxQuestions"),
  timeGroup: document.getElementById("timeGroup"),
  timeMinutes: document.getElementById("timeMinutes"),
  shuffleChoices: document.getElementById("shuffleChoices"),
  showOnlyCorrect: document.getElementById("showOnlyCorrect"),
  startBtn: document.getElementById("startBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  testSection: document.getElementById("testSection"),
  questionProgress: document.getElementById("questionProgress"),
  timer: document.getElementById("timer"),
  progressFill: document.getElementById("progressFill"),
  questionContainer: document.getElementById("questionContainer"),
  questionGrid: document.getElementById("questionGrid"),
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
  filterAll: document.getElementById("filterAll"),
  filterCorrect: document.getElementById("filterCorrect"),
  filterIncorrect: document.getElementById("filterIncorrect"),
  countAll: document.getElementById("countAll"),
  countCorrect: document.getElementById("countCorrect"),
  countIncorrect: document.getElementById("countIncorrect"),
  questionDetailModal: document.getElementById("questionDetailModal"),
  questionDetailContainer: document.getElementById("questionDetailContainer"),
  closeQuestionDetail: document.getElementById("closeQuestionDetail"),
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

// Utility: Parse voting information from correct_answer field
function parseVotingInfo(correctAnswerStr) {
  try {
    if (!correctAnswerStr) return null;
    const parsed = JSON.parse(correctAnswerStr);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

// Utility: Get correct answer(s) from question
function getCorrectAnswers(question) {
  // Get correct answers from is_correct flag in choices
  const correctChoices = question.choices.filter(c => c.is_correct);
  return correctChoices.map(c => c.letter);
}

// Utility: Check if question has multiple correct answers
function hasMultipleCorrectAnswers(question) {
  const correctAnswers = getCorrectAnswers(question);
  return correctAnswers.length > 1;
}

// Show error
function showError(message) {
  els.errorMsg.textContent = message;
  els.errorMsg.classList.remove("hidden");
  setTimeout(() => {
    els.errorMsg.classList.add("hidden");
  }, 5000);
}

// Initialize app - load quiz data from sessionStorage or view result
function initApp() {
  try {
    // Check if viewing a saved result
    const viewResult = sessionStorage.getItem("viewResult");
    if (viewResult) {
      const result = JSON.parse(viewResult);
      sessionStorage.removeItem("viewResult");
      showSavedResult(result);
      return;
    }

    // Otherwise, load quiz data for taking a test
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
  els.maxQuestions.textContent = `(maximum: ${questions.length} questions)`;

  // Set range defaults
  const rangeFrom = document.getElementById("rangeFrom");
  const rangeTo = document.getElementById("rangeTo");
  rangeFrom.max = questions.length;
  rangeTo.max = questions.length;
  rangeFrom.value = 1;
  rangeTo.value = Math.min(65, questions.length);

  // Show range by default, hide random
  document.getElementById("rangeGroup").style.display = "flex";
  document.getElementById("randomGroup").style.display = "none";

  els.configModal.classList.remove("hidden");
} // Handle mode change
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
      const randomGroup = document.getElementById("randomGroup");
      if (e.target.value === "range") {
        rangeGroup.style.display = "flex";
        randomGroup.style.display = "none";
      } else {
        rangeGroup.style.display = "none";
        randomGroup.style.display = "block";
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

  // Hide question grid and remove sidebar class
  els.questionGrid.classList.add("hidden");
  document.querySelector(".container").classList.remove("has-sidebar");

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

  // Show test section and question grid
  els.testSection.classList.remove("hidden");
  els.questionGrid.classList.remove("hidden");
  document.querySelector(".container").classList.add("has-sidebar");

  // Update exit button text based on mode
  if (config.mode === "flashcard") {
    els.exitBtn.textContent = "Exit";
  } else {
    els.exitBtn.textContent = "Submit Test";
  }

  // Start timer if timed mode
  if (config.mode === "timed" && config.timeMinutes > 0) {
    startTimer(config.timeMinutes * 60);
  } else {
    els.timer.classList.add("hidden");
  }

  // Render question grid
  renderQuestionGrid();

  if (config.mode === "flashcard") {
    renderFlashcard();
  } else {
    renderQuestion();
  }
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
    html += `<div class="question-grid-item ${statusClass} ${isActive}" data-question="${i}">${i + 1
      }</div>`;
  }

  html += "</div>";
  els.questionGrid.innerHTML = html;

  // Add click listeners
  document.querySelectorAll(".question-grid-item").forEach((item) => {
    item.addEventListener("click", () => {
      const questionIndex = parseInt(item.dataset.question);
      currentQuestion = questionIndex;
      isFlipped = false;
      if (testSession.config.mode === "flashcard") {
        renderFlashcard();
      } else {
        renderQuestion();
      }
      renderQuestionGrid();
    });
  });
}

// Render flashcard
function renderFlashcard() {
  const q = testSession.questions[currentQuestion];
  const totalQuestions = testSession.questions.length;

  // Update progress
  els.questionProgress.textContent = `Card ${currentQuestion + 1
    } of ${totalQuestions}`;
  els.progressFill.style.width = `${((currentQuestion + 1) / totalQuestions) * 100
    }%`;

  // Hide submit answer button and answered count in flashcard mode
  els.submitAnswerBtn.classList.add("hidden");

  // Show flashcard toggle
  const flashcardToggle = document.getElementById("flashcardToggle");
  flashcardToggle.classList.remove("hidden");

  // Build flashcard HTML
  const correctAnswers = getCorrectAnswers(q);
  const votingInfo = parseVotingInfo(q.correct_answer);

  let html = '<div class="flashcard-container">';
  html += `<div class="flashcard ${isFlipped ? "flipped" : ""
    }" onclick="toggleFlashcard()">`;

  // Front of card (Question)
  html += '<div class="flashcard-face flashcard-front">';
  html += '<div class="flashcard-label">Question</div>';
  html += `<div class="flashcard-content">${sanitizeHTML(q.text)}</div>`;

  if (q.question_images && q.question_images.length > 0) {
    html += '<div class="flashcard-images">';
    q.question_images.forEach((img) => {
      html += `<img src="${sanitizeHTML(img)}" alt="Question image">`;
    });
    html += "</div>";
  }

  html += '<div class="flashcard-hint">Click to reveal answer</div>';
  html += "</div>";

  // Back of card (Answer)
  html += '<div class="flashcard-face flashcard-back">';
  html += '<div class="flashcard-label">Answer</div>';
  html += '<div class="flashcard-answer-content">';

  const showOnlyCorrectCheckbox = document.getElementById("showOnlyCorrect");
  const showOnlyCorrect = showOnlyCorrectCheckbox
    ? showOnlyCorrectCheckbox.checked
    : true;
  if (showOnlyCorrect) {
    // Show only correct answer(s)
    html += '<div class="flashcard-answer-single">';
    correctAnswers.forEach((letter, index) => {
      const correctChoice = q.choices.find(c => c.letter === letter);
      if (correctChoice) {
        if (index > 0) html += '<br><br>';
        html += `<strong>${sanitizeHTML(letter)}.</strong> ${sanitizeHTML(
          correctChoice.content
        )} ✓`;
      }
    });
    html += "</div>";
  } else {
    // Show all choices
    html += '<div class="flashcard-answer-list">';
    q.choices.forEach((choice) => {
      const isCorrect = correctAnswers.includes(choice.letter);
      const itemClass = isCorrect
        ? "flashcard-answer-item correct-answer"
        : "flashcard-answer-item";
      html += `<div class="${itemClass}">`;
      html += `<strong>${sanitizeHTML(choice.letter)}.</strong> ${sanitizeHTML(
        choice.content
      )}`;
      if (isCorrect) {
        html += " ✓";
      }
      html += "</div>";
    });
    html += "</div>";
  }

  // Show voting information if available
  if (votingInfo && votingInfo.length > 0) {
    html += '<div class="voting-info">';
    html += '<strong>Community Votes:</strong><br>';
    votingInfo.forEach((vote, idx) => {
      const badge = vote.is_most_voted ? '🏆' : '';
      html += `${badge} ${vote.voted_answers}: ${vote.vote_count} vote${vote.vote_count > 1 ? 's' : ''}`;
      if (idx < votingInfo.length - 1) html += '<br>';
    });
    html += "</div>";
  }

  html += "</div>";
  html += '<div class="flashcard-hint">Click to see question</div>';
  html += "</div>";

  html += "</div></div>";

  // Add keyboard shortcuts info
  html += '<div class="keyboard-shortcuts">';
  html += "<strong>Keyboard shortcuts:</strong> ";
  html += "← → to navigate | ↑ ↓ to flip card";
  html += "</div>";

  els.questionContainer.innerHTML = html;

  // Update navigation buttons
  els.prevBtn.disabled = currentQuestion === 0;

  if (currentQuestion === totalQuestions - 1) {
    els.nextBtn.classList.add("hidden");
    els.submitBtn.classList.remove("hidden");
  } else {
    els.nextBtn.classList.remove("hidden");
    els.submitBtn.classList.add("hidden");
  }

  // Add listener for toggle change to re-render
  const toggleCheckbox = document.getElementById("showOnlyCorrect");
  if (toggleCheckbox) {
    toggleCheckbox.removeEventListener("change", renderFlashcard);
    toggleCheckbox.addEventListener("change", renderFlashcard);
  }
}

// Toggle flashcard flip
function toggleFlashcard() {
  isFlipped = !isFlipped;
  const flashcard = document.querySelector(".flashcard");
  if (flashcard) {
    if (isFlipped) {
      flashcard.classList.add("flipped");
    } else {
      flashcard.classList.remove("flipped");
    }
  }
}

// Render question
function renderQuestion() {
  const q = testSession.questions[currentQuestion];
  const totalQuestions = testSession.questions.length;

  // Reset flip state when changing questions in flashcard mode
  if (testSession.config.mode === "flashcard") {
    isFlipped = false;
    renderFlashcard();
    return;
  }

  // Update progress
  els.questionProgress.textContent = `Question ${currentQuestion + 1
    } of ${totalQuestions}`;
  els.progressFill.style.width = `${((currentQuestion + 1) / totalQuestions) * 100
    }%`;

  // Hide flashcard toggle in regular mode
  const flashcardToggle = document.getElementById("flashcardToggle");
  if (flashcardToggle) {
    flashcardToggle.classList.add("hidden");
  }

  // Build question HTML
  const isMultipleAnswer = hasMultipleCorrectAnswers(q);
  const inputType = isMultipleAnswer ? "checkbox" : "radio";

  let html = `<div class="question-text">${sanitizeHTML(q.text)}</div>`;

  // Add hint for multiple answer questions
  if (isMultipleAnswer) {
    html += '<div class="multiple-answer-hint">⚠️ This question has multiple correct answers. Select all that apply.</div>';
  }

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
  const correctAnswers = getCorrectAnswers(q);
  const votingInfo = parseVotingInfo(q.correct_answer);

  html += '<div class="choices">';
  q.choices.forEach((choice) => {
    const userAnswer = userAnswers[currentQuestion];
    // Handle both single answer (string) and multiple answers (array)
    const isSelected = isMultipleAnswer
      ? (Array.isArray(userAnswer) && userAnswer.includes(choice.letter))
      : (userAnswer === choice.letter);
    const isCorrect = correctAnswers.includes(choice.letter);

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
    const inputName = isMultipleAnswer ? `current-question-${currentQuestion}` : "current-question";

    html += `
      <div class="choice ${choiceClass}" data-letter="${choice.letter}" ${disabled ? 'style="pointer-events: none;"' : ""
      }>
        <input type="${inputType}" name="${inputName}" value="${choice.letter}" ${isSelected ? "checked" : ""
      } ${disabled}>
        <span class="choice-letter">${sanitizeHTML(choice.letter)}</span>
        <span class="choice-content">${sanitizeHTML(choice.content)}</span>
    `;

    if (choice.has_images && choice.images && choice.images.length > 0) {
      html += '<div class="choice-images">';
      choice.images.forEach((img) => {
        html += `<img src="${sanitizeHTML(img)}" alt="Choice ${choice.letter
          }">`;
      });
      html += "</div>";
    }

    html += "</div>";
  });
  html += "</div>";

  // Show additional information in practice mode after answering
  if (isPracticeMode && isAnswered) {
    // Show voting information if available
    if (votingInfo && votingInfo.length > 0) {
      html += '<div class="voting-info-practice">';
      html += '<strong>📊 Community Votes:</strong><br>';
      votingInfo.forEach((vote, idx) => {
        const badge = vote.is_most_voted ? ' 🏆' : '';
        html += `${vote.voted_answers}: ${vote.vote_count} vote${vote.vote_count > 1 ? 's' : ''}${badge}`;
        if (idx < votingInfo.length - 1) html += ' | ';
      });
      html += "</div>";
    }

    // Show explanation if available
    if (q.meta && q.meta.explain) {
      html += '<div class="explanation-info">';
      html += '<strong>💡 Explanation:</strong><br>';
      html += sanitizeHTML(q.meta.explain);
      html += "</div>";
    }

    // Show correct content if available
    if (q.correct_content) {
      html += '<div class="correct-content-info">';
      html += '<strong>📚 Correct Answer Details:</strong><br>';
      html += sanitizeHTML(q.correct_content);
      html += "</div>";
    }
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

  const q = testSession.questions[currentQuestion];
  const isMultipleAnswer = hasMultipleCorrectAnswers(q);

  if (isMultipleAnswer) {
    // Handle multiple selection with checkbox
    let currentAnswers = userAnswers[currentQuestion];
    if (!Array.isArray(currentAnswers)) {
      currentAnswers = [];
    }

    const index = currentAnswers.indexOf(letter);
    if (index > -1) {
      // Remove if already selected
      currentAnswers.splice(index, 1);
    } else {
      // Add if not selected
      currentAnswers.push(letter);
    }

    // Sort answers alphabetically
    currentAnswers.sort();

    userAnswers[currentQuestion] = currentAnswers.length > 0 ? currentAnswers : undefined;
  } else {
    // Handle single selection with radio
    userAnswers[currentQuestion] = letter;
  }

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
  const correctAnswers = getCorrectAnswers(q);
  const userAnswer = userAnswers[currentQuestion];

  let isCorrect = false;
  if (Array.isArray(userAnswer)) {
    // Multiple answers: check if arrays match
    isCorrect = userAnswer.length === correctAnswers.length &&
      userAnswer.every(a => correctAnswers.includes(a));
  } else {
    // Single answer: check if it matches
    isCorrect = correctAnswers.length === 1 && correctAnswers[0] === userAnswer;
  }

  questionResults[currentQuestion] = isCorrect;

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
    isFlipped = false;
    if (testSession.config.mode === "flashcard") {
      renderFlashcard();
    } else {
      renderQuestion();
    }
    renderQuestionGrid();
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
    isFlipped = false;
    if (testSession.config.mode === "flashcard") {
      renderFlashcard();
    } else {
      renderQuestion();
    }
    renderQuestionGrid();
  }
});

els.submitBtn.addEventListener("click", () => {
  if (testSession.config.mode === "flashcard") {
    // In flashcard mode, just exit to home without showing results
    if (confirm("Are you sure you want to exit flashcard mode?")) {
      window.location.href = "index.html";
    }
  } else {
    submitTest();
  }
});

els.exitBtn.addEventListener("click", () => {
  if (testSession.config.mode === "flashcard") {
    // In flashcard mode, just exit to home
    if (confirm("Are you sure you want to exit flashcard mode?")) {
      window.location.href = "index.html";
    }
    return;
  }

  const answeredCount = Object.keys(userAnswers).length;
  const totalQuestions = testSession.questions.length;
  const unanswered = totalQuestions - answeredCount;

  let message = "Are you sure you want to submit the test?";
  if (unanswered > 0) {
    message += `\n\nYou have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""
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
    const userAnswer = userAnswers[idx];
    const correctAnswers = getCorrectAnswers(q);

    // Format answers for display
    const userAnswerDisplay = Array.isArray(userAnswer)
      ? userAnswer.join(", ")
      : (userAnswer || "Not answered");
    const correctAnswerDisplay = correctAnswers.join(", ");

    // Check if correct
    let isCorrect = false;
    if (Array.isArray(userAnswer)) {
      isCorrect = userAnswer.length === correctAnswers.length &&
        userAnswer.every(a => correctAnswers.includes(a));
    } else if (userAnswer) {
      isCorrect = correctAnswers.length === 1 && correctAnswers[0] === userAnswer;
    }

    if (isCorrect) correct++;

    return {
      questionIndex: idx,
      questionText: q.text,
      userAnswer: userAnswerDisplay,
      correctAnswer: correctAnswerDisplay,
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

  // Auto-save result to database
  saveResultToDatabase(result);

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

  // Store all result details for filtering
  allResultDetails = result.details;

  // Update filter counts
  const correctCount = result.details.filter((d) => d.isCorrect).length;
  const incorrectCount = result.details.filter((d) => !d.isCorrect).length;
  els.countAll.textContent = result.total;
  els.countCorrect.textContent = correctCount;
  els.countIncorrect.textContent = incorrectCount;

  // Reset filter to 'all'
  currentFilter = "all";
  updateFilterButtons();
  renderFilteredResults();

  // Hide test section and show result modal
  els.testSection.classList.add("hidden");
  els.resultModal.classList.remove("hidden");

  // Change Save button to Start New Test
  els.saveBtn.textContent = "🚀 Start New Test";
  els.saveBtn.style.display = "block";
  els.saveBtn.disabled = false;
  els.saveBtn.style.opacity = "1";
  els.saveBtn.style.cursor = "pointer";
  els.saveBtn.onclick = () => {
    window.location.href = "index.html";
  };

  // Store result for saving
  window.currentResult = result;
}

// Auto-save result to database
async function saveResultToDatabase(result) {
  try {
    // Prepare result data for database with full questions
    const resultData = {
      quizName: testSession.fileName,
      mode: testSession.config.mode,
      score: result.score,
      total: result.total,
      percent: result.percent,
      durationSeconds: result.durationSeconds,
      date: result.date,
      details: result.details,
      questions: testSession.questions, // Save full questions for viewing later
      config: testSession.config,
    };

    // Save to IndexedDB
    await quizDB.saveResult(resultData);
    showToast("✅ Result saved successfully!", "success");
  } catch (err) {
    console.error("Failed to save result:", err);
    showToast("❌ Failed to save result", "error");
  }
}

// Toast notification function
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

// Show saved result (when viewing from history)
function showSavedResult(result) {
  // Hide config and test sections
  els.configModal.classList.add("hidden");
  els.testSection.classList.add("hidden");

  // Set up testSession with saved questions for detail viewing
  testSession = {
    questions: result.questions || [],
    fileName: result.quizName,
    config: result.config || {},
  };

  // Populate result modal
  populateResultModal(result, true);

  // Change button text to "Start New Test"
  els.saveBtn.textContent = "🚀 Start New Test";
  els.saveBtn.style.display = "block";
  els.saveBtn.onclick = () => {
    window.location.href = "index.html";
  };

  // Show result modal
  els.resultModal.classList.remove("hidden");
}

// Populate result modal with data
function populateResultModal(result, isSavedResult = false) {
  const passed = result.percent >= 72;

  // Icon and title
  els.resultIcon.textContent = passed ? "✅" : "❌";
  els.resultTitle.textContent = passed
    ? "Congratulations!"
    : "Keep Practicing!";
  els.resultSubtitle.textContent = "Test completed";

  // Stats
  els.scoreValue.textContent = `${result.score}/${result.total}`;
  els.percentValue.textContent = `${result.percent.toFixed(1)}%`;

  // Duration
  const duration = formatDurationFromSeconds(result.durationSeconds);
  els.durationValue.textContent = duration;

  // Store all result details for filtering
  allResultDetails = result.details;

  // Details list
  renderResultDetails(result.details, isSavedResult);

  // Update filter counts
  updateFilterCounts(result.details);
}

// Format duration from seconds (HH:MM:SS)
function formatDurationFromSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

// Render result details list
function renderResultDetails(details, isSavedResult = false) {
  let html = "";
  if (details.length === 0) {
    html =
      '<div class="empty-filter-state">No questions match this filter</div>';
  } else {
    details.forEach((detail) => {
      const statusClass = detail.isCorrect ? "correct" : "incorrect";
      const status = detail.isCorrect
        ? "✓ Correct"
        : `✗ Wrong (Selected: ${detail.userAnswer}, Correct: ${detail.correctAnswer})`;

      html += `
        <div class="detail-item ${statusClass}" data-question-index="${detail.questionIndex
        }">
          <strong>Q${detail.questionIndex + 1}:</strong> ${status}
        </div>
      `;
    });
  }

  els.detailsList.innerHTML = html;

  // Add click handlers to view question details
  document.querySelectorAll(".detail-item").forEach((item) => {
    const questionIndex = parseInt(item.dataset.questionIndex);
    if (!isNaN(questionIndex)) {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        if (
          testSession &&
          testSession.questions &&
          testSession.questions[questionIndex]
        ) {
          showQuestionDetail(questionIndex);
        } else {
          showToast("Question data not available", "error");
        }
      });
    }
  });
}

// Update filter counts
function updateFilterCounts(details) {
  const total = details.length;
  const correct = details.filter((d) => d.isCorrect).length;
  const incorrect = total - correct;

  document.getElementById("countAll").textContent = total;
  document.getElementById("countCorrect").textContent = correct;
  document.getElementById("countIncorrect").textContent = incorrect;
}

// Utility to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Back to home
els.newTestBtn.addEventListener("click", () => {
  testSession = null;
  userAnswers = {};
  questionResults = {};
  currentQuestion = 0;
  testStartTime = null;
  clearInterval(timerInterval);

  // Hide question grid and remove sidebar class
  els.questionGrid.classList.add("hidden");
  document.querySelector(".container").classList.remove("has-sidebar");

  // Redirect to home page
  window.location.href = "index.html";
});

// Update filter buttons active state
function updateFilterButtons() {
  els.filterAll.classList.toggle("active", currentFilter === "all");
  els.filterCorrect.classList.toggle("active", currentFilter === "correct");
  els.filterIncorrect.classList.toggle("active", currentFilter === "incorrect");
}

// Render filtered results
function renderFilteredResults() {
  let filteredDetails = allResultDetails;

  if (currentFilter === "correct") {
    filteredDetails = allResultDetails.filter((d) => d.isCorrect);
  } else if (currentFilter === "incorrect") {
    filteredDetails = allResultDetails.filter((d) => !d.isCorrect);
  }

  let detailsHTML = "";
  if (filteredDetails.length === 0) {
    detailsHTML =
      '<div class="empty-filter-state">No questions match this filter</div>';
  } else {
    filteredDetails.forEach((detail) => {
      const className = detail.isCorrect ? "correct" : "incorrect";
      const status = detail.isCorrect
        ? "✓ Correct"
        : `✗ Wrong (Selected: ${detail.userAnswer}, Correct: ${detail.correctAnswer})`;
      detailsHTML += `
        <div class="detail-item ${className}" data-question-index="${detail.questionIndex
        }">
          <strong>Q${detail.questionIndex + 1}:</strong> ${status}
        </div>
      `;
    });
  }
  els.detailsList.innerHTML = detailsHTML;

  // Add click listeners to detail items
  document.querySelectorAll(".detail-item").forEach((item) => {
    const questionIndex = parseInt(item.dataset.questionIndex);
    if (!isNaN(questionIndex)) {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        showQuestionDetail(questionIndex);
      });
    }
  });
}

// Filter button event listeners
els.filterAll.addEventListener("click", () => {
  currentFilter = "all";
  updateFilterButtons();
  renderFilteredResults();
});

els.filterCorrect.addEventListener("click", () => {
  currentFilter = "correct";
  updateFilterButtons();
  renderFilteredResults();
});

els.filterIncorrect.addEventListener("click", () => {
  currentFilter = "incorrect";
  updateFilterButtons();
  renderFilteredResults();
});

// Show question detail in popup
function showQuestionDetail(questionIndex) {
  const q = testSession.questions[questionIndex];
  const detail = allResultDetails[questionIndex];
  const correctAnswers = getCorrectAnswers(q);
  const votingInfo = parseVotingInfo(q.correct_answer);

  let html = `<h2 class="question-detail-title">Question ${questionIndex + 1
    }</h2>`;
  html += `<div class="question-detail-text">${sanitizeHTML(q.text)}</div>`;

  // Add question images
  if (q.question_images && q.question_images.length > 0) {
    html += '<div class="question-detail-images">';
    q.question_images.forEach((img) => {
      html += `<img src="${sanitizeHTML(img)}" alt="Question image">`;
    });
    html += "</div>";
  }

  // Add choices
  html += '<div class="question-detail-choices">';
  q.choices.forEach((choice) => {
    // Handle both single and multiple answers in detail.userAnswer
    const userAnswerArray = detail.userAnswer.includes(", ")
      ? detail.userAnswer.split(", ")
      : [detail.userAnswer];
    const isSelected = userAnswerArray.includes(choice.letter);
    const isCorrect = correctAnswers.includes(choice.letter);

    let choiceClass = "question-detail-choice";
    if (isSelected && isCorrect) {
      choiceClass += " choice-correct";
    } else if (isSelected && !isCorrect) {
      choiceClass += " choice-incorrect";
    } else if (isCorrect) {
      choiceClass += " choice-correct-answer";
    }

    html += `<div class="${choiceClass}">`;
    html += `<span class="choice-letter">${sanitizeHTML(
      choice.letter
    )}.</span> `;
    html += `<span class="choice-content">${sanitizeHTML(
      choice.content
    )}</span>`;

    if (isSelected && isCorrect) {
      html +=
        ' <span class="choice-badge badge-correct">✓ Your answer (Correct)</span>';
    } else if (isSelected && !isCorrect) {
      html +=
        ' <span class="choice-badge badge-incorrect">✗ Your answer (Wrong)</span>';
    } else if (isCorrect) {
      html +=
        ' <span class="choice-badge badge-answer">✓ Correct Answer</span>';
    }

    if (choice.has_images && choice.images && choice.images.length > 0) {
      html += '<div class="choice-images">';
      choice.images.forEach((img) => {
        html += `<img src="${sanitizeHTML(img)}" alt="Choice ${choice.letter
          }">`;
      });
      html += "</div>";
    }

    html += "</div>";
  });
  html += "</div>";

  // Add result summary
  const resultClass = detail.isCorrect ? "result-correct" : "result-incorrect";
  const resultIcon = detail.isCorrect ? "✓" : "✗";
  const resultText = detail.isCorrect
    ? "You answered this question correctly!"
    : `You answered incorrectly. You selected ${detail.userAnswer}, but the correct answer${correctAnswers.length > 1 ? 's are' : ' is'} ${detail.correctAnswer}.`;
  html += `<div class="question-detail-result ${resultClass}">${resultIcon} ${resultText}</div>`;

  // Add voting information if available
  if (votingInfo && votingInfo.length > 0) {
    html += '<div class="voting-info-detail">';
    html += '<strong>📊 Community Votes:</strong><br>';
    votingInfo.forEach((vote, idx) => {
      const badge = vote.is_most_voted ? ' 🏆' : '';
      html += `${vote.voted_answers}: ${vote.vote_count} vote${vote.vote_count > 1 ? 's' : ''}${badge}`;
      if (idx < votingInfo.length - 1) html += ' | ';
    });
    html += "</div>";
  }

  // Add explanation if available
  if (q.meta && q.meta.explain) {
    html += '<div class="explanation-info-detail">';
    html += '<strong>💡 Explanation:</strong><br>';
    html += sanitizeHTML(q.meta.explain);
    html += "</div>";
  }

  // Add correct content if available
  if (q.correct_content) {
    html += '<div class="correct-content-info-detail">';
    html += '<strong>📚 Correct Answer Details:</strong><br>';
    html += sanitizeHTML(q.correct_content);
    html += "</div>";
  }

  els.questionDetailContainer.innerHTML = html;
  els.questionDetailModal.classList.remove("hidden");
}

// Close question detail modal
els.closeQuestionDetail.addEventListener("click", () => {
  els.questionDetailModal.classList.add("hidden");
});

// Close modal when clicking outside
els.questionDetailModal.addEventListener("click", (e) => {
  if (e.target === els.questionDetailModal) {
    els.questionDetailModal.classList.add("hidden");
  }
});

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  // Close question detail modal with Escape key
  if (
    e.key === "Escape" &&
    !els.questionDetailModal.classList.contains("hidden")
  ) {
    els.questionDetailModal.classList.add("hidden");
    return;
  }

  // Only handle keyboard shortcuts when test is active
  if (!testSession || els.testSection.classList.contains("hidden")) {
    return;
  }

  const isFlashcardMode = testSession.config.mode === "flashcard";

  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      if (currentQuestion > 0) {
        currentQuestion--;
        isFlipped = false;
        if (isFlashcardMode) {
          renderFlashcard();
        } else {
          renderQuestion();
        }
        renderQuestionGrid();
      }
      break;

    case "ArrowRight":
      e.preventDefault();
      if (currentQuestion < testSession.questions.length - 1) {
        currentQuestion++;
        isFlipped = false;
        if (isFlashcardMode) {
          renderFlashcard();
        } else {
          renderQuestion();
        }
        renderQuestionGrid();
      }
      break;

    case "ArrowUp":
    case "ArrowDown":
      if (isFlashcardMode) {
        e.preventDefault();
        toggleFlashcard();
      }
      break;
  }
});

// Initialize app when page loads
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
