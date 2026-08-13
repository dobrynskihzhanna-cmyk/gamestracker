import { firebaseConfig } from "./firebase-config.js";
import {
  getGameReporterErrorMessage,
  initializeGameReporter
} from "../shared/v1/game-reporter.js";

const GAME_ID = "forest-trails";
const TEST_RESULT = Object.freeze({
  correctAnswers: 8,
  totalTasks: 10,
  errors: 2,
  percentage: 80,
  durationSeconds: 95,
  completed: true
});

const button = document.querySelector("#send-test-result");
const buttonLabel = button.querySelector(".button__label");
const buttonSpinner = button.querySelector(".spinner");
const status = document.querySelector("#test-status");
const studentValue = document.querySelector("#student-value");
let reporter = null;

function showStatus(message, type) {
  status.className = `notice notice--${type}`;
  status.textContent = message;
  status.hidden = false;
}

function setSending(isSending) {
  button.disabled = isSending || !reporter;
  buttonSpinner.hidden = !isSending;
  buttonLabel.textContent = isSending ? "Сохраняем результат…" : "Отправить тестовый результат";
}

try {
  reporter = initializeGameReporter({ firebaseConfig, gameId: GAME_ID });
  studentValue.textContent = reporter.studentId;
  button.disabled = false;
} catch (error) {
  console.error("Ошибка подготовки теста:", error);
  studentValue.textContent = "не указан";
  showStatus(getGameReporterErrorMessage(error), "error");
}

button.addEventListener("click", async () => {
  if (!reporter) return;

  setSending(true);
  try {
    const savedResult = await reporter.submitGameResult(TEST_RESULT);
    buttonLabel.textContent = "Результат уже отправлен";
    buttonSpinner.hidden = true;
    button.disabled = true;
    showStatus(
      `Готово! Результат ученика ${savedResult.studentId} сохранён. ID документа: ${savedResult.documentId}`,
      "success"
    );
  } catch (error) {
    console.error("Ошибка тестовой отправки:", error);
    buttonLabel.textContent = "Попытка отправки завершена";
    buttonSpinner.hidden = true;
    button.disabled = true;
    showStatus(`${getGameReporterErrorMessage(error)} Проверьте Firestore Rules и консоль браузера.`, "error");
  }
});
