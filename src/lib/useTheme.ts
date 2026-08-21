"use client";

import { useCallback, useEffect, useState } from "react";
import type { Theme } from "./theme";

const KEY = "crm-theme";

/**
 * Theme lưu ở localStorage, mặc định theo prefers-color-scheme.
 * Giá trị được ghi vào data-theme trên <html> (script inline trong layout đã set trước khi paint).
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setTheme(attr === "dark" ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode — bỏ qua */
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
