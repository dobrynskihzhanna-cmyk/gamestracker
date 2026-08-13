export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "—";

  const rounded = Math.round(total);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes > 0 ? `${minutes} мин ${remainder} сек` : `${remainder} сек`;
}

export function formatPercentage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : "—";
}

export function getInitials(name, fallback = "?") {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return String(fallback).slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function setText(element, value) {
  if (element) element.textContent = value;
}

export function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

export function hideError(element) {
  if (!element) return;
  element.textContent = "";
  element.hidden = true;
}

export function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

export function sortResultsNewestFirst(results) {
  return [...results].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });
}
