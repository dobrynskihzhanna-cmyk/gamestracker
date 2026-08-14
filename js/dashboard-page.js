import { requireAdmin, logoutAdmin } from "./auth.js";
import {
  createStudent,
  getAllGames,
  getAllResults,
  getAllStudents,
  getDataErrorMessage,
  getNextStudentId,
  getStudentCreateErrorMessage,
  getGameUpdateErrorMessage,
  updateGame
} from "./firestore.js";
import {
  formatDate,
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
  studentsTab: document.querySelector("#students-tab"),
  gamesTab: document.querySelector("#games-tab"),
  pageEyebrow: document.querySelector("#page-eyebrow"),
  pageTitle: document.querySelector("#page-title"),
  pageDescription: document.querySelector("#page-description"),
  refresh: document.querySelector("#refresh-button"),
  addStudent: document.querySelector("#add-student-button"),
  error: document.querySelector("#page-error"),
  summary: document.querySelector("#summary"),
  studentsPanel: document.querySelector("#students-panel"),
  gamesPanel: document.querySelector("#games-panel"),
  studentsCount: document.querySelector("#students-count"),
  attemptsCount: document.querySelector("#attempts-count"),
  gamesCount: document.querySelector("#games-count"),
  averageResult: document.querySelector("#average-result"),
  gamesSubtitle: document.querySelector("#games-subtitle"),
  gamesList: document.querySelector("#games-list"),
  gamesEmpty: document.querySelector("#games-empty"),
  subtitle: document.querySelector("#students-subtitle"),
  search: document.querySelector("#student-search"),
  loading: document.querySelector("#students-loading"),
  empty: document.querySelector("#students-empty"),
  emptyText: document.querySelector("#students-empty-text"),
  tableWrap: document.querySelector("#students-table-wrap"),
  tableBody: document.querySelector("#students-table-body"),
  addDialog: document.querySelector("#add-student-dialog"),
  addForm: document.querySelector("#add-student-form"),
  closeDialog: document.querySelector("#close-student-dialog"),
  cancelDialog: document.querySelector("#cancel-student-button"),
  studentName: document.querySelector("#new-student-name"),
  studentId: document.querySelector("#new-student-id"),
  studentNotes: document.querySelector("#new-student-notes"),
  addError: document.querySelector("#add-student-error"),
  saveStudent: document.querySelector("#save-student-button"),
  gameDialog: document.querySelector("#edit-game-dialog"),
  gameForm: document.querySelector("#edit-game-form"),
  closeGameDialog: document.querySelector("#close-game-dialog"),
  cancelGameDialog: document.querySelector("#cancel-game-button"),
  gameTitle: document.querySelector("#edit-game-title"),
  gameId: document.querySelector("#edit-game-id"),
  gameUrl: document.querySelector("#edit-game-url"),
  gameActive: document.querySelector("#edit-game-active"),
  gameError: document.querySelector("#edit-game-error"),
  saveGame: document.querySelector("#save-game-button")
};

let students = [];
let results = [];
let games = [];
let editingGameDocumentId = null;

function showDashboardView() {
  const showGames = window.location.hash === "#games";

  elements.summary.hidden = showGames;
  elements.studentsPanel.hidden = showGames;
  elements.gamesPanel.hidden = !showGames;
  elements.addStudent.hidden = showGames;

  elements.studentsTab.classList.toggle("admin-nav__link--active", !showGames);
  elements.gamesTab.classList.toggle("admin-nav__link--active", showGames);
  elements.studentsTab.toggleAttribute("aria-current", !showGames);
  elements.gamesTab.toggleAttribute("aria-current", showGames);

  setText(elements.pageEyebrow, showGames ? "Управление играми" : "Панель администратора");
  setText(elements.pageTitle, showGames ? "Игры" : "Ученики");
  setText(
    elements.pageDescription,
    showGames
      ? "Подключённые обучающие игры и их настройки."
      : "Краткая сводка по всем игровым попыткам."
  );
  document.title = `${showGames ? "Игры" : "Ученики"} — NeuroStars Games Tracker`;
}

function openEditGameDialog(game) {
  editingGameDocumentId = game.id;
  elements.gameTitle.value = game.title || game.gameId || game.id;
  elements.gameId.value = game.gameId || game.id;
  elements.gameUrl.value = game.url || "";
  elements.gameActive.checked = game.active !== false;
  elements.gameError.textContent = "";
  elements.gameDialog.showModal();
  elements.gameTitle.focus();
}

function closeEditGameDialog() {
  if (!elements.saveGame.disabled) elements.gameDialog.close();
}

function setGameSaving(isSaving) {
  elements.saveGame.disabled = isSaving;
  elements.closeGameDialog.disabled = isSaving;
  elements.cancelGameDialog.disabled = isSaving;
  elements.gameTitle.disabled = isSaving;
  elements.gameUrl.disabled = isSaving;
  elements.gameActive.disabled = isSaving;
  elements.saveGame.querySelector(".button__label").textContent = isSaving ? "Сохраняем…" : "Сохранить";
  elements.saveGame.querySelector(".spinner").hidden = !isSaving;
}

async function handleEditGame(event) {
  event.preventDefault();
  elements.gameError.textContent = "";
  if (!elements.gameForm.reportValidity()) return;

  setGameSaving(true);
  try {
    await updateGame({
      documentId: editingGameDocumentId,
      gameId: elements.gameId.value,
      title: elements.gameTitle.value,
      url: elements.gameUrl.value,
      active: elements.gameActive.checked
    });
    elements.gameDialog.close();
    await loadDashboard();
  } catch (error) {
    console.error("Ошибка обновления игры:", error);
    elements.gameError.textContent = getGameUpdateErrorMessage(error);
  } finally {
    setGameSaving(false);
  }
}

function getValidGameUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function renderGames() {
  elements.gamesList.replaceChildren();
  elements.gamesEmpty.hidden = games.length > 0;
  setText(elements.gamesSubtitle, `${games.length} ${games.length === 1 ? "игра" : "игр"}`);

  games.forEach((game) => {
    const gameId = game.gameId || game.id;
    const title = game.title || gameId;
    const url = getValidGameUrl(game.url);
    const row = document.createElement("article");
    row.className = "game-list-row";

    const identity = document.createElement("div");
    identity.className = "game-list-row__identity";
    const name = document.createElement("strong");
    name.textContent = title;
    const id = document.createElement("small");
    id.textContent = gameId;
    identity.append(name, id);

    const address = document.createElement("div");
    address.className = `game-list-row__url${url ? "" : " game-list-row__url--missing"}`;
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = url;
      address.append(link);
    } else {
      address.textContent = "Адрес не указан";
    }

    const status = document.createElement("span");
    status.className = `status ${game.active !== false ? "status--complete" : "status--incomplete"}`;
    status.textContent = game.active !== false ? "Активна" : "Отключена";
    const actions = document.createElement("div");
    actions.className = "game-list-row__actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button--secondary button--compact";
    editButton.textContent = "Изменить";
    editButton.addEventListener("click", () => openEditGameDialog(game));
    actions.append(status, editButton);
    row.append(identity, address, actions);
    elements.gamesList.append(row);
  });
}

function renderStudents(list) {
  elements.tableBody.replaceChildren();
  elements.loading.hidden = true;

  if (!list.length) {
    elements.tableWrap.hidden = true;
    elements.empty.hidden = false;
    return;
  }

  elements.empty.hidden = true;
  elements.tableWrap.hidden = false;

  list.forEach((student) => {
    const studentId = student.studentId || student.id;
    const name = student.displayName || `Ученик ${studentId}`;
    const attempts = sortResultsNewestFirst(results.filter((result) => result.studentId === studentId));
    const lastAttempt = attempts[0];
    const row = document.createElement("tr");

    const studentCell = document.createElement("td");
    const cellContent = document.createElement("div");
    cellContent.className = "student-cell";
    const avatar = document.createElement("span");
    avatar.className = "student-cell__avatar";
    avatar.textContent = getInitials(name, studentId);
    const identity = document.createElement("span");
    const identityName = document.createElement("strong");
    identityName.textContent = name;
    const identityId = document.createElement("small");
    identityId.textContent = studentId;
    identity.append(identityName, identityId);
    cellContent.append(avatar, identity);
    studentCell.append(cellContent);
    row.append(studentCell);
    row.append(makeCell(String(attempts.length)));

    const resultCell = makeCell(lastAttempt ? formatPercentage(lastAttempt.percentage) : "Нет данных");
    if (lastAttempt) resultCell.className = "result-value";
    row.append(resultCell);
    row.append(makeCell(lastAttempt ? formatDate(lastAttempt.createdAt) : "—"));

    const actionCell = document.createElement("td");
    const link = document.createElement("a");
    link.className = "student-link";
    link.href = `student.html?student=${encodeURIComponent(studentId)}`;
    link.textContent = "Открыть →";
    link.setAttribute("aria-label", `Открыть историю ученика ${name}`);
    actionCell.append(link);
    row.append(actionCell);
    elements.tableBody.append(row);
  });
}

function updateSummary() {
  const completedResults = results.filter((result) => result.completed === true && Number.isFinite(Number(result.percentage)));
  const average = completedResults.length
    ? completedResults.reduce((sum, result) => sum + Number(result.percentage), 0) / completedResults.length
    : null;

  setText(elements.studentsCount, String(students.length));
  setText(elements.attemptsCount, String(results.length));
  setText(elements.gamesCount, String(games.filter((game) => game.active !== false).length));
  setText(elements.averageResult, average === null ? "—" : formatPercentage(average));
}

async function loadDashboard() {
  hideError(elements.error);
  elements.refresh.disabled = true;
  elements.addStudent.disabled = true;
  elements.search.disabled = true;
  elements.loading.hidden = false;
  elements.empty.hidden = true;
  elements.tableWrap.hidden = true;

  try {
    [students, results, games] = await Promise.all([getAllStudents(), getAllResults(), getAllGames()]);
    games.sort((a, b) => String(a.title || a.gameId || a.id).localeCompare(String(b.title || b.gameId || b.id), "ru"));
    students.sort((a, b) =>
      String(a.displayName || a.studentId || a.id).localeCompare(
        String(b.displayName || b.studentId || b.id),
        "ru"
      )
    );
    updateSummary();
    renderGames();
    setText(elements.subtitle, `${students.length} ${pluralizeStudent(students.length)}`);
    elements.emptyText.textContent = "Добавьте первый документ в коллекцию students.";
    renderStudents(students);
    elements.search.disabled = false;
    elements.addStudent.disabled = false;
  } catch (error) {
    console.error("Ошибка загрузки панели:", error);
    elements.loading.hidden = true;
    showError(elements.error, getDataErrorMessage(error));
  } finally {
    elements.refresh.disabled = false;
  }
}

function pluralizeStudent(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "учеников";
  if (last === 1) return "ученик";
  if (last >= 2 && last <= 4) return "ученика";
  return "учеников";
}

function openAddStudentDialog() {
  elements.addForm.reset();
  elements.studentId.value = getNextStudentId(students);
  elements.addError.textContent = "";
  elements.addDialog.showModal();
  elements.studentName.focus();
}

function closeAddStudentDialog() {
  if (!elements.saveStudent.disabled) elements.addDialog.close();
}

function setStudentSaving(isSaving) {
  elements.saveStudent.disabled = isSaving;
  elements.closeDialog.disabled = isSaving;
  elements.cancelDialog.disabled = isSaving;
  elements.studentName.disabled = isSaving;
  elements.studentNotes.disabled = isSaving;
  elements.saveStudent.querySelector(".button__label").textContent = isSaving ? "Добавляем…" : "Добавить";
  elements.saveStudent.querySelector(".spinner").hidden = !isSaving;
}

async function handleAddStudent(event) {
  event.preventDefault();
  elements.addError.textContent = "";
  if (!elements.addForm.reportValidity()) return;

  setStudentSaving(true);
  try {
    const createdId = await createStudent({
      studentId: elements.studentId.value,
      displayName: elements.studentName.value,
      notes: elements.studentNotes.value
    });
    elements.addDialog.close();
    await loadDashboard();
    window.location.href = `student.html?student=${encodeURIComponent(createdId)}`;
  } catch (error) {
    console.error("Ошибка создания ученика:", error);
    elements.addError.textContent = getStudentCreateErrorMessage(error);
  } finally {
    setStudentSaving(false);
  }
}

elements.search.addEventListener("input", () => {
  const term = elements.search.value.trim().toLocaleLowerCase("ru");
  const filtered = students.filter((student) => {
    const searchable = `${student.displayName || ""} ${student.studentId || student.id}`.toLocaleLowerCase("ru");
    return searchable.includes(term);
  });
  elements.emptyText.textContent = "Попробуйте изменить поисковый запрос.";
  renderStudents(filtered);
});

window.addEventListener("hashchange", showDashboardView);
elements.refresh.addEventListener("click", loadDashboard);
elements.addStudent.addEventListener("click", openAddStudentDialog);
elements.addForm.addEventListener("submit", handleAddStudent);
elements.closeDialog.addEventListener("click", closeAddStudentDialog);
elements.cancelDialog.addEventListener("click", closeAddStudentDialog);
elements.addDialog.addEventListener("click", (event) => {
  if (event.target === elements.addDialog) closeAddStudentDialog();
});
elements.addDialog.addEventListener("cancel", (event) => {
  if (elements.saveStudent.disabled) event.preventDefault();
});
elements.gameForm.addEventListener("submit", handleEditGame);
elements.closeGameDialog.addEventListener("click", closeEditGameDialog);
elements.cancelGameDialog.addEventListener("click", closeEditGameDialog);
elements.gameDialog.addEventListener("click", (event) => {
  if (event.target === elements.gameDialog) closeEditGameDialog();
});
elements.gameDialog.addEventListener("cancel", (event) => {
  if (elements.saveGame.disabled) event.preventDefault();
});
elements.logout.addEventListener("click", () => logoutAdmin().catch(console.error));

showDashboardView();

try {
  const user = await requireAdmin();
  if (user) {
    setText(elements.adminEmail, user.email || "Администратор");
    await loadDashboard();
  }
} catch (error) {
  console.error("Ошибка проверки администратора:", error);
  elements.loading.hidden = true;
  showError(elements.error, getDataErrorMessage(error));
}
