export type Theme = "light" | "dark";

const THEME_KEY = "trupay_theme";

export const getTheme = (): Theme => {
  const saved = localStorage.getItem(THEME_KEY) as Theme;
  if (saved) return saved;
  // TruPay always starts in light mode until the user explicitly changes it
  // from Settings. Do not inherit the phone's system theme on first launch.
  return "light";
};

export const setTheme = (theme: Theme) => {
  localStorage.setItem(THEME_KEY, theme);
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
};

export const initializeTheme = () => {
  const theme = getTheme();
  setTheme(theme);
};
