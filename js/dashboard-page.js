import { requireAdmin, logoutAdmin } from "./auth.js";
import { getAllGames, getAllResults, getAllStudents, getDataErrorMessage } from "./firestore.js";
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
  refresh: document.querySelector("#refresh-button"),
  error: document.querySelector("#page-error"),
  studentsCount: document.querySelector("#students-count"),
  attemptsCount: document.querySelector("#attempts-count"),
  gamesCount: document.querySelector("#games-count"),
  averageResult: document.querySelector("#average-result"),
  subtitle: document.querySelector("#students-subtitle"),
  search: document.querySelector("#student-search"),
  loading: document.querySelector("#students-loading"),
  empty: document.querySelector("#students-empty"),
  emptyText: document.querySelector("#students-empty-text"),
  tableWrap: document.querySelector("#students-table-wrap"),
  tableBody: document.querySelector("#students-table-body")
};

let students = [];
let results = [];

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

function updateSummary(games) {
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
  elements.search.disabled = true;
  elements.loading.hidden = false;
  elements.empty.hidden = true;
  elements.tableWrap.hidden = true;

  try {
    [students, results] = await Promise.all([getAllStudents(), getAllResults()]);
    const games = await getAllGames();
    students.sort((a, b) =>
      String(a.displayName || a.studentId || a.id).localeCompare(
        String(b.displayName || b.studentId || b.id),
        "ru"
      )
    );
    updateSummary(games);
    setText(elements.subtitle, `${students.length} ${pluralizeStudent(students.length)}`);
    elements.emptyText.textContent = "Добавьте первый документ в коллекцию students.";
    renderStudents(students);
    elements.search.disabled = false;
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

elements.search.addEventListener("input", () => {
  const term = elements.search.value.trim().toLocaleLowerCase("ru");
  const filtered = students.filter((student) => {
    const searchable = `${student.displayName || ""} ${student.studentId || student.id}`.toLocaleLowerCase("ru");
    return searchable.includes(term);
  });
  elements.emptyText.textContent = "Попробуйте изменить поисковый запрос.";
  renderStudents(filtered);
});

elements.refresh.addEventListener("click", loadDashboard);
elements.logout.addEventListener("click", () => logoutAdmin().catch(console.error));

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
