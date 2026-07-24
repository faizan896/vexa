"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("vexa_theme");
    // respect the OS preference on first visit; saved choice wins thereafter
    const isDark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("vexa_theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
      <Icon name={dark ? "sun" : "moon"} size={14} /> {dark ? "Light" : "Dark"}
    </button>
  );
}
