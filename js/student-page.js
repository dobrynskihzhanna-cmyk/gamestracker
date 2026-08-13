import { requireAdmin, logoutAdmin } from "./auth.js";
import { getAllGames, getDataErrorMessage, getStudent, getStudentResults } from "./firestore.js";
import {
  formatDate,
  formatDuration,
  formatPercentage,
  getInitials,
  hideError,
  makeCell,
  setText,
  showError,
  sortResultsNewestFirst
} from "./ui.js";

const elements = {
  adminEmail: document.querySelector("#admin-email"),
  logout: document.querySelector("#logout-button"),
  error: document.querySelector("#page-error"),
  studentName: document.querySelector("#student-name"),
  studentId: document.querySelector("#student-id"),
  studentAvatar: document.querySelector("#student-avatar"),
  attemptsCount: document.querySelector("#attempts-count"),
  averageResult: document.querySelector("#average-result"),
  bestResult: document.querySelector("#best-result"),
  subtitle: document.querySelector("#history-subtitle"),
  filter: document.querySelector("#game-filter"),
  loading: document.querySelector("#history-loading"),
  empty: document.querySelector("#history-empty"),
  emptyText: document.querySelector("#history-empty-text"),
  tableWrap: document.querySelector("#history-table-wrap"),
  tableBody: document.querySelector("#history-table-body"),
  gameLinksList: document.querySelector("#game-links-list"),
  gameLinksEmpty: document.querySelector("#game-links-empty")
};

const studentId = new URLSearchParams(window.location.search).get("student")?.trim();
let results = [];
let gameNames = new Map();

function buildPersonalGameUrl(gameUrl) {
  try {
    const url = new URL(gameUrl);
    url.searchParams.set("student", studentId);
    return url.href;
  } catch {
    return null;
  }
}

async function copyGameLink(button, url) {
  const originalText = button.textContent;
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Скопировано";
  } catch {
    const input = button.closest(".game-link-card").querySelector("input");
    input.focus();
    input.select();
    button.textContent = "Выделено";
  }
  setTimeout(() => { button.textContent = originalText; }, 1800);
}

function renderGameLinks(games) {
  elements.gameLinksList.replaceChildren();
  const activeGames = games
    .filter((game) => game.active !== false && buildPersonalGameUrl(game.url))
    .sort((a, b) => String(a.title || a.gameId || a.id).localeCompare(String(b.title || b.gameId || b.id), "ru"));

  elements.gameLinksEmpty.hidden = activeGames.length > 0;
  activeGames.forEach((game) => {
    const title = game.title || game.gameId || game.id;
    const url = buildPersonalGameUrl(game.url);
    const card = document.createElement("article");
    card.className = "game-link-card";
    const heading = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = title;
    const id = document.createElement("small");
    id.textContent = game.gameId || game.id;
    heading.append(name, id);

    const controls = document.createElement("div");
    controls.className = "game-link-controls";
    const input = document.createElement("input");
    input.type = "text";
    input.value = url;
    input.readOnly = true;
    input.setAttribute("aria-label", `Персональная ссылка: ${title}`);
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button button--secondary";
    copyButton.textContent = "Скопировать";
    copyButton.addEventListener("click", () => copyGameLink(copyButton, url));
    const openLink = document.createElement("a");
    openLink.className = "button button--quiet";
    openLink.href = url;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "Открыть ↗";
    controls.append(input, copyButton, openLink);
    card.append(heading, controls);
    elements.gameLinksList.append(card);
  });
}

function updateStats() {
  const completedPercentages = results
    .filter((result) => result.completed === true)
    .map((result) => Number(result.percentage))
    .filter(Number.isFinite);
  const average = completedPercentages.length
    ? completedPercentages.reduce((sum, value) => sum + value, 0) / completedPercentages.length
    : null;
  const best = completedPercentages.length ? Math.max(...completedPercentages) : null;

  setText(elements.attemptsCount, String(results.length));
  setText(elements.averageResult, average === null ? "—" : formatPercentage(average));
  setText(elements.bestResult, best === null ? "—" : formatPercentage(best));
}

function renderHistory() {
  const selectedGame = elements.filter.value;
  const filtered = selectedGame
    ? results.filter((result) => result.gameId === selectedGame)
    : results;

  elements.tableBody.replaceChildren();
  elements.loading.hidden = true;
  setText(elements.subtitle, `${filtered.length} из ${results.length} попыток`);

  if (!filtered.length) {
    elements.tableWrap.hidden = true;
    elements.empty.hidden = false;
    elements.emptyText.textContent = results.length
      ? "Для выбранной игры попыток нет."
      : "Результаты появятся после подключения и прохождения игры.";
    return;
  }

  elements.empty.hidden = true;
  elements.tableWrap.hidden = false;

  filtered.forEach((result) => {
    const row = document.createElement("tr");
    row.append(makeCell(formatDate(result.createdAt)));
    row.append(makeCell(gameNames.get(result.gameId) || result.gameId || "Неизвестная игра"));

    const score = Number.isFinite(Number(result.correctAnswers)) && Number.isFinite(Number(result.totalTasks))
      ? `${result.correctAnswers} из ${result.totalTasks} · ${formatPercentage(result.percentage)}`
      : formatPercentage(result.percentage);
    const scoreCell = makeCell(score, "result-value");
    if (Number(result.percentage) >= 80) scoreCell.classList.add("result-value--good");
    row.append(scoreCell);
    row.append(makeCell(Number.isFinite(Number(result.errors)) ? String(result.errors) : "—"));
    row.append(makeCell(formatDuration(result.durationSeconds)));

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status ${result.completed ? "status--complete" : "status--incomplete"}`;
    badge.textContent = result.completed ? "Завершена" : "Не завершена";
    statusCell.append(badge);
    row.append(statusCell);
    elements.tableBody.append(row);
  });
}

function fillGameFilter(games) {
  games
    .sort((a, b) => String(a.title || a.gameId || a.id).localeCompare(String(b.title || b.gameId || b.id), "ru"))
    .forEach((game) => {
      const id = game.gameId || game.id;
      const title = game.title || id;
      gameNames.set(id, title);
      const option = document.createElement("option");
      option.value = id;
      option.textContent = title;
      elements.filter.append(option);
    });
}

async function loadStudentPage() {
  if (!studentId) {
    elements.loading.hidden = true;
    showError(elements.error, "В адресе страницы не указан studentId. Вернитесь к списку учеников.");
    return;
  }

  hideError(elements.error);
  try {
    const [student, studentResults, games] = await Promise.all([
      getStudent(studentId),
      getStudentResults(studentId),
      getAllGames()
    ]);

    if (!student) {
      elements.loading.hidden = true;
      showError(elements.error, `Ученик с ID ${studentId} не найден.`);
      setText(elements.studentName, "Ученик не найден");
      setText(elements.studentId, studentId);
      return;
    }

    const name = student.displayName || `Ученик ${studentId}`;
    setText(elements.studentName, name);
    setText(elements.studentId, `ID: ${student.studentId || student.id}`);
    setText(elements.studentAvatar, getInitials(name, studentId));
    document.title = `${name} — NeuroStars Games Tracker`;

    results = sortResultsNewestFirst(studentResults);
    fillGameFilter(games);
    renderGameLinks(games);
    updateStats();
    renderHistory();
    elements.filter.disabled = false;
  } catch (error) {
    console.error("Ошибка загрузки истории ученика:", error);
    elements.loading.hidden = true;
    showError(elements.error, getDataErrorMessage(error));
  }
}

elements.filter.addEventListener("change", renderHistory);
elements.logout.addEventListener("click", () => logoutAdmin().catch(console.error));

try {
  const user = await requireAdmin();
  if (user) {
    setText(elements.adminEmail, user.email || "Администратор");
    await loadStudentPage();
  }
} catch (error) {
  console.error("Ошибка проверки администратора:", error);
  elements.loading.hidden = true;
  showError(elements.error, getDataErrorMessage(error));
}
