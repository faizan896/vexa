"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("vexa_theme") === "dark";
    setDark(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "light";
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("vexa_theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
      {dark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
