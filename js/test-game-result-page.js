import { testGameReporterConfig } from "./reporter-config.js";
import { parseTestGameResultQuery } from "./test-game-result-query.js";
import {
  getGameReporterErrorMessage,
  initializeGameReporter
} from "../shared/v1/game-reporter.js";

const TEST_RESULT = Object.freeze({
  correctAnswers: 8,
  totalTasks: 10,
  errors: 2,
  percentage: 80,
  durationSeconds: 95,
  completed: true,
  topic: "Forest Trails test"
});

const button = document.querySelector("#send-test-result");
const buttonLabel = button.querySelector(".button__label");
const buttonSpinner = button.querySelector(".spinner");
const status = document.querySelector("#test-status");
const assignmentPresent = document.querySelector("#assignment-present");
const activityValue = document.querySelector("#activity-value");
const query = parseTestGameResultQuery(window.location.search);
let reporter = null;

assignmentPresent.textContent = query.assignment ? "yes" : "no";
activityValue.textContent = query.activityId || "не указано";

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
  reporter = initializeGameReporter({
    ...testGameReporterConfig,
    assignment: query.assignment,
    activityId: query.activityId
  });
  button.disabled = false;
} catch (error) {
  console.error("Ошибка подготовки теста:", { code: error?.code });
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
      `Готово! Результат сохранён в neurostars-api. ID результата: ${savedResult.resultId}`,
      "success"
    );
  } catch (error) {
    console.error("Ошибка тестовой отправки:", { code: error?.code });
    buttonLabel.textContent = "Попытка отправки завершена";
    buttonSpinner.hidden = true;
    button.disabled = true;
    showStatus(getGameReporterErrorMessage(error), "error");
  }
});
