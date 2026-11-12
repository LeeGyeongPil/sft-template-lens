import { createContext, useContext } from "react";
import { LANG_STORAGE_KEY, messages, resolveWebLang, type Lang, type Messages } from "../i18n";

export interface LangValue {
  lang: Lang;
  m: Messages;
}

export const LangContext = createContext<LangValue>({ lang: "en", m: messages("en") });

/** Current language and its message table (use inside any component under <App>). */
export const useLang = (): LangValue => useContext(LangContext);

/** First run: browser language. Later runs: the saved choice (localStorage may be unavailable, then fall back quietly). */
export function initialLang(): Lang {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    /* storage blocked: behave like a first run */
  }
  return resolveWebLang(stored, window.navigator.language);
}

export function saveLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* storage blocked: the choice just is not remembered */
  }
}
