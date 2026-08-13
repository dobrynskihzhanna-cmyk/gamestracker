import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { requireFirebaseConfig } from "./firebase-config.js";

function mapDocument(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
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
