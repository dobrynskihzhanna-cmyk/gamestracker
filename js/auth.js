import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { requireFirebaseConfig } from "./firebase-config.js";

export async function signInAdmin(email, password) {
  const { auth } = requireFirebaseConfig();
  const credentials = await signInWithEmailAndPassword(auth, email, password);

  try {
    const isAdmin = await hasAdminAccess(credentials.user.uid);
    if (!isAdmin) {
      await signOut(auth);
      throw new Error("ADMIN_ACCESS_DENIED");
    }

    return credentials.user;
  } catch (error) {
    if (auth.currentUser) {
      await signOut(auth).catch(() => undefined);
    }
    throw error;
  }
}

export async function hasAdminAccess(uid) {
  const { db } = requireFirebaseConfig();
  const adminSnapshot = await getDoc(doc(db, "admins", uid));
  return adminSnapshot.exists() && adminSnapshot.data()?.active !== false;
}

export function waitForAuthUser() {
  const { auth } = requireFirebaseConfig();

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

export async function requireAdmin() {
  const { auth } = requireFirebaseConfig();
  const user = await waitForAuthUser();

  if (!user || user.isAnonymous) {
    await signOut(auth).catch(() => undefined);
    window.location.replace("index.html");
    return null;
  }

  const isAdmin = await hasAdminAccess(user.uid);
  if (!isAdmin) {
    await signOut(auth).catch(() => undefined);
    window.location.replace("index.html?error=access-denied");
    return null;
  }

  return user;
}

export async function logoutAdmin() {
  const { auth } = requireFirebaseConfig();
  await signOut(auth);
  window.location.replace("index.html");
}

export function getAuthErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Неверный Email или пароль.",
    "auth/invalid-email": "Проверьте формат Email.",
    "auth/missing-password": "Введите пароль.",
    "auth/too-many-requests": "Слишком много попыток. Подождите и попробуйте снова.",
    "auth/network-request-failed": "Нет соединения с Firebase. Проверьте интернет.",
    "auth/user-disabled": "Этот аккаунт отключён в Firebase Authentication.",
    "permission-denied": "Firestore Rules не разрешили проверить права администратора."
  };

  if (error?.message === "ADMIN_ACCESS_DENIED") {
    return "Для этого аккаунта нет документа в коллекции admins.";
  }

  if (error?.message === "FIREBASE_NOT_CONFIGURED") {
    return "Firebase ещё не подключён. Заполните js/firebase-config.js.";
  }

  return messages[error?.code] || "Не удалось войти. Проверьте настройки Firebase и попробуйте снова.";
}
