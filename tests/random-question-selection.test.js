const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createElementStub() {
  return {
    addEventListener() {},
    classList: {
      add() {},
      contains() { return false; },
      remove() {},
      toggle() {},
    },
    dataset: {},
    disabled: false,
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll() { return []; },
    style: {},
    textContent: "",
    value: "",
  };
}

function createQuizContext() {
  const element = createElementStub();
  const document = {
    addEventListener() {},
    createElement: createElementStub,
    getElementById() { return createElementStub(); },
    querySelector() { return element; },
    querySelectorAll() { return []; },
  };
  const storage = {
    getItem() { return null; },
    removeItem() {},
    setItem() {},
  };
  const context = vm.createContext({
    alert() {},
    clearInterval,
    confirm() { return true; },
    console,
    document,
    sessionStorage: storage,
    setInterval,
    setTimeout,
    window: { location: { href: "" } },
  });
  const source = fs.readFileSync(
    path.join(__dirname, "..", "quiz_trainer.js"),
    "utf8"
  );
  vm.runInContext(source, context);
  return context;
}

function makeQuestions(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    text: `Question ${index + 1}`,
    choices: [
      { letter: "A", content: "Correct", is_correct: true },
      { letter: "B", content: "Wrong", is_correct: false },
    ],
  }));
}

function generateRandomQuestionIds(context, questions, count, seed) {
  vm.runInContext(`questions = ${JSON.stringify(questions)};`, context);
  vm.runInContext(`Date.now = () => ${seed};`, context);
  vm.runInContext(`generateTest({
    numQuestions: ${count},
    mode: "practice",
    timeMinutes: 0,
    shuffle: false,
    questionSelection: "random",
    rangeFrom: 1,
    rangeTo: ${questions.length},
    sortOrder: "original",
    autoRemoveMistakes: true,
  });`, context);
  return vm.runInContext("testSession.questions.map((question) => question.id)", context);
}

test("random selection shuffles even when every available question is selected", () => {
  const context = createQuizContext();
  const questions = makeQuestions(12);

  const firstRun = generateRandomQuestionIds(context, questions, questions.length, 1_000);
  const secondRun = generateRandomQuestionIds(context, questions, questions.length, 2_000);

  assert.notDeepEqual(firstRun, secondRun);
  assert.deepEqual([...firstRun].sort((a, b) => a - b), questions.map(({ id }) => id));
  assert.deepEqual([...secondRun].sort((a, b) => a - b), questions.map(({ id }) => id));
});
