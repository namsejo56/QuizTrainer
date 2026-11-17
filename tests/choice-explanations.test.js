const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createContext(question, mode) {
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
              .replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    allResultDetails = [{ userAnswer: "A", correctAnswer: "B", isCorrect: false }];`, context);
  return { context, elements };
}

const question = {
  text: "Question",
  choices: [
    { letter: "A", content: "First", is_correct: false },
    { letter: "B", content: "Second", is_correct: true },
    { letter: "C", content: "Third", is_correct: false },
  ],
  meta: { explanations: { A: "-- why A <b>x</b>", B: "-- why B" } },
};

function render(mode, answered) {
  const { context, elements } = createContext(question, mode);
  vm.runInContext('userAnswers[0] = "A"; renderQuestion()', context);
  if (answered) vm.runInContext("questionResults[0] = false; renderQuestion()", context);
  return elements.get("questionContainer").innerHTML;
}

test("practice shows per-choice explanations after answering, escaped and without the marker", () => {
  const html = render("practice", true);
  assert.equal((html.match(/class="choice-explanation"/g) || []).length, 2);
  assert.match(html, /why A &lt;b&gt;x&lt;\/b&gt;/);
  assert.ok(!html.includes("-- why"));
});

test("explanations stay hidden before answering and outside immediate-feedback modes", () => {
  assert.ok(!render("practice", false).includes("choice-explanation"));
  assert.ok(!render("timed", true).includes("choice-explanation"));
});

test("questions without explanations render unchanged", () => {
  const { context, elements } = createContext({ ...question, meta: undefined }, "practice");
  vm.runInContext('userAnswers[0] = "A"; questionResults[0] = false; renderQuestion()', context);
  assert.ok(!elements.get("questionContainer").innerHTML.includes("choice-explanation"));
});
