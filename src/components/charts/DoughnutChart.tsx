"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { themeColors, type Theme } from "@/lib/theme";
import type { Niche } from "@/lib/types";

/** Phân bổ page theo ngách — cutout 62%, click 1 slice để lọc dashboard. */
export default function DoughnutChart({
  niches,
  theme,
  onSlice,
}: {
  niches: Niche[];
  theme: Theme;
  onSlice: (nicheId: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // Giữ callback mới nhất mà không phải dựng lại chart mỗi lần render.
  const onSliceRef = useRef(onSlice);
  onSliceRef.current = onSlice;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: niches.map((n) => n.name),
        datasets: [
          {
            data: niches.map((n) => n.aggPages),
            backgroundColor: niches.map((n) => n.color),
            borderColor: themeColors(theme)["--surface"],
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => c.label + ": " + c.parsed + " page" } },
        },
        onClick: (_e, els) => {
          if (els.length) onSliceRef.current(niches[els[0].index].id);
        },
      },
    });

    return () => chart.destroy();
  }, [niches, theme]);

  return <canvas ref={ref} />;
}
