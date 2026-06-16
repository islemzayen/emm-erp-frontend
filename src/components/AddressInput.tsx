"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";

interface Suggestion {
  place_id: number;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  lat: string;
  lon: string;
}

interface AddressInputProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

function formatAddress(s: Suggestion): string {
  const a = s.address;
  const parts = [
    [a.house_number, a.road].filter(Boolean).join(" "),
    a.city || a.town || a.village,
    a.state,
    a.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function AddressInput({
  value,
  onChange,
  placeholder = "Start typing an address…",
  className = "",
  error,
}: AddressInputProps) {
  const [query, setQuery]           = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [focused, setFocused]       = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sync external value
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q,
          format:          "json",
          addressdetails:  "1",
          limit:           "6",
          "accept-language": "fr,en",
        });
      const res  = await fetch(url, { headers: { "Accept-Language": "fr,en" } });
      const data = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // emit raw input immediately
if (debounceRef.current) clearTimeout(debounceRef.current);    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const handleSelect = (s: Suggestion) => {
    const formatted = formatAddress(s);
    setQuery(formatted);
    onChange(formatted);
    setSuggestions([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-black/30 border rounded-xl transition ${
        error
          ? "border-red-500/60"
          : focused
          ? "border-[#c8202f]/60"
          : "border-gray-200 dark:border-white/10"
      }`}>
        {loading
          ? <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />
          : <MapPin size={13} className="text-gray-400 flex-shrink-0" />
        }
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-red-400 mt-1 px-1">{error}</p>}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => {
            const formatted = formatAddress(s);
            // Split at first comma for bold/dim display
            const [main, ...rest] = formatted.split(", ");
            return (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={e => e.preventDefault()} // prevent blur before click
                onClick={() => handleSelect(s)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition ${
                  i < suggestions.length - 1 ? "border-b border-gray-100 dark:border-white/[0.04]" : ""
                }`}
              >
                <MapPin size={12} className="text-[#c8202f] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{main}</p>
                  {rest.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate">{rest.join(", ")}</p>
                  )}
                </div>
              </button>
            );
          })}
          <div className="px-3 py-1.5 border-t border-gray-100 dark:border-white/[0.04] flex items-center gap-1">
            <span className="text-[9px] text-gray-400">Powered by</span>
            <span className="text-[9px] font-bold text-gray-400">OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  );
}
