"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { chartGrid, chartTick, type Theme } from "@/lib/theme";
import { int, vShort } from "@/lib/format";
import type { BarMetric, Niche } from "@/lib/types";

const METRIC_LABEL: Record<BarMetric, string> = {
  views: "Tổng views",
  rate: "Post interaction rate (%)",
  ppi: "Page Performance Index (%)",
};

/** So sánh ngách — bar ngang, mỗi bar màu ngách, barThickness 20. */
export default function BarChart({
  niches,
  metric,
  theme,
}: {
  niches: Niche[];
  metric: BarMetric;
  theme: Theme;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const val = (n: Niche) =>
      metric === "views" ? n.aggViews : metric === "rate" ? n.aggRate : n.aggPpi;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: niches.map((n) => n.name),
        datasets: [
          {
            label: METRIC_LABEL[metric],
            data: niches.map(val),
            backgroundColor: niches.map((n) => n.color),
            borderRadius: 5,
            barThickness: 20,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                metric === "views"
                  ? int(Number(c.parsed.x)) + " views"
                  : String(c.parsed.x).replace(".", ",") + "%",
            },
          },
        },
        scales: {
          x: {
            grid: { color: chartGrid(theme) },
            ticks: {
              color: chartTick(theme),
              font: { size: 10 },
              // Thang đo tự co theo độ lớn thay vì cố định đơn vị triệu.
              callback: (v) => (metric === "views" ? vShort(Number(v)) : String(v)),
            },
          },
          y: { grid: { display: false }, ticks: { color: chartTick(theme), font: { size: 11 } } },
        },
      },
    });

    return () => chart.destroy();
  }, [niches, metric, theme]);

  return <canvas ref={ref} />;
}
