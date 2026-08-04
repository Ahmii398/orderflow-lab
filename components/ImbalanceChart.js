// components/ImbalanceChart.js
// Imbalance score history chart. Each reading is a bar colored the same
// way as the badges elsewhere on the page (green = bullish, red = bearish,
// gray = neutral), so a beginner can read the shape of recent positioning
// at a glance without needing to parse raw numbers first.
//
// This has to be a Client Component: Recharts measures its container in
// the browser (ResizeObserver via ResponsiveContainer), which isn't
// available during server rendering.
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

// Kept as plain hex (rather than Tailwind classes/CSS variables) because
// Recharts writes these straight onto SVG `fill` attributes, which don't
// reliably resolve CSS custom properties the way an element's `style` does.
// Keep these in sync with the --color-bullish/bearish/neutral tokens in
// app/globals.css.
const BULLISH = "#1F9D55";
const BEARISH = "#D64545";
const NEUTRAL_BAR = "#8A94A6";
const GRID_LINE = "#E2E6ED";
const AXIS_TEXT = "#6B7590";

function barColor(score) {
  if (typeof score !== "number") return NEUTRAL_BAR;
  if (score > 0.05) return BULLISH;
  if (score < -0.05) return BEARISH;
  return NEUTRAL_BAR;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ImbalanceChart({ data }) {
  const chartData = data.map((row) => ({
    time: formatTime(row.fetched_at),
    score: typeof row.imbalance_score === "number" ? row.imbalance_score : null,
    interpretation: row.interpretation,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            interval="preserveStartEnd"
            minTickGap={24}
            axisLine={{ stroke: GRID_LINE }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            width={40}
            domain={["auto", "auto"]}
            axisLine={{ stroke: GRID_LINE }}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke={NEUTRAL_BAR} strokeDasharray="4 4" />
          <Tooltip
            formatter={(value) => [typeof value === "number" ? value.toFixed(2) : "—", "Imbalance score"]}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{ borderRadius: 8, borderColor: GRID_LINE, fontSize: 12 }}
          />
          <Bar dataKey="score" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={barColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
