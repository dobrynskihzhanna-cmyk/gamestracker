import { requireAdmin, logoutAdmin } from "./auth.js";
import {
  createLessonRecord,
  deleteLessonRecord,
  getAllGames,
  getDataErrorMessage,
  getLessonRecordErrorMessage,
  getLessonRecords,
  getStudent,
  getStudentResults,
  updateLessonRecord
} from "./firestore.js";
import { getGameName, getResultGameName } from "./result-display.js";
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
  overviewTab: document.querySelector("#overview-tab"),
  lessonsTab: document.querySelector("#lessons-tab"),
  gamesTab: document.querySelector("#student-games-tab"),
  overviewView: document.querySelector("#overview-view"),
  lessonsView: document.querySelector("#lessons-view"),
  gamesView: document.querySelector("#games-view"),
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
  gameLinksEmpty: document.querySelector("#game-links-empty"),
  lessonsSubtitle: document.querySelector("#lessons-subtitle"),
  lessonsLoading: document.querySelector("#lessons-loading"),
  lessonsEmpty: document.querySelector("#lessons-empty"),
  lessonsList: document.querySelector("#lessons-list"),
  lessonsError: document.querySelector("#lessons-error"),
  lessonsSuccess: document.querySelector("#lessons-success"),
  addLesson: document.querySelector("#add-lesson-button"),
  lessonDialog: document.querySelector("#lesson-dialog"),
  lessonForm: document.querySelector("#lesson-form"),
  lessonDialogTitle: document.querySelector("#lesson-dialog-title"),
  closeLessonDialog: document.querySelector("#close-lesson-dialog"),
  cancelLesson: document.querySelector("#cancel-lesson-button"),
  saveLesson: document.querySelector("#save-lesson-button"),
  lessonFormError: document.querySelector("#lesson-form-error"),
  lessonStudentName: document.querySelector("#lesson-student-name"),
  lessonStudentId: document.querySelector("#lesson-student-id"),
  lessonDate: document.querySelector("#lesson-date"),
  lessonContent: document.querySelector("#lesson-content"),
  lessonResult: document.querySelector("#lesson-result"),
  supportOptions: document.querySelector("#support-options"),
  supportCustom: document.querySelector("#support-custom"),
  lessonNextStep: document.querySelector("#lesson-next-step"),
  engagementOptions: document.querySelector("#engagement-options"),
  engagementCustom: document.querySelector("#engagement-custom"),
  independenceLevel: document.querySelector("#independence-level"),
  difficultyType: document.querySelector("#difficulty-type"),
  teacherObservation: document.querySelector("#teacher-observation"),
  privateTeacherNote: document.querySelector("#private-teacher-note"),
  lessonAdditional: document.querySelector(".lesson-additional"),
  lessonViewDialog: document.querySelector("#lesson-view-dialog"),
  lessonViewDate: document.querySelector("#lesson-view-date"),
  lessonViewContent: document.querySelector("#lesson-view-content"),
  closeLessonView: document.querySelector("#close-lesson-view"),
  editLesson: document.querySelector("#edit-lesson-button"),
  deleteLesson: document.querySelector("#delete-lesson-button")
};

const studentId = new URLSearchParams(window.location.search).get("student")?.trim();
let results = [];
let gameNames = new Map();
let lessons = [];
let currentStudentName = "";
let editingLessonId = null;
let openedLessonId = null;

function showStudentView() {
  const requestedView = window.location.hash.replace("#", "");
  const view = ["overview", "lessons", "games"].includes(requestedView) ? requestedView : "overview";
  const tabs = {
    overview: elements.overviewTab,
    lessons: elements.lessonsTab,
    games: elements.gamesTab
  };
  const views = {
    overview: elements.overviewView,
    lessons: elements.lessonsView,
    games: elements.gamesView
  };

  Object.entries(views).forEach(([name, element]) => {
    element.hidden = name !== view;
    tabs[name].classList.toggle("student-tab--active", name === view);
    tabs[name].toggleAttribute("aria-current", name === view);
  });
}

function getLocalDateValue() {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

function formatLessonDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function sortLessonsNewestFirst(records) {
  return [...records].sort((a, b) => {
    const dateDifference = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateDifference) return dateDifference;
    const aTime = a.created_at?.toMillis?.() || 0;
    const bTime = b.created_at?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

function shorten(value, length = 150) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function getChoiceValues(container, customInput) {
  const values = [...container.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value);
  const custom = customInput.value.trim();
  if (custom) values.push(custom);
  return [...new Set(values)];
}

function setChoiceValues(container, customInput, values = []) {
  const selected = new Set(Array.isArray(values) ? values : []);
  const knownValues = new Set();
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    knownValues.add(input.value);
    input.checked = selected.has(input.value);
  });
  customInput.value = [...selected].filter((value) => !knownValues.has(value)).join(", ");
}

function getLessonPayload() {
  return {
    student_id: studentId,
    date: elements.lessonDate.value,
    lesson_content: elements.lessonContent.value,
    lesson_result: elements.lessonResult.value,
    support_used: getChoiceValues(elements.supportOptions, elements.supportCustom),
    next_step: elements.lessonNextStep.value,
    engagement_state: getChoiceValues(elements.engagementOptions, elements.engagementCustom),
    independence_level: elements.independenceLevel.value,
    difficulty_type: elements.difficultyType.value,
    teacher_observation: elements.teacherObservation.value,
    private_teacher_note: elements.privateTeacherNote.value
  };
}

function resetLessonForm() {
  elements.lessonForm.reset();
  elements.lessonStudentName.value = currentStudentName;
  elements.lessonStudentId.value = studentId || "";
  elements.lessonDate.value = getLocalDateValue();
  elements.lessonAdditional.open = false;
  elements.lessonFormError.textContent = "";
}

function openNewLessonDialog() {
  editingLessonId = null;
  resetLessonForm();
  setText(elements.lessonDialogTitle, "Добавить занятие");
  elements.lessonDialog.showModal();
  elements.lessonContent.focus();
}

function openEditLessonDialog(record) {
  editingLessonId = record.id;
  resetLessonForm();
  setText(elements.lessonDialogTitle, "Редактировать занятие");
  elements.lessonDate.value = record.date || getLocalDateValue();
  elements.lessonContent.value = record.lesson_content || "";
  elements.lessonResult.value = record.lesson_result || "";
  setChoiceValues(elements.supportOptions, elements.supportCustom, record.support_used);
  elements.lessonNextStep.value = record.next_step || "";
  setChoiceValues(elements.engagementOptions, elements.engagementCustom, record.engagement_state);
  elements.independenceLevel.value = record.independence_level || "";
  elements.difficultyType.value = record.difficulty_type || "";
  elements.teacherObservation.value = record.teacher_observation || "";
  elements.privateTeacherNote.value = record.private_teacher_note || "";
  elements.lessonAdditional.open = Boolean(
    record.engagement_state?.length
      || record.independence_level
      || record.difficulty_type
      || record.teacher_observation
      || record.private_teacher_note
  );
  elements.lessonViewDialog.close();
  elements.lessonDialog.showModal();
  elements.lessonContent.focus();
}

function closeLessonDialog() {
  if (!elements.saveLesson.disabled) elements.lessonDialog.close();
}

function setLessonSaving(isSaving) {
  elements.saveLesson.disabled = isSaving;
  elements.closeLessonDialog.disabled = isSaving;
  elements.cancelLesson.disabled = isSaving;
  elements.saveLesson.querySelector(".button__label").textContent = isSaving ? "Сохраняем…" : "Сохранить";
  elements.saveLesson.querySelector(".spinner").hidden = !isSaving;
}

function showLessonsSuccess(message) {
  hideError(elements.lessonsError);
  setText(elements.lessonsSuccess, message);
  elements.lessonsSuccess.hidden = false;
  window.setTimeout(() => { elements.lessonsSuccess.hidden = true; }, 2800);
}

function createDetailBlock(label, value, { privateNote = false } = {}) {
  const text = Array.isArray(value) ? value.join(" · ") : String(value || "").trim();
  if (!text) return null;
  const section = document.createElement("section");
  section.className = `lesson-detail${privateNote ? " lesson-detail--private" : ""}`;
  const title = document.createElement("h3");
  title.textContent = `${privateNote ? "🔒 " : ""}${label}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  section.append(title, paragraph);
  return section;
}

function openLessonDetails(record) {
  openedLessonId = record.id;
  setText(elements.lessonViewDate, formatLessonDate(record.date));
  elements.lessonViewContent.replaceChildren();
  [
    createDetailBlock("Что делали", record.lesson_content),
    createDetailBlock("Что получилось / что пока трудно", record.lesson_result),
    createDetailBlock("Что помогло", record.support_used),
    createDetailBlock("Что взять на следующий урок", record.next_step),
    createDetailBlock("Состояние / включённость", record.engagement_state),
    createDetailBlock("Уровень самостоятельности", record.independence_level),
    createDetailBlock("Тип трудности", record.difficulty_type),
    createDetailBlock("Важное наблюдение об ученике", record.teacher_observation),
    createDetailBlock("Личная заметка педагога", record.private_teacher_note, { privateNote: true })
  ].filter(Boolean).forEach((block) => elements.lessonViewContent.append(block));
  elements.lessonViewDialog.showModal();
}

function renderLessons() {
  elements.lessonsLoading.hidden = true;
  elements.lessonsList.replaceChildren();
  elements.lessonsEmpty.hidden = lessons.length > 0;
  setText(elements.lessonsSubtitle, `${lessons.length} ${lessons.length === 1 ? "занятие" : "занятий"}`);

  lessons.forEach((record) => {
    const card = document.createElement("article");
    card.className = "lesson-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Открыть занятие за ${formatLessonDate(record.date)}`);

    const date = document.createElement("time");
    date.className = "lesson-card__date";
    date.dateTime = record.date || "";
    date.textContent = formatLessonDate(record.date);
    const content = document.createElement("h3");
    content.textContent = shorten(record.lesson_content) || "Без описания";
    const result = document.createElement("p");
    result.className = "lesson-card__result";
    result.textContent = shorten(record.lesson_result);
    const next = document.createElement("p");
    next.className = "lesson-card__next";
    const nextLabel = document.createElement("strong");
    nextLabel.textContent = "Следующий шаг: ";
    next.append(nextLabel, shorten(record.next_step));

    const actions = document.createElement("div");
    actions.className = "lesson-card__actions";
    const openButton = document.createElement("button");
    openButton.className = "button button--quiet button--compact";
    openButton.type = "button";
    openButton.textContent = "Открыть";
    const editButton = document.createElement("button");
    editButton.className = "button button--secondary button--compact";
    editButton.type = "button";
    editButton.textContent = "Редактировать";
    const deleteButton = document.createElement("button");
    deleteButton.className = "button button--danger button--compact";
    deleteButton.type = "button";
    deleteButton.textContent = "Удалить";

    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openLessonDetails(record);
    });
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditLessonDialog(record);
    });
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleDeleteLesson(record);
    });
    actions.append(openButton, editButton, deleteButton);
    card.append(date, content, result, next, actions);
    card.addEventListener("click", () => openLessonDetails(record));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLessonDetails(record);
      }
    });
    elements.lessonsList.append(card);
  });
}

async function loadLessons() {
  elements.lessonsLoading.hidden = false;
  hideError(elements.lessonsError);
  try {
    lessons = sortLessonsNewestFirst(await getLessonRecords(studentId));
    renderLessons();
  } catch (error) {
    console.error("Ошибка загрузки занятий:", error);
    elements.lessonsLoading.hidden = true;
    elements.lessonsEmpty.hidden = true;
    showError(elements.lessonsError, getLessonRecordErrorMessage(error));
  }
}

async function handleSaveLesson(event) {
  event.preventDefault();
  elements.lessonFormError.textContent = "";
  if (!elements.lessonForm.reportValidity()) return;

  const payload = getLessonPayload();
  if (!payload.support_used.length) {
    elements.lessonFormError.textContent = "Выберите хотя бы один вариант в блоке «Что помогло».";
    elements.supportOptions.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  setLessonSaving(true);
  try {
    const wasEditing = Boolean(editingLessonId);
    if (wasEditing) {
      await updateLessonRecord(editingLessonId, payload);
    } else {
      await createLessonRecord(payload);
    }
    elements.lessonDialog.close();
    await loadLessons();
    showLessonsSuccess(wasEditing ? "Занятие обновлено." : "Занятие сохранено.");
  } catch (error) {
    console.error("Ошибка сохранения занятия:", error);
    elements.lessonFormError.textContent = getLessonRecordErrorMessage(error);
  } finally {
    setLessonSaving(false);
  }
}

async function handleDeleteLesson(record) {
  const confirmed = window.confirm(`Удалить занятие за ${formatLessonDate(record.date)}? Это действие нельзя отменить.`);
  if (!confirmed) return;

  try {
    await deleteLessonRecord(record.id);
    if (elements.lessonViewDialog.open) elements.lessonViewDialog.close();
    await loadLessons();
    showLessonsSuccess("Занятие удалено.");
  } catch (error) {
    console.error("Ошибка удаления занятия:", error);
    showError(elements.lessonsError, getLessonRecordErrorMessage(error));
  }
}

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
    const gameId = game.gameId || game.id;
    const title = getGameName(gameId, game.title, gameNames);
    const url = buildPersonalGameUrl(game.url);
    const card = document.createElement("article");
    card.className = "game-link-card";
    const heading = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = title;
    const id = document.createElement("small");
    id.textContent = gameId;
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
    row.append(makeCell(getResultGameName(result, gameNames)));

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
      const title = getGameName(id, game.title, gameNames);
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
    currentStudentName = name;
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
    elements.addLesson.disabled = false;
    await loadLessons();
  } catch (error) {
    console.error("Ошибка загрузки истории ученика:", error);
    elements.loading.hidden = true;
    showError(elements.error, getDataErrorMessage(error));
  }
}

window.addEventListener("hashchange", showStudentView);
elements.filter.addEventListener("change", renderHistory);
elements.addLesson.addEventListener("click", openNewLessonDialog);
elements.lessonForm.addEventListener("submit", handleSaveLesson);
elements.closeLessonDialog.addEventListener("click", closeLessonDialog);
elements.cancelLesson.addEventListener("click", closeLessonDialog);
elements.lessonDialog.addEventListener("click", (event) => {
  if (event.target === elements.lessonDialog) closeLessonDialog();
});
elements.lessonDialog.addEventListener("cancel", (event) => {
  if (elements.saveLesson.disabled) event.preventDefault();
});
elements.closeLessonView.addEventListener("click", () => elements.lessonViewDialog.close());
elements.lessonViewDialog.addEventListener("click", (event) => {
  if (event.target === elements.lessonViewDialog) elements.lessonViewDialog.close();
});
elements.editLesson.addEventListener("click", () => {
  const record = lessons.find((lesson) => lesson.id === openedLessonId);
  if (record) openEditLessonDialog(record);
});
elements.deleteLesson.addEventListener("click", async () => {
  const record = lessons.find((lesson) => lesson.id === openedLessonId);
  if (record) await handleDeleteLesson(record);
});
elements.logout.addEventListener("click", () => logoutAdmin().catch(console.error));

showStudentView();

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
