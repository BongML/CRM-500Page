"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { chartGrid, chartTick, themeColors, type Theme } from "@/lib/theme";
import { int, pct, vShort } from "@/lib/format";
import type { SeriesPoint } from "@/lib/series";

/**
 * Một chỉ số theo mốc báo cáo — fill gradient accent. Mỗi điểm là một kỳ báo
 * cáo đã nhập, nên số điểm bằng số kỳ chứ không cố định.
 *
 * `unit` quyết định cách đọc trục và tooltip: "count" rút gọn kiểu 233K / 6,2 tr,
 * còn "pct" giữ nguyên con số kèm dấu %. Không rút gọn phần trăm — 4,1% mà hiện
 * "4K" thì sai hoàn toàn.
 */
export default function LineChart({
  points,
  theme,
  unit = "count",
  suffix = "views",
}: {
  points: SeriesPoint[];
  theme: Theme;
  unit?: "count" | "pct";
  suffix?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const accent = themeColors(theme)["--accent"];
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, accent + "44");
    grad.addColorStop(1, accent + "02");

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            data: points.map((p) => p.value),
            borderColor: accent,
            backgroundColor: grad,
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            // Ít mốc thì chấm điểm cho dễ đọc, nhiều mốc thì để đường liền.
            pointRadius: points.length <= 12 ? 3 : 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                unit === "pct"
                  ? pct(Number(c.parsed.y))
                  : `${int(Number(c.parsed.y))} ${suffix}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTick(theme), maxTicksLimit: 8, font: { size: 10 } },
          },
          y: {
            grid: { color: chartGrid(theme) },
            ticks: {
              color: chartTick(theme),
              font: { size: 10 },
              // Thang đo tự co theo độ lớn: "233K" hay "6,2 tr" tùy dữ liệu.
              callback: (v) => (unit === "pct" ? String(v) : vShort(Number(v))),
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [points, theme, unit, suffix]);

  return <canvas ref={ref} />;
}
