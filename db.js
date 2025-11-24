// IndexedDB Manager for Quiz Trainer
class QuizDB {
  constructor() {
    this.dbName = "QuizTrainerDB";
    this.version = 1;
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

  // Check if database is supported
  static isSupported() {
    return "indexedDB" in window;
  }
}

// Export singleton instance
const quizDB = new QuizDB();
