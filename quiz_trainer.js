// Global state
let questions = null;
let fileName = "";
let quizId = null;
let testSession = null;
let userAnswers = {};
let questionResults = {}; // Store if each question was answered correctly
let mistakeQuestionKeys = new Set();
let mistakeDecisions = {};
let mistakeBankUpdateQueue = Promise.resolve();
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
  autoRemoveMistakes: document.getElementById("autoRemoveMistakes"),
  mistakeSettingsGroup: document.getElementById("mistakeSettingsGroup"),
  mistakesModeCard: document.getElementById("mistakesModeCard"),
  mistakesModeDesc: document.getElementById("mistakesModeDesc"),
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

function hasImmediateFeedback(mode) {
  return mode === "practice" || mode === "mistakes";
}

function isCurrentMistakeMode() {
  return testSession && testSession.config.mode === "mistakes";
}

function shouldAutoRemoveMistakes() {
  return isCurrentMistakeMode() && testSession.config.autoRemoveMistakes;
}

function shouldShowManualMistakeActions() {
  return isCurrentMistakeMode() && !testSession.config.autoRemoveMistakes;
}

function hasStoredAnswerForQuestion(index) {
  return Object.prototype.hasOwnProperty.call(userAnswers, index);
}

function hasSelectedAnswerForQuestion(index) {
  return Boolean(userAnswers[index]);
}

function hasQuestionResult(index) {
  return Object.prototype.hasOwnProperty.call(questionResults, index);
}

function isAnswerCorrect(userAnswer, correctAnswers) {
  if (Array.isArray(userAnswer)) {
    return userAnswer.length === correctAnswers.length &&
      userAnswer.every((answer) => correctAnswers.includes(answer));
  }

  return Boolean(userAnswer) &&
    correctAnswers.length === 1 &&
    correctAnswers[0] === userAnswer;
}

function updateMistakeBankAfterAnswer(question, isCorrect, questionIndex) {
  if (!isCorrect) {
    if (shouldShowManualMistakeActions()) {
      mistakeDecisions[questionIndex] = "review";
    }
    persistMistakeStatus(question, true);
    return;
  }

  if (shouldAutoRemoveMistakes()) {
    persistMistakeStatus(question, false);
  }
}

async function completeMistakeDecision(questionIndex, decision, needsReview) {
  mistakeDecisions[questionIndex] = decision;
  await persistMistakeStatus(
    testSession.questions[questionIndex],
    needsReview
  );

  if (currentQuestion !== questionIndex) return;

  if (currentQuestion < testSession.questions.length - 1) {
    currentQuestion++;
    isFlipped = false;
    renderCurrentQuestionView();
  } else {
    submitTest();
  }
}

function normalizeQuestionValue(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

// Stable across range/random selection and choice shuffling.
function getQuestionKey(question) {
  const sourceId = question.id ?? question.question_id ?? question.questionId;
  if (sourceId !== undefined && sourceId !== null && sourceId !== "") {
    return `id:${normalizeQuestionValue(sourceId)}`;
  }

  if (question.url) {
    return `url:${normalizeQuestionValue(question.url)}`;
  }

  const canonicalQuestion = {
    text: normalizeQuestionValue(question.text),
    images: (question.question_images || []).map(normalizeQuestionValue),
    choices: [...question.choices]
      .map((choice) => ({
        letter: normalizeQuestionValue(choice.letter),
        content: normalizeQuestionValue(choice.content),
        images: (choice.images || []).map(normalizeQuestionValue),
        isCorrect: Boolean(choice.is_correct),
      }))
      .sort((a, b) => a.letter.localeCompare(b.letter)),
  };

  return `content:${JSON.stringify(canonicalQuestion)}`;
}

function getQuestionPool(mode) {
  if (mode !== "mistakes") return [...questions];
  return questions.filter((question) =>
    mistakeQuestionKeys.has(getQuestionKey(question))
  );
}

function renderCurrentQuestionView() {
  if (testSession.config.mode === "flashcard") {
    renderFlashcard();
  } else {
    renderQuestion();
  }

  renderQuestionGrid();
}

function updateQuestionLimits(mode) {
  const availableCount = getQuestionPool(mode).length;
  const maximum = Math.max(1, availableCount);
  const defaultCount = Math.min(65, maximum);
  const rangeFrom = document.getElementById("rangeFrom");
  const rangeTo = document.getElementById("rangeTo");

  els.numQuestions.max = maximum;
  els.numQuestions.value = defaultCount;
  els.maxQuestions.textContent = `(maximum: ${availableCount} questions)`;
  rangeFrom.max = maximum;
  rangeTo.max = maximum;
  rangeFrom.value = 1;
  rangeTo.value = defaultCount;
}

function updateMistakesModeAvailability() {
  const mistakesRadio = document.querySelector('input[name="mode"][value="mistakes"]');
  const count = mistakeQuestionKeys.size;
  const isAvailable = Boolean(quizId) && count > 0;

  mistakesRadio.disabled = !isAvailable;
  els.mistakesModeCard.classList.toggle("is-disabled", !isAvailable);

  if (!quizId) {
    els.mistakesModeDesc.textContent = "Save this quiz to keep a mistake bank";
  } else if (count === 0) {
    els.mistakesModeDesc.textContent = "No mistakes to review yet";
  } else {
    els.mistakesModeDesc.textContent = `${count} question${count > 1 ? "s" : ""} to review`;
  }
}

async function initializeMistakeBank() {
  if (!quizId) return;

  let bank = await quizDB.getMistakeBank(quizId);

  if (!bank.version) {
    const [results, savedQuizzes] = await Promise.all([
      quizDB.getAllResults(),
      quizDB.getAllQuizzes(),
    ]);
    const sameNameCount = savedQuizzes.filter(
      (quiz) => quiz.name === fileName
    ).length;
    const currentQuestionKeys = new Set(questions.map(getQuestionKey));
    const legacyMistakeKeys = new Set();

    results.forEach((result) => {
      const matchesById = result.quizId != null && result.quizId === quizId;
      const matchesLegacyName = result.quizId == null &&
        sameNameCount === 1 && result.quizName === fileName;

      if (!matchesById && !matchesLegacyName) return;

      (result.details || []).forEach((detail) => {
        if (detail.isCorrect || !result.questions) return;
        const question = result.questions[detail.questionIndex];
        if (!question) return;

        const questionKey = getQuestionKey(question);
        if (currentQuestionKeys.has(questionKey)) {
          legacyMistakeKeys.add(questionKey);
        }
      });
    });

    const initializedKeys = await quizDB.initializeMistakeBank(
      quizId,
      [...legacyMistakeKeys]
    );
    bank = { keys: initializedKeys, version: 1 };
  }

  mistakeQuestionKeys = new Set(bank.keys);
}

function persistMistakeStatus(question, needsReview) {
  if (!quizId) return Promise.resolve();

  const questionKey = getQuestionKey(question);
  if (needsReview) {
    mistakeQuestionKeys.add(questionKey);
  } else {
    mistakeQuestionKeys.delete(questionKey);
  }

  updateMistakesModeAvailability();
  mistakeBankUpdateQueue = mistakeBankUpdateQueue
    .then(() => quizDB.setQuestionMistakeStatus(
      quizId,
      questionKey,
      needsReview
    ))
    .catch((err) => {
      console.error("Failed to update mistake bank:", err);
      showToast("Failed to update mistake bank", "error");
    });

  return mistakeBankUpdateQueue;
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
async function initApp() {
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
    quizId = data.quizId || null;

    // Clear session storage
    sessionStorage.removeItem("quizData");

    await initializeMistakeBank();

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
  updateMistakesModeAvailability();
  updateQuestionLimits("practice");

  // Show range by default, hide random
  document.getElementById("rangeGroup").style.display = "flex";
  document.getElementById("randomGroup").style.display = "none";

  els.configModal.classList.remove("hidden");
} // Handle mode change
document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const mode = e.target.value;
    els.timeGroup.style.display = mode === "timed" ? "block" : "none";
    els.mistakeSettingsGroup.style.display =
      mode === "mistakes" ? "block" : "none";
    updateQuestionLimits(mode);
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
  const autoRemoveMistakes = els.autoRemoveMistakes.checked;
  const availableQuestions = getQuestionPool(mode);
  const availableCount = availableQuestions.length;

  if (availableCount === 0) {
    alert(mode === "mistakes"
      ? "There are no mistakes to review yet"
      : "There are no questions available");
    return;
  }

  let rangeFrom = 1;
  let rangeTo = availableCount;

  if (questionSelection === "range") {
    rangeFrom = parseInt(document.getElementById("rangeFrom").value);
    rangeTo = parseInt(document.getElementById("rangeTo").value);

    if (rangeFrom < 1 || rangeFrom > availableCount) {
      alert(`"From" must be between 1 and ${availableCount}`);
      return;
    }
    if (rangeTo < 1 || rangeTo > availableCount) {
      alert(`"To" must be between 1 and ${availableCount}`);
      return;
    }
    if (rangeFrom > rangeTo) {
      alert('"From" must be less than or equal to "To"');
      return;
    }
  } else {
    if (numQuestions < 1 || numQuestions > availableCount) {
      alert(`Number of questions must be between 1 and ${availableCount}`);
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
    autoRemoveMistakes,
  });
});

// Generate test
function generateTest(config) {
  const seed = Date.now();

  // Sort questions if needed
  let sortedQuestions = getQuestionPool(config.mode);
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
      choices: shuffleArray(q.choices, seed + getQuestionKey(q).length),
    }));
  }

  testSession = {
    questions: selectedQuestions,
    config: { ...config, seed },
    startTime: new Date().toISOString(),
    fileName: fileName,
    quizId: quizId,
  };

  userAnswers = {};
  questionResults = {};
  mistakeDecisions = {};
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
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);

  let html = '<div class="question-grid-title">Questions</div>';
  html += '<div class="question-grid-items">';

  for (let i = 0; i < totalQuestions; i++) {
    let statusClass = "unanswered";

    if (isFeedbackMode) {
      // Feedback modes show correct, incorrect, and unanswered states.
      if (questionResults[i] === true) {
        statusClass = "correct";
      } else if (questionResults[i] === false) {
        statusClass = "incorrect";
      }
    } else {
      // Timed mode: show answered (green), unanswered (gray)
      if (hasStoredAnswerForQuestion(i)) {
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
      currentQuestion = parseInt(item.dataset.question);
      isFlipped = false;
      renderCurrentQuestionView();
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
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);
  const isAnswered = hasQuestionResult(currentQuestion);
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
    if (isFeedbackMode && isAnswered) {
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

    const disabled = isFeedbackMode && isAnswered ? "disabled" : "";
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

  // Show additional information in immediate-feedback modes after answering.
  if (isFeedbackMode && isAnswered) {
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

  if (
    shouldShowManualMistakeActions() &&
    isAnswered
  ) {
    const isCorrect = questionResults[currentQuestion];
    const decision = mistakeDecisions[currentQuestion];
    const message = isCorrect
      ? "Do you want to remove this question from the mistake bank?"
      : "You answered incorrectly, so this question will stay in the bank.";

    html += '<div class="mistake-review-actions">';
    html += `<div class="mistake-review-message">${message}</div>`;
    html += '<div class="mistake-review-buttons">';
    html += `<button type="button" class="btn-mastered ${decision === "mastered" ? "is-selected" : ""}" ${isCorrect ? "" : "disabled"}>✓ Mastered</button>`;
    html += `<button type="button" class="btn-review-again ${decision === "review" ? "is-selected" : ""}">↻ Review again</button>`;
    html += "</div></div>";
  }

  els.questionContainer.innerHTML = html;

  if (!isFeedbackMode || !isAnswered) {
    document.querySelectorAll(".choice").forEach((choiceEl) => {
      choiceEl.addEventListener("click", () => {
        const letter = choiceEl.dataset.letter;
        selectAnswer(letter);
      });
    });
  }

  const masteredButton = document.querySelector(".btn-mastered");
  const reviewAgainButton = document.querySelector(".btn-review-again");
  const renderedQuestionIndex = currentQuestion;

  if (masteredButton && !masteredButton.disabled) {
    masteredButton.addEventListener("click", async () => {
      masteredButton.disabled = true;
      reviewAgainButton.disabled = true;
      await completeMistakeDecision(
        renderedQuestionIndex,
        "mastered",
        false
      );
    });
  }

  if (reviewAgainButton) {
    reviewAgainButton.addEventListener("click", async () => {
      reviewAgainButton.disabled = true;
      if (masteredButton) masteredButton.disabled = true;
      await completeMistakeDecision(
        renderedQuestionIndex,
        "review",
        true
      );
    });
  }

  // Update navigation buttons
  els.prevBtn.disabled = currentQuestion === 0;

  // Show/hide submit answer button in immediate-feedback modes.
  const hasSelectedAnswer = hasStoredAnswerForQuestion(currentQuestion);

  if (isFeedbackMode) {
    els.submitAnswerBtn.classList.remove("hidden");
    // Enable/disable based on whether answer is selected and not yet submitted
    els.submitAnswerBtn.disabled = !hasSelectedAnswer || isAnswered;
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
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);

  // Feedback modes lock an answer after it is submitted.
  if (isFeedbackMode && hasQuestionResult(currentQuestion)) {
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

    if (currentAnswers.length > 0) {
      userAnswers[currentQuestion] = currentAnswers;
    } else {
      delete userAnswers[currentQuestion];
    }
  } else {
    // Handle single selection with radio
    userAnswers[currentQuestion] = letter;
  }

  // In timed mode, update grid immediately
  if (!isFeedbackMode) {
    renderQuestionGrid();
  }

  renderQuestion();
}

// Submit current answer for an immediate-feedback mode.
function submitCurrentAnswer() {
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);

  if (!isFeedbackMode) return;
  if (!hasSelectedAnswerForQuestion(currentQuestion)) return;
  if (hasQuestionResult(currentQuestion)) return;

  // Check if answer is correct
  const q = testSession.questions[currentQuestion];
  const correctAnswers = getCorrectAnswers(q);
  const userAnswer = userAnswers[currentQuestion];

  const isCorrect = isAnswerCorrect(userAnswer, correctAnswers);

  questionResults[currentQuestion] = isCorrect;
  updateMistakeBankAfterAnswer(q, isCorrect, currentQuestion);

  // Update question grid and re-render
  renderQuestionGrid();
  renderQuestion();
}

// Submit answer button for immediate-feedback modes.
els.submitAnswerBtn.addEventListener("click", () => {
  submitCurrentAnswer();
});

// Navigation
els.prevBtn.addEventListener("click", () => {
  // Auto-submit the current answer before moving in a feedback mode.
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);
  if (
    isFeedbackMode &&
    hasSelectedAnswerForQuestion(currentQuestion) &&
    !hasQuestionResult(currentQuestion)
  ) {
    submitCurrentAnswer();
  }

  if (currentQuestion > 0) {
    currentQuestion--;
    isFlipped = false;
    renderCurrentQuestionView();
  }
});

els.nextBtn.addEventListener("click", () => {
  // Auto-submit the current answer before moving in a feedback mode.
  const isFeedbackMode = hasImmediateFeedback(testSession.config.mode);
  if (
    isFeedbackMode &&
    hasSelectedAnswerForQuestion(currentQuestion) &&
    !hasQuestionResult(currentQuestion)
  ) {
    submitCurrentAnswer();
  }

  if (currentQuestion < testSession.questions.length - 1) {
    currentQuestion++;
    isFlipped = false;
    renderCurrentQuestionView();
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

    const isCorrect = isAnswerCorrect(userAnswer, correctAnswers);

    if (isCorrect) correct++;

    return {
      questionIndex: idx,
      questionText: q.text,
      userAnswer: userAnswerDisplay,
      correctAnswer: correctAnswerDisplay,
      isCorrect,
    };
  });

  details.forEach((detail, index) => {
    updateMistakeBankAfterAnswer(
      testSession.questions[index],
      detail.isCorrect,
      index
    );
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
      quizId: testSession.quizId,
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
    quizId: result.quizId || null,
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
  mistakeDecisions = {};
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
        renderCurrentQuestionView();
      }
      break;

    case "ArrowRight":
      e.preventDefault();
      if (currentQuestion < testSession.questions.length - 1) {
        currentQuestion++;
        isFlipped = false;
        renderCurrentQuestionView();
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
