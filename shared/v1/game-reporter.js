const REPORTER_VERSION = 1;
const REPORTER_APP_NAME = "neurostars-game-reporter-v1";
const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTIVITY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/;
const FIREBASE_TOPIC_MAX_LENGTH = 80;
const API_TOPIC_MAX_LENGTH = 120;
const API_RESULT_LIMIT = 10_000;
const API_DURATION_LIMIT = 86_400;

export const GameReporterBackend = Object.freeze({
  FIREBASE: "firebase",
  API: "api"
});

export const GameReporterErrorCode = Object.freeze({
  INVALID_CONFIG: "INVALID_CONFIG",
  MISSING_ASSIGNMENT: "MISSING_ASSIGNMENT",
  INVALID_ASSIGNMENT: "INVALID_ASSIGNMENT",
  MISSING_ACTIVITY_ID: "MISSING_ACTIVITY_ID",
  INVALID_ACTIVITY_ID: "INVALID_ACTIVITY_ID",
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

function readAssignment() {
  return new URLSearchParams(window.location.search).get("assignment")?.trim() || "";
}

function readActivityId() {
  return new URLSearchParams(window.location.search).get("activity")?.trim() || "";
}

function assertBackend(backend) {
  if (!Object.values(GameReporterBackend).includes(backend)) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_CONFIG,
      "Неизвестный backend отправки результатов."
    );
  }
}

function normalizeApiBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error();
    return url.href.replace(/\/$/, "");
  } catch {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_CONFIG,
      "Не передан корректный адрес neurostars-api."
    );
  }
}

function assertApiIdentifiers(assignment, activityId) {
  if (!assignment) {
    throw new GameReporterError(
      GameReporterErrorCode.MISSING_ASSIGNMENT,
      "В ссылке отсутствует параметр assignment. Попросите преподавателя прислать новую ссылку."
    );
  }
  if (assignment.length < 40 || assignment.length > 100) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_ASSIGNMENT,
      "Параметр assignment имеет недопустимый формат. Попросите преподавателя прислать новую ссылку."
    );
  }
  if (!activityId) {
    throw new GameReporterError(
      GameReporterErrorCode.MISSING_ACTIVITY_ID,
      "В ссылке отсутствует параметр activity. Попросите преподавателя прислать новую ссылку."
    );
  }
  if (!ACTIVITY_ID_PATTERN.test(activityId)) {
    throw new GameReporterError(
      GameReporterErrorCode.INVALID_ACTIVITY_ID,
      "Параметр activity имеет недопустимый формат."
    );
  }
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

function validateResult(result, topicMaxLength = FIREBASE_TOPIC_MAX_LENGTH) {
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
    if (!topic || topic.length > topicMaxLength) {
      throw new GameReporterError(
        GameReporterErrorCode.INVALID_RESULT,
        `Поле topic должно содержать от 1 до ${topicMaxLength} символов.`
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

function getReporterApp(firebaseConfig, firebase) {
  const { getApps, initializeApp } = firebase;
  const existingApp = getApps().find((app) => app.name === REPORTER_APP_NAME);
  return existingApp || initializeApp(firebaseConfig, REPORTER_APP_NAME);
}

function waitForInitialAuthState(auth, onAuthStateChanged) {
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

async function getAnonymousUser(auth, firebase) {
  try {
    const currentUser = auth.currentUser || await waitForInitialAuthState(auth, firebase.onAuthStateChanged);
    if (currentUser?.isAnonymous) return currentUser;

    const credential = await firebase.signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    throw new GameReporterError(
      GameReporterErrorCode.AUTH_FAILED,
      "Не удалось выполнить анонимный вход в Firebase.",
      error
    );
  }
}

async function loadFirebase() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_AUTH_URL),
    import(FIREBASE_FIRESTORE_URL)
  ]);
  return { ...appModule, ...authModule, ...firestoreModule };
}

function getApiError(status, apiCode) {
  if (status === 404 || apiCode === "assignment_invalid_token") {
    return "Ссылка на задание недействительна. Попросите преподавателя прислать новую ссылку.";
  }
  if (status === 409 || apiCode === "assignment_activity_mismatch") {
    return "Ссылка выдана для другого задания. Откройте исходную ссылку преподавателя.";
  }
  if (status === 410 || ["assignment_expired", "assignment_exhausted", "assignment_revoked"].includes(apiCode)) {
    return "Срок действия ссылки закончился или все попытки использованы. Попросите преподавателя создать новую ссылку.";
  }
  if (status === 429) return "Слишком много попыток отправки. Подождите немного и попробуйте снова.";
  if (status >= 500) return "Сервис результатов временно недоступен. Попробуйте отправить результат позже.";
  return "Не удалось принять результат. Проверьте ссылку на задание и данные игры.";
}

async function readApiErrorCode(response) {
  try {
    const payload = await response.json();
    return typeof payload?.error === "string" ? payload.error : "";
  } catch {
    return "";
  }
}

/**
 * Создаёт один reporter для одной игровой попытки.
 * Повторные вызовы submitGameResult у этого экземпляра не создают новые документы.
 */
export function initializeGameReporter(options) {
  const {
    backend = GameReporterBackend.FIREBASE,
    firebaseConfig,
    gameId,
    apiBaseUrl,
    fetcher = globalThis.fetch
  } = options || {};
  assertBackend(backend);

  let studentId;
  let assignment;
  let activityId;
  let normalizedApiBaseUrl;
  let firebaseContextPromise;

  if (backend === GameReporterBackend.API) {
    assignment = options?.assignment ?? readAssignment();
    activityId = options?.activityId ?? readActivityId();
    assertApiIdentifiers(assignment, activityId);
    normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    if (typeof fetcher !== "function") {
      throw new GameReporterError(GameReporterErrorCode.INVALID_CONFIG, "Браузер не поддерживает отправку результата.");
    }
  } else {
    studentId = options?.studentId ?? readStudentId();
    assertFirebaseConfig(firebaseConfig);
    assertIdentifiers(studentId, gameId);
    firebaseContextPromise = loadFirebase().then(async (firebase) => {
      const app = getReporterApp(firebaseConfig, firebase);
      const auth = firebase.getAuth(app);
      const db = firebase.getFirestore(app);
      const user = await getAnonymousUser(auth, firebase);
      return { context: { firebase, db, user }, error: null };
    }).catch((error) => ({ context: null, error }));
  }

  let submissionPromise = null;

  async function submitToFirebase(result) {
    const validatedResult = validateResult(result, FIREBASE_TOPIC_MAX_LENGTH);
    const firebaseResult = await firebaseContextPromise;
    if (firebaseResult.error) throw firebaseResult.error;
    const { firebase, db, user } = firebaseResult.context;
    const resultReference = firebase.doc(firebase.collection(db, "gameResults"));
    const documentId = resultReference.id;

    const resultData = {
      studentId,
      gameId,
      ...validatedResult,
      createdAt: firebase.serverTimestamp(),
      authUid: user.uid,
      resultVersion: REPORTER_VERSION
    };

    try {
      await firebase.setDoc(resultReference, resultData);
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

  async function submitToApi(result) {
    const validatedResult = validateResult(result, API_TOPIC_MAX_LENGTH);
    requireWholeNumber(validatedResult.correctAnswers, "correctAnswers", { max: API_RESULT_LIMIT });
    requireWholeNumber(validatedResult.totalTasks, "totalTasks", { min: 1, max: API_RESULT_LIMIT });
    requireWholeNumber(validatedResult.errors, "errors", { max: API_RESULT_LIMIT });
    requireWholeNumber(validatedResult.durationSeconds, "durationSeconds", { max: API_DURATION_LIMIT });
    const resultId = crypto.randomUUID();
    let response;

    try {
      response = await fetcher(`${normalizedApiBaseUrl}/v1/game-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment,
          resultId,
          activityId,
          resultVersion: REPORTER_VERSION,
          ...validatedResult,
          details: {}
        })
      });
    } catch (error) {
      throw new GameReporterError(
        GameReporterErrorCode.SUBMISSION_FAILED,
        "Не удалось связаться с сервисом результатов. Проверьте интернет и попробуйте снова.",
        error
      );
    }

    if (!response.ok) {
      const apiCode = await readApiErrorCode(response);
      throw new GameReporterError(
        GameReporterErrorCode.SUBMISSION_FAILED,
        getApiError(response.status, apiCode)
      );
    }

    let responsePayload;
    try {
      responsePayload = await response.json();
    } catch {
      responsePayload = null;
    }
    if (!responsePayload?.success || typeof responsePayload.resultId !== "string") {
      throw new GameReporterError(
        GameReporterErrorCode.SUBMISSION_FAILED,
        "Сервис результатов вернул некорректный ответ. Попробуйте отправить результат позже."
      );
    }

    return Object.freeze({
      ok: true,
      backend,
      resultId: responsePayload.resultId,
      activityId,
      percentage: validatedResult.percentage,
      ...(validatedResult.topic === undefined ? {} : { topic: validatedResult.topic })
    });
  }

  return Object.freeze({
    backend,
    ...(backend === GameReporterBackend.FIREBASE ? { studentId, gameId } : { activityId }),
    resultVersion: REPORTER_VERSION,
    submitGameResult(result) {
      if (!submissionPromise) {
        submissionPromise = backend === GameReporterBackend.API
          ? submitToApi(result)
          : submitToFirebase(result);
      }
      return submissionPromise;
    }
  });
}

export function getGameReporterErrorMessage(error) {
  if (error instanceof GameReporterError) return error.message;
  return "Произошла неизвестная ошибка при сохранении результата.";
}
