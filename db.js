// IndexedDB Manager for Quiz Trainer
class QuizDB {
  constructor() {
    this.dbName = "QuizTrainerDB";
    this.version = 2;
    this.db = null;
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for quizzes
        if (!db.objectStoreNames.contains("quizzes")) {
          const quizStore = db.createObjectStore("quizzes", {
            keyPath: "id",
            autoIncrement: true,
          });
          quizStore.createIndex("name", "name", { unique: false });
          quizStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // Create object store for test results
        if (!db.objectStoreNames.contains("results")) {
          const resultStore = db.createObjectStore("results", {
            keyPath: "id",
            autoIncrement: true,
          });
          resultStore.createIndex("quizName", "quizName", { unique: false });
          resultStore.createIndex("date", "date", { unique: false });
          resultStore.createIndex("mode", "mode", { unique: false });
          resultStore.createIndex("passed", "passed", { unique: false });
        }
      };
    });
  }

  // Save quiz data
  async saveQuiz(name, questions, fileName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readwrite");
      const store = transaction.objectStore("quizzes");

      const quizData = {
        name: name,
        fileName: fileName,
        questions: questions,
        createdAt: new Date().toISOString(),
        questionCount: questions.length,
        mistakeQuestionKeys: [],
        mistakeBankVersion: 1,
      };

      const request = store.add(quizData);

      request.onsuccess = () => {
        resolve({ id: request.result, ...quizData });
      };

      request.onerror = () => {
        reject(new Error("Failed to save quiz"));
      };
    });
  }

  // Get all saved quizzes (metadata only, without full questions)
  async getAllQuizzes() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readonly");
      const store = transaction.objectStore("quizzes");
      const request = store.getAll();

      request.onsuccess = () => {
        // Return only metadata to improve performance
        const quizzes = request.result.map((quiz) => ({
          id: quiz.id,
          name: quiz.name,
          fileName: quiz.fileName,
          createdAt: quiz.createdAt,
          questionCount: quiz.questionCount,
        }));
        resolve(quizzes);
      };

      request.onerror = () => {
        reject(new Error("Failed to load quizzes"));
      };
    });
  }

  // Get single quiz by ID (with full questions)
  async getQuizById(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readonly");
      const store = transaction.objectStore("quizzes");
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(new Error("Quiz not found"));
        }
      };

      request.onerror = () => {
        reject(new Error("Failed to load quiz"));
      };
    });
  }

  // Delete quiz by ID
  async deleteQuiz(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readwrite");
      const store = transaction.objectStore("quizzes");
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error("Failed to delete quiz"));
      };
    });
  }

  // Update quiz name
  async updateQuizName(id, newName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readwrite");
      const store = transaction.objectStore("quizzes");
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const quiz = getRequest.result;
        if (quiz) {
          quiz.name = newName;
          const updateRequest = store.put(quiz);

          updateRequest.onsuccess = () => {
            resolve(quiz);
          };

          updateRequest.onerror = () => {
            reject(new Error("Failed to update quiz name"));
          };
        } else {
          reject(new Error("Quiz not found"));
        }
      };

      getRequest.onerror = () => {
        reject(new Error("Failed to load quiz for update"));
      };
    });
  }

  async updateQuizMistakeBank(id, updateMistakeBank, saveErrorMessage) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["quizzes"], "readwrite");
      const store = transaction.objectStore("quizzes");
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const quiz = getRequest.result;
        if (!quiz) {
          reject(new Error("Quiz not found"));
          return;
        }

        const shouldSave = updateMistakeBank(quiz) !== false;
        if (!shouldSave) {
          resolve(quiz);
          return;
        }

        const updateRequest = store.put(quiz);
        updateRequest.onsuccess = () => resolve(quiz);
        updateRequest.onerror = () => reject(new Error(saveErrorMessage));
      };

      getRequest.onerror = () => reject(
        new Error("Failed to load quiz mistake bank")
      );
    });
  }

  getMistakeKeys(quiz) {
    return Array.isArray(quiz.mistakeQuestionKeys)
      ? quiz.mistakeQuestionKeys
      : [];
  }

  // Get the persisted mistake bank for a saved quiz
  async getMistakeBank(quizId) {
    const quiz = await this.getQuizById(quizId);
    return {
      keys: this.getMistakeKeys(quiz),
      version: quiz.mistakeBankVersion || 0,
    };
  }

  // Seed a legacy quiz's mistake bank once without overwriting later progress
  async initializeMistakeBank(quizId, questionKeys) {
    return this.updateQuizMistakeBank(
      quizId,
      (quiz) => {
        if (quiz.mistakeBankVersion) {
          return false;
        }

        quiz.mistakeQuestionKeys = [...new Set(questionKeys)];
        quiz.mistakeBankVersion = 1;
      },
      "Failed to initialize mistake bank"
    ).then((quiz) => this.getMistakeKeys(quiz));
  }

  // Atomically add or remove a question from a saved quiz's mistake bank
  async setQuestionMistakeStatus(quizId, questionKey, needsReview) {
    return this.updateQuizMistakeBank(
      quizId,
      (quiz) => {
        const keys = new Set(this.getMistakeKeys(quiz));

        if (needsReview) {
          keys.add(questionKey);
        } else {
          keys.delete(questionKey);
        }

        quiz.mistakeQuestionKeys = [...keys];
        quiz.mistakeBankVersion = 1;
      },
      "Failed to update mistake bank"
    ).then((quiz) => quiz.mistakeQuestionKeys);
  }

  // Save test result
  async saveResult(resultData) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["results"], "readwrite");
      const store = transaction.objectStore("results");

      const result = {
        quizId: resultData.quizId || null,
        quizName: resultData.quizName,
        mode: resultData.mode,
        score: resultData.score,
        total: resultData.total,
        percent: parseFloat(resultData.percent),
        durationSeconds: resultData.durationSeconds,
        date: resultData.date || new Date().toISOString(),
        passed: parseFloat(resultData.percent) >= 72,
        details: resultData.details,
        questions: resultData.questions, // Save full questions for viewing later
        config: resultData.config,
      };

      const request = store.add(result);

      request.onsuccess = () => {
        resolve({ id: request.result, ...result });
      };

      request.onerror = () => {
        reject(new Error("Failed to save result"));
      };
    });
  }

  // Get all test results with optional filters
  async getAllResults(filters = {}) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["results"], "readonly");
      const store = transaction.objectStore("results");
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;

        // Apply filters
        if (filters.quizName) {
          results = results.filter((r) => r.quizName === filters.quizName);
        }

        if (filters.passed !== undefined) {
          results = results.filter((r) => r.passed === filters.passed);
        }

        if (filters.mode) {
          results = results.filter((r) => r.mode === filters.mode);
        }

        // Sort by date (newest first by default)
        results.sort((a, b) => new Date(b.date) - new Date(a.date));

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error("Failed to load results"));
      };
    });
  }

  // Get single result by ID
  async getResultById(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["results"], "readonly");
      const store = transaction.objectStore("results");
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(new Error("Result not found"));
        }
      };

      request.onerror = () => {
        reject(new Error("Failed to load result"));
      };
    });
  }

  // Delete result by ID
  async deleteResult(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["results"], "readwrite");
      const store = transaction.objectStore("results");
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error("Failed to delete result"));
      };
    });
  }

  // Check if database is supported
  static isSupported() {
    return "indexedDB" in window;
  }
}

// Export singleton instance
const quizDB = new QuizDB();
