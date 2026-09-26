"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("crown-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("crown-theme-change", callback);
  };
}

function savedTheme(): "dark" | "light" {
  return localStorage.getItem("crown_theme") === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, savedTheme, () => "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("crown_theme", next);
    window.dispatchEvent(new Event("crown-theme-change"));
  }

  return (
    <button
      className="icon-button header-btn theme-toggle-btn"
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
      aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
