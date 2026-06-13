"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface CalendarPickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
  inputClass?: string;
  labelClass?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPicker({
  value,
  onChange,
  label = "JOIN DATE",
  inputClass,
  labelClass,
}: CalendarPickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : today;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const [mode, setMode] = useState<"day" | "month" | "year">("day");
  const ref = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + "T00:00:00") : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date";

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const yearRange = Array.from({ length: 30 }, (_, i) => today.getFullYear() - 10 + i);

  const defaultInputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
  const defaultLabelClass = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

  return (
    <div className="relative" ref={ref}>
      {label && <label className={labelClass || defaultLabelClass}>{label}</label>}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputClass || defaultInputClass} flex items-center justify-between cursor-pointer text-left`}
      >
        <span className={selectedDate ? "" : "text-gray-400"}>{displayValue}</span>
        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {/* Popup */}
      {open && (
        <div className="absolute z-50 mt-2 w-72 bg-[#111c35] border border-white/10 rounded-2xl shadow-2xl p-4 font-mono">

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition">
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMode(m => m === "month" ? "day" : "month")}
                className="text-xs font-bold text-white hover:text-[#c8202f] transition px-1"
              >
                {MONTHS[viewMonth]}
              </button>
              <button
                onClick={() => setMode(m => m === "year" ? "day" : "year")}
                className="text-xs font-bold text-white hover:text-[#c8202f] transition px-1"
              >
                {viewYear}
              </button>
            </div>

            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month picker */}
          {mode === "month" && (
            <div className="grid grid-cols-3 gap-1 mb-1">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => { setViewMonth(i); setMode("day"); }}
                  className={`py-1.5 rounded-lg text-[10px] uppercase tracking-wide transition
                    ${viewMonth === i ? "bg-[#c8202f] text-black font-bold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Year picker */}
          {mode === "year" && (
            <div className="grid grid-cols-4 gap-1 max-h-44 overflow-y-auto mb-1">
              {yearRange.map(y => (
                <button key={y} onClick={() => { setViewYear(y); setMode("day"); }}
                  className={`py-1.5 rounded-lg text-[10px] transition
                    ${viewYear === y ? "bg-[#c8202f] text-black font-bold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Day grid */}
          {mode === "day" && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] uppercase tracking-widest text-gray-600 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const mm = String(viewMonth + 1).padStart(2, "0");
                  const dd = String(day).padStart(2, "0");
                  const dateStr = `${viewYear}-${mm}-${dd}`;
                  const isSelected = value === dateStr;
                  const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

                  return (
                    <button key={day} onClick={() => handleSelectDay(day)}
                      className={`aspect-square w-full flex items-center justify-center rounded-lg text-[11px] transition
                        ${isSelected
                          ? "bg-[#c8202f] text-black font-bold"
                          : isToday
                          ? "border border-[#c8202f]/40 text-[#c8202f]"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}>
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Today shortcut */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => {
                    const mm = String(today.getMonth() + 1).padStart(2, "0");
                    const dd = String(today.getDate()).padStart(2, "0");
                    onChange(`${today.getFullYear()}-${mm}-${dd}`);
                    setOpen(false);
                  }}
                  className="w-full text-[10px] uppercase tracking-widest text-[#c8202f] hover:text-emerald-300 transition py-1"
                >
                  Today
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
