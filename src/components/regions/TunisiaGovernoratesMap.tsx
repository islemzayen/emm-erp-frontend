/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export type GovernorateDatum = {
  id: string;
  name: string;
  value: number;
  subtitle?: string;
};

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  govId: string | null;
};

type Marker = {
  govId: string;
  cx: number;
  cy: number;
};

const GOVERNORATE_NAMES: readonly string[] = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fillFor(value: number, isActive: boolean) {
  if (isActive) return "#0ea5e9";
  if (value <= 0) return "#e2e8f0";
  if (value <= 10) return "#7dd3fc";
  return "#fbbf24";
}

function strokeFor(value: number, isActive: boolean) {
  if (isActive) return "#0f172a";
  if (value <= 0) return "#94a3b8";
  if (value <= 10) return "#0284c7";
  return "#b45309";
}

/**
 * Interactive Tunisia governorates SVG map.
 *
 * Note: The provided SVG file's governorate paths are not labeled by name.
 * We map them in DOM order to the 24 governorate names. If a name is mismatched,
 * adjust `GOVERNORATE_NAMES` ordering.
 */
export function TunisiaGovernoratesMap({
  data,
  selectedId,
  onSelect,
  className,
}: {
  data: GovernorateDatum[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string>("");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>({
    open: false,
    x: 0,
    y: 0,
    govId: null,
  });

  const dataById = useMemo(() => {
    const map = new Map<string, GovernorateDatum>();
    for (const item of data) map.set(item.id, item);
    return map;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    fetch("/maps/Governorates_of_Tunisia_blank.svg")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load SVG (${res.status})`);
        return await res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setSvgText(text);
      })
      .catch(() => {
        if (cancelled) return;
        setSvgText("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // After SVG injected, annotate governorate paths & compute centroids for markers.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    if (!svgText) return;

    const svg = root.querySelector("svg");
    if (!svg) return;

    const allPaths = Array.from(svg.querySelectorAll("path"));
    const govPaths = allPaths.filter((p) => (p.getAttribute("style") || "").includes("stroke-width:1px"));

    const nextMarkers: Marker[] = [];

    govPaths.forEach((pathEl, idx) => {
      const name = GOVERNORATE_NAMES[idx] || `Gov ${idx + 1}`;
      const govId = normalizeKey(name);

      pathEl.setAttribute("data-gov-id", govId);
      pathEl.style.cursor = "pointer";
      pathEl.style.fill = fillFor(dataById.get(govId)?.value ?? 0, govId === selectedId);
      pathEl.style.stroke = strokeFor(dataById.get(govId)?.value ?? 0, govId === selectedId);
      pathEl.style.strokeWidth = govId === selectedId ? "2.5" : "1.3";
      pathEl.style.transition = "fill 150ms ease, stroke 150ms ease, stroke-width 150ms ease, opacity 150ms ease";
      pathEl.style.opacity = "0.98";

      try {
        const bbox = pathEl.getBBox();
        nextMarkers.push({
          govId,
          cx: bbox.x + bbox.width / 2,
          cy: bbox.y + bbox.height / 2,
        });
      } catch {
        // ignore bbox failures (rare)
      }
    });

    setMarkers(nextMarkers);
  }, [svgText, dataById, selectedId]);

  // Update fills on selection/data changes without re-fetching SVG.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const svg = root.querySelector("svg");
    if (!svg) return;
    const govPaths = Array.from(svg.querySelectorAll<SVGPathElement>("path[data-gov-id]"));
    for (const el of govPaths) {
      const govId = el.getAttribute("data-gov-id") || "";
      const value = dataById.get(govId)?.value ?? 0;
      const active = govId === selectedId;
      el.style.fill = fillFor(value, active);
      el.style.stroke = strokeFor(value, active);
      el.style.strokeWidth = active ? "2.5" : "1.3";
      el.style.opacity = active ? "1" : "0.98";
    }
  }, [dataById, selectedId]);

  const activeTooltip = tooltip.govId ? dataById.get(tooltip.govId) ?? null : null;

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_36%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]"
        onMouseMove={(e) => {
          if (!tooltip.open) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setTooltip((t) => ({
            ...t,
            x: clamp(e.clientX - rect.left, 10, rect.width - 10),
            y: clamp(e.clientY - rect.top, 10, rect.height - 10),
          }));
        }}
        onMouseLeave={() => setTooltip({ open: false, x: 0, y: 0, govId: null })}
        onClick={(e) => {
          const target = e.target as Element | null;
          const govId = target?.getAttribute?.("data-gov-id") ?? null;
          if (!govId) return;
          onSelect(selectedId === govId ? null : govId);
        }}
        onMouseOver={(e) => {
          const target = e.target as Element | null;
          const govId = target?.getAttribute?.("data-gov-id") ?? null;
          if (!govId) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setTooltip({
            open: true,
            govId,
            x: clamp((e as unknown as MouseEvent).clientX - rect.left, 10, rect.width - 10),
            y: clamp((e as unknown as MouseEvent).clientY - rect.top, 10, rect.height - 10),
          });
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:22px_22px]" />

        {svgText ? (
          <div
            className="relative mx-auto w-full max-w-[360px] select-none"
            style={{ filter: "drop-shadow(0 18px 35px rgba(15,23,42,0.14))" }}
            dangerouslySetInnerHTML={{ __html: svgText }}
          />
        ) : (
          <div className="flex h-[540px] items-center justify-center text-sm text-slate-400">
            Failed to load map SVG.
          </div>
        )}

        {/* 3D-ish animated markers */}
        <div className="pointer-events-none absolute inset-0">
          <svg viewBox="0 0 520 1052" className="mx-auto w-full max-w-[360px]">
            {markers.map((m) => {
              const val = dataById.get(m.govId)?.value ?? 0;
              if (val <= 0) return null;
              const active = m.govId === selectedId;
              const color = val <= 10 ? "#0284c7" : "#d97706";
              return (
                <g key={m.govId} transform={`translate(${m.cx},${m.cy})`}>
                  <motion.circle
                    r={active ? 14 : 12}
                    fill={color}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 0.92, scale: active ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  />
                  <motion.circle
                    r={active ? 24 : 20}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth={1.5}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.18, 0.5, 0.18], scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="white"
                    fontWeight={700}
                    style={{ fontFamily: "ui-sans-serif, system-ui" }}
                  >
                    {val > 99 ? "99+" : String(val)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tooltip */}
        {tooltip.open && activeTooltip ? (
          <div
            className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {activeTooltip.name}
                </p>
                {activeTooltip.subtitle ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {activeTooltip.subtitle}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl bg-slate-900 px-2 py-1 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
                {activeTooltip.value}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

