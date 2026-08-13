import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { requireFirebaseConfig } from "./firebase-config.js";

function mapDocument(snapshot) {
  return { ...snapshot.data(), id: snapshot.id };
}

export async function getAllStudents() {
  const { db } = requireFirebaseConfig();
  const snapshot = await getDocs(collection(db, "students"));
  return snapshot.docs.map(mapDocument);
}

export async function getAllGames() {
  const { db } = requireFirebaseConfig();
  const snapshot = await getDocs(collection(db, "games"));
  return snapshot.docs.map(mapDocument);
}

export async function getAllResults() {
  const { db } = requireFirebaseConfig();
  const snapshot = await getDocs(collection(db, "gameResults"));
  return snapshot.docs.map(mapDocument);
}

export async function getStudent(studentId) {
  const { db } = requireFirebaseConfig();
  const snapshot = await getDoc(doc(db, "students", studentId));
  return snapshot.exists() ? mapDocument(snapshot) : null;
}

export async function getStudentResults(studentId) {
  const { db } = requireFirebaseConfig();
  const resultsQuery = query(
    collection(db, "gameResults"),
    where("studentId", "==", studentId)
  );
  const snapshot = await getDocs(resultsQuery);
  return snapshot.docs.map(mapDocument);
}

export function getNextStudentId(students) {
  const highestNumber = students.reduce((highest, student) => {
    const id = String(student.studentId || student.id || "");
    const match = /^s(\d+)$/i.exec(id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `s${String(highestNumber + 1).padStart(3, "0")}`;
}

export async function createStudent({ studentId, displayName, notes = "" }) {
  const { db } = requireFirebaseConfig();
  const normalizedId = String(studentId || "").trim().toLowerCase();
  const normalizedName = String(displayName || "").trim();
  const normalizedNotes = String(notes || "").trim();

  if (!/^s\d{3,}$/.test(normalizedId)) {
    throw new Error("INVALID_STUDENT_ID");
  }
  if (!normalizedName || normalizedName.length > 100) {
    throw new Error("INVALID_STUDENT_NAME");
  }
  if (normalizedNotes.length > 500) {
    throw new Error("INVALID_STUDENT_NOTES");
  }

  const studentReference = doc(db, "students", normalizedId);
  await runTransaction(db, async (transaction) => {
    const existingStudent = await transaction.get(studentReference);
    if (existingStudent.exists()) throw new Error("STUDENT_ALREADY_EXISTS");

    const studentData = {
      studentId: normalizedId,
      displayName: normalizedName,
      active: true,
      createdAt: serverTimestamp()
    };
    if (normalizedNotes) studentData.notes = normalizedNotes;
    transaction.set(studentReference, studentData);
  });

  return normalizedId;
}

export async function updateGame({ documentId, gameId, title, url, active }) {
  const { db } = requireFirebaseConfig();
  const normalizedDocumentId = String(documentId || "").trim();
  const normalizedGameId = String(gameId || "").trim();
  const normalizedTitle = String(title || "").trim();
  const normalizedUrl = String(url || "").trim();

  if (!normalizedDocumentId || !normalizedGameId) throw new Error("INVALID_GAME_ID");
  if (!normalizedTitle || normalizedTitle.length > 100) throw new Error("INVALID_GAME_TITLE");
  if (normalizedUrl.length > 500) throw new Error("INVALID_GAME_URL");
  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("INVALID_GAME_URL");
  }

  const gameReference = doc(db, "games", normalizedDocumentId);
  await runTransaction(db, async (transaction) => {
    const currentGame = await transaction.get(gameReference);
    if (!currentGame.exists()) throw new Error("GAME_NOT_FOUND");
    const storedGameId = currentGame.data().gameId || currentGame.id;
    if (storedGameId !== normalizedGameId) throw new Error("GAME_ID_CHANGED");
    transaction.update(gameReference, {
      title: normalizedTitle,
      url: normalizedUrl,
      active: Boolean(active)
    });
  });
}

export function getDataErrorMessage(error) {
  if (error?.message === "FIREBASE_NOT_CONFIGURED") {
    return "Firebase ещё не подключён. Заполните js/firebase-config.js.";
  }

  if (error?.code === "permission-denied") {
    return "Firestore запретил чтение данных. Проверьте документ администратора и Firestore Rules.";
  }

  if (error?.code === "unavailable") {
    return "Firebase временно недоступен. Проверьте интернет и повторите попытку.";
  }

  return "Не удалось загрузить данные. Откройте консоль браузера для технических подробностей.";
}

export function getStudentCreateErrorMessage(error) {
  if (error?.message === "INVALID_STUDENT_ID") return "Не удалось сформировать технический ID ученика.";
  if (error?.message === "INVALID_STUDENT_NAME") return "Введите имя ученика длиной до 100 символов.";
  if (error?.message === "INVALID_STUDENT_NOTES") return "Заметка должна быть короче 500 символов.";
  if (error?.message === "STUDENT_ALREADY_EXISTS" || error?.code === "already-exists") {
    return "Этот ID уже занят. Закройте форму, обновите данные и попробуйте снова.";
  }
  if (error?.code === "permission-denied") {
    return "Firestore Rules пока не разрешают администратору добавлять учеников.";
  }
  if (error?.code === "unavailable") return "Firebase временно недоступен. Попробуйте ещё раз.";
  return "Не удалось добавить ученика. Проверьте соединение и настройки Firestore.";
}

export function getGameUpdateErrorMessage(error) {
  if (error?.message === "INVALID_GAME_ID" || error?.message === "GAME_ID_CHANGED") {
    return "Не удалось проверить постоянный gameId игры.";
  }
  if (error?.message === "INVALID_GAME_TITLE") return "Введите название игры длиной до 100 символов.";
  if (error?.message === "INVALID_GAME_URL") return "Укажите полный HTTPS-адрес игры, например https://example.github.io/game/.";
  if (error?.message === "GAME_NOT_FOUND" || error?.code === "not-found") return "Документ игры больше не существует. Обновите данные.";
  if (error?.code === "permission-denied") return "Firestore Rules пока не разрешают администратору изменять игры.";
  if (error?.code === "unavailable") return "Firebase временно недоступен. Попробуйте ещё раз.";
  return "Не удалось сохранить игру. Проверьте соединение и настройки Firestore.";
}
