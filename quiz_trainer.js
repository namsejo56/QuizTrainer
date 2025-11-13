// Global state
let questions = null;
let fileName = "";
let testSession = null;
let userAnswers = {};
let currentQuestion = 0;
let testStartTime = null;
let timerInterval = null;

// DOM elements
const els = {
  errorMsg: document.getElementById("errorMsg"),
  importSection: document.getElementById("importSection"),
  fileInput: document.getElementById("fileInput"),
  fileStatus: document.getElementById("fileStatus"),
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
  answeredCount: document.getElementById("answeredCount"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  submitBtn: document.getElementById("submitBtn"),
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

    // Show config modal
    openConfigModal();
  } catch (err) {
    showError(`Failed to load JSON: ${err.message}`);
    questions = null;
    fileName = "";
    els.fileStatus.classList.add("hidden");
  }
});

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
  els.configModal.classList.add("hidden");
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
  currentQuestion = 0;
  testStartTime = Date.now();

  // Hide config modal and import section
  els.configModal.classList.add("hidden");
  els.importSection.classList.add("hidden");

  // Show test section
  els.testSection.classList.remove("hidden");

  // Start timer if timed mode
  if (config.mode === "timed" && config.timeMinutes > 0) {
    startTimer(config.timeMinutes * 60);
  } else {
    els.timer.classList.add("hidden");
  }

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
  html += '<div class="choices">';
  q.choices.forEach((choice) => {
    const isSelected = userAnswers[currentQuestion] === choice.letter;
    html += `
      <div class="choice ${isSelected ? "selected" : ""}" data-letter="${
      choice.letter
    }">
        <input type="radio" name="current-question" value="${choice.letter}" ${
      isSelected ? "checked" : ""
    }>
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

  els.questionContainer.innerHTML = html;

  // Add click listeners to choices
  document.querySelectorAll(".choice").forEach((choiceEl) => {
    choiceEl.addEventListener("click", () => {
      const letter = choiceEl.dataset.letter;
      selectAnswer(letter);
    });
  });

  // Update navigation buttons
  els.prevBtn.disabled = currentQuestion === 0;

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
  userAnswers[currentQuestion] = letter;
  renderQuestion();
}

// Navigation
els.prevBtn.addEventListener("click", () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
});

els.nextBtn.addEventListener("click", () => {
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

// New test
els.newTestBtn.addEventListener("click", () => {
  testSession = null;
  userAnswers = {};
  currentQuestion = 0;
  testStartTime = null;
  clearInterval(timerInterval);

  els.resultModal.classList.add("hidden");
  els.importSection.classList.remove("hidden");
  els.fileStatus.classList.add("hidden");
  els.fileInput.value = "";
  questions = null;
  fileName = "";
});
