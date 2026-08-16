import {
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const REPORTER_VERSION = 1;
const REPORTER_APP_NAME = "neurostars-game-reporter-v1";
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOPIC_MAX_LENGTH = 80;

export const GameReporterErrorCode = Object.freeze({
  INVALID_CONFIG: "INVALID_CONFIG",
  MISSING_STUDENT_ID: "MISSING_STUDENT_ID",
  INVALID_STUDENT_ID: "INVALID_STUDENT_ID",
  INVALID_GAME_ID: "INVALID_GAME_ID",
  INVALID_RESULT: "INVALID_RESULT",
  AUTH_FAILED: "AUTH_FAILED",
  SUBMISSION_FAILED: "SUBMISSION_FAILED"
});

export class GameReporterError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "GameReporterError";
    this.code = code;
  }
}

function readStudentId() {
  return new URLSearchParams(window.location.search).get("student")?.trim() || "";
}

function assertFirebaseConfig(firebaseConfig) {
  const requiredFields = ["apiKey", "authDomain", "projectId", "appId"];
  const valid = firebaseConfig && requiredFields.every((field) =>
    typeof firebaseConfig[field] === "string" && firebaseConfig[field].trim()
  );

  if (!valid) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_CONFIG,
      "Не передана корректная конфигурация Firebase."
    );
  }
}

function assertIdentifiers(studentId, gameId) {
  if (!studentId) {
    throw new GameReporterError(
      GameReporterErrorCode.MISSING_STUDENT_ID,
      "В ссылке отсутствует параметр student."
    );
  }

  if (!STUDENT_ID_PATTERN.test(studentId)) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_STUDENT_ID,
      "Параметр student имеет недопустимый формат."
    );
  }

  if (typeof gameId !== "string" || !GAME_ID_PATTERN.test(gameId)) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_GAME_ID,
      "gameId имеет недопустимый формат."
    );
  }
}

function requireWholeNumber(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_RESULT,
      `Поле ${field} должно быть целым числом от ${min} до ${max}.`
    );
  }
  return value;
}

function validateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_RESULT,
      "Результат игры должен быть объектом."
    );
  }

  const totalTasks = requireWholeNumber(result.totalTasks, "totalTasks", { min: 1 });
  const correctAnswers = requireWholeNumber(result.correctAnswers, "correctAnswers", { max: totalTasks });
  const errors = requireWholeNumber(result.errors, "errors");
  const durationSeconds = requireWholeNumber(result.durationSeconds, "durationSeconds");

  if (typeof result.completed !== "boolean") {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_RESULT,
      "Поле completed должно иметь значение true или false."
    );
  }

  const percentage = Math.round((correctAnswers / totalTasks) * 100);
  if (result.percentage !== undefined && Number(result.percentage) !== percentage) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_RESULT,
      `Некорректный percentage. Для этих данных ожидается ${percentage}.`
    );
  }

  let topic;
  if (result.topic !== undefined) {
    if (typeof result.topic !== "string") {
      throw new GameReporterError(
        GameReporterErrorCode.INVALID_RESULT,
        "Поле topic должно быть строкой."
      );
    }

    topic = result.topic.trim();
    if (!topic || topic.length > TOPIC_MAX_LENGTH) {
      throw new GameReporterError(
        GameReporterErrorCode.INVALID_RESULT,
        `Поле topic должно содержать от 1 до ${TOPIC_MAX_LENGTH} символов.`
      );
    }
  }

  return {
    correctAnswers,
    totalTasks,
    errors,
    percentage,
    durationSeconds,
    completed: result.completed,
    ...(topic === undefined ? {} : { topic })
  };
}

function getReporterApp(firebaseConfig) {
  const existingApp = getApps().find((app) => app.name === REPORTER_APP_NAME);
  return existingApp || initializeApp(firebaseConfig, REPORTER_APP_NAME);
}

function waitForInitialAuthState(auth) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function getAnonymousUser(auth) {
  try {
    const currentUser = auth.currentUser || await waitForInitialAuthState(auth);
    if (currentUser?.isAnonymous) return currentUser;

    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    throw new GameReporterError(
      GameReporterErrorCode.AUTH_FAILED,
      "Не удалось выполнить анонимный вход в Firebase.",
      error
    );
  }
}

/**
 * Создаёт один reporter для одной игровой попытки.
 * Повторные вызовы submitGameResult у этого экземпляра не создают новые документы.
 */
export function initializeGameReporter({ firebaseConfig, gameId, studentId = readStudentId() }) {
  assertFirebaseConfig(firebaseConfig);
  assertIdentifiers(studentId, gameId);

  const app = getReporterApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const anonymousUserPromise = getAnonymousUser(auth).then(
    (user) => ({ user, error: null }),
    (error) => ({ user: null, error })
  );
  let submissionPromise = null;

  async function performSubmission(result) {
    const validatedResult = validateResult(result);
    const authResult = await anonymousUserPromise;
    if (authResult.error) throw authResult.error;
    const user = authResult.user;
    const resultReference = doc(collection(db, "gameResults"));
    const documentId = resultReference.id;

    const resultData = {
      studentId,
      gameId,
      ...validatedResult,
      createdAt: serverTimestamp(),
      authUid: user.uid,
      resultVersion: REPORTER_VERSION
    };

    try {
      await setDoc(resultReference, resultData);
      return Object.freeze({
        ok: true,
        documentId,
        studentId,
        gameId,
        percentage: validatedResult.percentage,
        ...(validatedResult.topic === undefined ? {} : { topic: validatedResult.topic })
      });
    } catch (error) {
      throw new GameReporterError(
        GameReporterErrorCode.SUBMISSION_FAILED,
        "Не удалось сохранить результат в Firestore.",
        error
      );
    }
  }

  return Object.freeze({
    studentId,
    gameId,
    resultVersion: REPORTER_VERSION,
    submitGameResult(result) {
      if (!submissionPromise) {
        submissionPromise = performSubmission(result);
      }
      return submissionPromise;
    }
  });
}

export function getGameReporterErrorMessage(error) {
  if (error instanceof GameReporterError) return error.message;
  return "Произошла неизвестная ошибка при сохранении результата.";
}
