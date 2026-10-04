const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createContext(question, mode = "practice") {
  const elements = new Map();
  function element() {
    return {
      innerHTML: "", style: {}, dataset: {},
      addEventListener() {}, removeEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    };
  }
  const context = vm.createContext({
    console, setTimeout, setInterval, clearInterval,
    sessionStorage: { getItem() { return null; } },
    document: {
      addEventListener() {}, querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement() {
        const node = element();
        Object.defineProperty(node, "textContent", {
          set(value) {
            node.innerHTML = String(value).replace(/&/g, "&amp;")
              .replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
          },
        });
        return node;
      },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "quiz_trainer.js"), "utf8"), context);
  context.inputQuestion = question;
  context.inputMode = mode;
  vm.runInContext(`testSession = { questions: [inputQuestion], config: { mode: inputMode } };
    allResultDetails = [{ userAnswer: "A", correctAnswer: "A", isCorrect: true }];`, context);
  return { context, elements };
}

function makeQuestion(comments) {
  return {
    text: "Question", choices: [{ letter: "A", content: "Answer", is_correct: true }],
    comments,
  };
}

const thread = [{
  author: "Parent", created_at: "October 4, 2026", text: "Parent text",
  selected_answer: "A", upvotes: 0,
  replies: [{ author: "Child", text: "Child text", replies: [
    { author: "Grandchild", text: "Grandchild text", replies: [
      { author: "Great-grandchild", text: "Deep reply" },
    ] },
  ] }],
}, { author: "Next parent", text: "Next thread", replies: [] }];

test("discussion preserves four-level nesting, source order and actual total", () => {
  const { context } = createContext(makeQuestion(thread));
  const html = vm.runInContext("renderDiscussion(inputQuestion)", context);
  assert.match(html, /5 comments/);
  assert.equal((html.match(/class="discussion-comment"/g) || []).length, 5);
  assert.equal((html.match(/class="comment-replies" open/g) || []).length, 3);
  assert.match(html, /Selected answer: A/);
  assert.match(html, /0 upvotes/);
  assert.match(html, /October 4, 2026/);
  assert.ok(html.indexOf("Deep reply") < html.indexOf("Next thread"));
  assert.match(html, /Deep reply<\/p><\/article><\/li><\/ol><\/details><\/li><\/ol><\/details><\/li><\/ol><\/details>/);
});

test("missing, empty or malformed comments remain compatible with old quizzes", () => {
  for (const comments of [undefined, null, [], "invalid", [null]]) {
    const { context } = createContext(makeQuestion(comments));
    assert.equal(vm.runInContext("renderDiscussion(inputQuestion)", context), "");
  }
});

test("all imported textual metadata is escaped instead of creating HTML", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const { context } = createContext(makeQuestion([{
    author: attack, text: attack, created_at: attack, selected_answer: attack,
    upvotes: attack, replies: [],
  }]));
  const html = vm.runInContext("renderDiscussion(inputQuestion)", context);
  assert.ok(!html.includes("<img"));
  assert.equal((html.match(/&lt;img/g) || []).length, 4);
  assert.ok(!html.includes("comment-upvotes"));
});

test("practice and mistake review reveal discussion only after grading", () => {
  for (const mode of ["practice", "mistakes"]) {
    const { context, elements } = createContext(makeQuestion(thread), mode);
    vm.runInContext("renderQuestion()", context);
    assert.ok(!elements.get("questionContainer").innerHTML.includes('class="discussion"'));
    vm.runInContext('userAnswers[0] = "A"; renderQuestion()', context);
    assert.ok(!elements.get("questionContainer").innerHTML.includes('class="discussion"'));
    vm.runInContext("questionResults[0] = false; renderQuestion()", context);
    assert.ok(elements.get("questionContainer").innerHTML.includes('class="discussion"'));
  }
});

test("timed questions hide discussion while result details show it", () => {
  const { context, elements } = createContext(makeQuestion(thread), "timed");
  vm.runInContext("questionResults[0] = true; renderQuestion()", context);
  assert.ok(!elements.get("questionContainer").innerHTML.includes('class="discussion"'));
  vm.runInContext("showQuestionDetail(0)", context);
  assert.ok(elements.get("questionDetailContainer").innerHTML.includes('class="discussion"'));
});

test("flashcard discussion is outside the rotating card and follows flip state", () => {
  const { context, elements } = createContext(makeQuestion(thread), "flashcard");
  const visibility = [];
  const discussion = { classList: { toggle(name, hidden) { visibility.push([name, hidden]); } } };
  vm.runInContext("renderFlashcard()", context);
  const container = elements.get("questionContainer");
  assert.match(container.innerHTML, /class="flashcard-discussion hidden"/);
  assert.ok(container.innerHTML.indexOf("flashcard-discussion") > container.innerHTML.indexOf("keyboard-shortcuts"));
  container.querySelector = () => discussion;
  vm.runInContext("toggleFlashcard(); toggleFlashcard()", context);
  assert.deepEqual(visibility, [["hidden", false], ["hidden", true]]);
});
