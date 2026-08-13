import { isFirebaseConfigured, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getAuthErrorMessage, hasAdminAccess, signInAdmin } from "./auth.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#login-button");
const buttonLabel = loginButton.querySelector(".button__label");
const buttonSpinner = loginButton.querySelector(".spinner");
const errorElement = document.querySelector("#login-error");
const configNotice = document.querySelector("#config-notice");
const togglePasswordButton = document.querySelector("#toggle-password");

function setLoading(isLoading) {
  loginButton.disabled = isLoading || !isFirebaseConfigured;
  emailInput.disabled = isLoading || !isFirebaseConfigured;
  passwordInput.disabled = isLoading || !isFirebaseConfigured;
  buttonLabel.textContent = isLoading ? "Проверяем доступ…" : "Войти";
  buttonSpinner.hidden = !isLoading;
}

function showLoginError(message) {
  errorElement.textContent = message;
}

togglePasswordButton.addEventListener("click", () => {
  const showPassword = passwordInput.type === "password";
  passwordInput.type = showPassword ? "text" : "password";
  togglePasswordButton.setAttribute("aria-label", showPassword ? "Скрыть пароль" : "Показать пароль");
  togglePasswordButton.title = showPassword ? "Скрыть пароль" : "Показать пароль";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showLoginError("");

  if (!form.reportValidity()) return;

  setLoading(true);
  try {
    await signInAdmin(emailInput.value.trim(), passwordInput.value);
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Ошибка входа администратора:", error);
    showLoginError(getAuthErrorMessage(error));
    setLoading(false);
  }
});

if (!isFirebaseConfigured) {
  configNotice.hidden = false;
  setLoading(false);
} else {
  const accessError = new URLSearchParams(window.location.search).get("error");
  if (accessError === "access-denied") {
    showLoginError("У этого аккаунта нет доступа к административной части.");
  }

  setLoading(true);
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    unsubscribe();
    if (!user || user.isAnonymous) {
      if (user?.isAnonymous) await signOut(auth).catch(() => undefined);
      setLoading(false);
      return;
    }

    try {
      if (await hasAdminAccess(user.uid)) {
        window.location.replace("dashboard.html");
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error("Ошибка проверки сессии:", error);
    }

    setLoading(false);
  });
}
