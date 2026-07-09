import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packages = [
  { name: "@mhrj/whatsapp-mcp", color: "#22c55e" },
  { name: "@mhrj/mcp-agent-loop", color: "#38bdf8" },
  { name: "@mhrj/team-project-memory-skill", color: "#f59e0b" },
  { name: "@mhrj/contextengine-mcp", color: "#ef4444" },
  { name: "@mhrj/mpp-components", color: "#a78bfa" }
];

const width = 960;
const height = 540;
const padding = { top: 110, right: 36, bottom: 62, left: 64 };
const chartWidth = width - padding.left - padding.right;
const chartHeight = height - padding.top - padding.bottom;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outputDir = path.join(root, "assets");
const outputFile = path.join(outputDir, "npm-download-trends.svg");

async function fetchPackageDownloads(pkg) {
  const url = `https://api.npmjs.org/downloads/range/last-month/${pkg}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "meharajM-profile-chart-generator"
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${pkg}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shortName(pkg) {
  return pkg.replace("@mhrj/", "");
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function formatValue(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `${value}`;
}

function buildPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function line(x1, y1, x2, y2, stroke, widthValue, dashArray = "") {
  const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${widthValue}"${dash} />`;
}

const series = await Promise.all(
  packages.map(async (pkg) => {
    const payload = await fetchPackageDownloads(pkg.name);
    return { ...pkg, payload };
  })
);

const availableSeries = series.filter((entry) => entry.payload?.downloads?.length);
const unavailablePackages = series
  .filter((entry) => !entry.payload?.downloads?.length)
  .map((entry) => shortName(entry.name));

if (availableSeries.length === 0) {
  throw new Error("No npm download series available to plot");
}

const dayCount = Math.max(...availableSeries.map((entry) => entry.payload.downloads.length));
const maxDownloads = Math.max(
  10,
  ...availableSeries.flatMap((entry) => entry.payload.downloads.map((day) => day.downloads))
);

const ySteps = 4;
const tickValues = Array.from({ length: ySteps + 1 }, (_, index) =>
  Math.round((maxDownloads / ySteps) * (ySteps - index))
);

const plottedSeries = availableSeries.map((entry) => {
  const points = entry.payload.downloads.map((day, index) => {
    const x = padding.left + (index / Math.max(dayCount - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (day.downloads / maxDownloads) * chartHeight;
    return { x, y, day: day.day, downloads: day.downloads };
  });
  return { ...entry, points };
});

const firstDay = plottedSeries[0]?.points[0]?.day ?? "";
const middleDay = plottedSeries[0]?.points[Math.floor((dayCount - 1) / 2)]?.day ?? "";
const lastDay = plottedSeries[0]?.points[dayCount - 1]?.day ?? "";

const grid = tickValues
  .map((tick) => {
    const y = padding.top + chartHeight - (tick / maxDownloads) * chartHeight;
    return [
      line(padding.left, y, width - padding.right, y, "#334155", 1, "4 6"),
      `<text x="${padding.left - 12}" y="${y + 4}" fill="#94a3b8" font-size="12" text-anchor="end">${formatValue(tick)}</text>`
    ].join("");
  })
  .join("");

const xAxisLabels = [
  { label: formatDate(firstDay), x: padding.left, anchor: "start" },
  { label: formatDate(middleDay), x: padding.left + chartWidth / 2, anchor: "middle" },
  { label: formatDate(lastDay), x: width - padding.right, anchor: "end" }
]
  .map(
    ({ label, x, anchor }) =>
      `<text x="${x}" y="${height - 22}" fill="#94a3b8" font-size="12" text-anchor="${anchor}">${label}</text>`
  )
  .join("");

const legend = plottedSeries
  .map((entry, index) => {
    const x = 36 + (index % 2) * 290;
    const y = 62 + Math.floor(index / 2) * 24;
    return [
      `<circle cx="${x}" cy="${y - 4}" r="5" fill="${entry.color}" />`,
      `<text x="${x + 14}" y="${y}" fill="#e2e8f0" font-size="13">${escapeXml(shortName(entry.name))}</text>`
    ].join("");
  })
  .join("");

const paths = plottedSeries
  .map((entry) => {
    const lastPoint = entry.points[entry.points.length - 1];
    return [
      `<path d="${buildPath(entry.points)}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`,
      `<circle cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="4.5" fill="${entry.color}" />`
    ].join("");
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">npm package download trends</title>
  <desc id="desc">Last 30 days of npm downloads for Meharaj's published packages.</desc>
  <rect width="${width}" height="${height}" rx="24" fill="#0f172a" />
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="20" fill="#111827" stroke="#1f2937" />
  <text x="36" y="42" fill="#f8fafc" font-size="26" font-weight="700">npm download trends</text>
  <text x="36" y="94" fill="#94a3b8" font-size="14">Last 30 days across published packages</text>
  ${
    unavailablePackages.length
      ? `<text x="36" y="522" fill="#64748b" font-size="12">Waiting for npm range history: ${escapeXml(
          unavailablePackages.join(", ")
        )}</text>`
      : ""
  }
  ${legend}
  ${grid}
  ${line(padding.left, padding.top + chartHeight, width - padding.right, padding.top + chartHeight, "#475569", 1.5)}
  ${line(padding.left, padding.top, padding.left, padding.top + chartHeight, "#475569", 1.5)}
  ${paths}
  ${xAxisLabels}
</svg>
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, svg, "utf8");
console.log(`Wrote ${outputFile}`);
