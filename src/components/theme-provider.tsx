"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// In-window listeners — `storage` events only fire across tabs, so we
// notify our own subscribers when setTheme writes here.
const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage might be blocked; fall back to system
  }
  return "system";
}

function subscribeStoredTheme(cb: () => void) {
  themeListeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    themeListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribeSystemTheme(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function applyClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeStoredTheme,
    readStoredTheme,
    () => "system" as Theme
  );
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    readSystemTheme,
    () => "light" as ResolvedTheme
  );

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Sync the resolved theme to the DOM. The boot script handles the
  // very first paint; this keeps the class in sync after that.
  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    themeListeners.forEach((l) => l());
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Outside provider — return a no-op default so components don't crash.
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Blocking <script> that runs before React hydrates so the right theme
 * class is on <html> on the very first paint (prevents FOUC).
 *
 * Rendered in app/layout.tsx inside <head>. This is the *only* place we
 * intentionally inject a script tag; everywhere else we route through
 * the React provider above.
 */
export const THEME_BOOT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    var root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    root.style.colorScheme = resolved;
  } catch (_) {}
})();
`;
