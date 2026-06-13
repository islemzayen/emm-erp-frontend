"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Phone } from "lucide-react";

// ─── Country data ─────────────────────────────────────────────────────────────
// format: [name, iso2, dialCode, flag emoji, minLength, maxLength]
const COUNTRIES: [string, string, string, string, number, number][] = [
  ["Afghanistan",           "AF", "93",   "🇦🇫",  9,  9],
  ["Albania",               "AL", "355",  "🇦🇱",  9,  9],
  ["Algeria",               "DZ", "213",  "🇩🇿",  9,  9],
  ["Andorra",               "AD", "376",  "🇦🇩",  6,  6],
  ["Angola",                "AO", "244",  "🇦🇴",  9,  9],
  ["Argentina",             "AR", "54",   "🇦🇷",  10, 10],
  ["Armenia",               "AM", "374",  "🇦🇲",  8,  8],
  ["Australia",             "AU", "61",   "🇦🇺",  9,  9],
  ["Austria",               "AT", "43",   "🇦🇹",  10, 13],
  ["Azerbaijan",            "AZ", "994",  "🇦🇿",  9,  9],
  ["Bahrain",               "BH", "973",  "🇧🇭",  8,  8],
  ["Bangladesh",            "BD", "880",  "🇧🇩",  10, 10],
  ["Belgium",               "BE", "32",   "🇧🇪",  9,  9],
  ["Bolivia",               "BO", "591",  "🇧🇴",  8,  8],
  ["Bosnia and Herzegovina","BA", "387",  "🇧🇦",  8,  8],
  ["Brazil",                "BR", "55",   "🇧🇷",  10, 11],
  ["Bulgaria",              "BG", "359",  "🇧🇬",  9,  9],
  ["Cameroon",              "CM", "237",  "🇨🇲",  9,  9],
  ["Canada",                "CA", "1",    "🇨🇦",  10, 10],
  ["Chile",                 "CL", "56",   "🇨🇱",  9,  9],
  ["China",                 "CN", "86",   "🇨🇳",  11, 11],
  ["Colombia",              "CO", "57",   "🇨🇴",  10, 10],
  ["Congo",                 "CG", "242",  "🇨🇬",  9,  9],
  ["Croatia",               "HR", "385",  "🇭🇷",  8,  9],
  ["Cuba",                  "CU", "53",   "🇨🇺",  8,  8],
  ["Cyprus",                "CY", "357",  "🇨🇾",  8,  8],
  ["Czech Republic",        "CZ", "420",  "🇨🇿",  9,  9],
  ["Denmark",               "DK", "45",   "🇩🇰",  8,  8],
  ["Ecuador",               "EC", "593",  "🇪🇨",  9,  9],
  ["Egypt",                 "EG", "20",   "🇪🇬",  10, 10],
  ["Ethiopia",              "ET", "251",  "🇪🇹",  9,  9],
  ["Finland",               "FI", "358",  "🇫🇮",  9,  10],
  ["France",                "FR", "33",   "🇫🇷",  9,  9],
  ["Germany",               "DE", "49",   "🇩🇪",  10, 11],
  ["Ghana",                 "GH", "233",  "🇬🇭",  9,  9],
  ["Greece",                "GR", "30",   "🇬🇷",  10, 10],
  ["Hungary",               "HU", "36",   "🇭🇺",  9,  9],
  ["India",                 "IN", "91",   "🇮🇳",  10, 10],
  ["Indonesia",             "ID", "62",   "🇮🇩",  9,  12],
  ["Iran",                  "IR", "98",   "🇮🇷",  10, 10],
  ["Iraq",                  "IQ", "964",  "🇮🇶",  10, 10],
  ["Ireland",               "IE", "353",  "🇮🇪",  9,  9],
  ["Israel",                "IL", "972",  "🇮🇱",  9,  9],
  ["Italy",                 "IT", "39",   "🇮🇹",  9,  10],
  ["Ivory Coast",           "CI", "225",  "🇨🇮",  10, 10],
  ["Japan",                 "JP", "81",   "🇯🇵",  10, 11],
  ["Jordan",                "JO", "962",  "🇯🇴",  9,  9],
  ["Kazakhstan",            "KZ", "7",    "🇰🇿",  10, 10],
  ["Kenya",                 "KE", "254",  "🇰🇪",  9,  9],
  ["Kuwait",                "KW", "965",  "🇰🇼",  8,  8],
  ["Lebanon",               "LB", "961",  "🇱🇧",  7,  8],
  ["Libya",                 "LY", "218",  "🇱🇾",  9,  9],
  ["Lithuania",             "LT", "370",  "🇱🇹",  8,  8],
  ["Luxembourg",            "LU", "352",  "🇱🇺",  9,  11],
  ["Malaysia",              "MY", "60",   "🇲🇾",  9,  10],
  ["Maldives",              "MV", "960",  "🇲🇻",  7,  7],
  ["Mali",                  "ML", "223",  "🇲🇱",  8,  8],
  ["Malta",                 "MT", "356",  "🇲🇹",  8,  8],
  ["Mauritania",            "MR", "222",  "🇲🇷",  8,  8],
  ["Mauritius",             "MU", "230",  "🇲🇺",  8,  8],
  ["Mexico",                "MX", "52",   "🇲🇽",  10, 10],
  ["Moldova",               "MD", "373",  "🇲🇩",  8,  8],
  ["Monaco",                "MC", "377",  "🇲🇨",  8,  9],
  ["Morocco",               "MA", "212",  "🇲🇦",  9,  9],
  ["Mozambique",            "MZ", "258",  "🇲🇿",  9,  9],
  ["Myanmar",               "MM", "95",   "🇲🇲",  8,  10],
  ["Netherlands",           "NL", "31",   "🇳🇱",  9,  9],
  ["New Zealand",           "NZ", "64",   "🇳🇿",  8,  10],
  ["Nigeria",               "NG", "234",  "🇳🇬",  8,  10],
  ["Norway",                "NO", "47",   "🇳🇴",  8,  8],
  ["Oman",                  "OM", "968",  "🇴🇲",  8,  8],
  ["Pakistan",              "PK", "92",   "🇵🇰",  10, 10],
  ["Palestine",             "PS", "970",  "🇵🇸",  9,  9],
  ["Panama",                "PA", "507",  "🇵🇦",  8,  8],
  ["Peru",                  "PE", "51",   "🇵🇪",  9,  9],
  ["Philippines",           "PH", "63",   "🇵🇭",  10, 10],
  ["Poland",                "PL", "48",   "🇵🇱",  9,  9],
  ["Portugal",              "PT", "351",  "🇵🇹",  9,  9],
  ["Qatar",                 "QA", "974",  "🇶🇦",  8,  8],
  ["Romania",               "RO", "40",   "🇷🇴",  9,  9],
  ["Russia",                "RU", "7",    "🇷🇺",  10, 10],
  ["Saudi Arabia",          "SA", "966",  "🇸🇦",  9,  9],
  ["Senegal",               "SN", "221",  "🇸🇳",  9,  9],
  ["Serbia",                "RS", "381",  "🇷🇸",  8,  9],
  ["Singapore",             "SG", "65",   "🇸🇬",  8,  8],
  ["Slovakia",              "SK", "421",  "🇸🇰",  9,  9],
  ["Somalia",               "SO", "252",  "🇸🇴",  7,  8],
  ["South Africa",          "ZA", "27",   "🇿🇦",  9,  9],
  ["South Korea",           "KR", "82",   "🇰🇷",  9,  10],
  ["Spain",                 "ES", "34",   "🇪🇸",  9,  9],
  ["Sri Lanka",             "LK", "94",   "🇱🇰",  9,  9],
  ["Sudan",                 "SD", "249",  "🇸🇩",  9,  9],
  ["Sweden",                "SE", "46",   "🇸🇪",  9,  9],
  ["Switzerland",           "CH", "41",   "🇨🇭",  9,  9],
  ["Syria",                 "SY", "963",  "🇸🇾",  9,  9],
  ["Taiwan",                "TW", "886",  "🇹🇼",  9,  9],
  ["Tanzania",              "TZ", "255",  "🇹🇿",  9,  9],
  ["Thailand",              "TH", "66",   "🇹🇭",  9,  9],
  ["Tunisia",               "TN", "216",  "🇹🇳",  8,  8],
  ["Turkey",                "TR", "90",   "🇹🇷",  10, 10],
  ["Uganda",                "UG", "256",  "🇺🇬",  9,  9],
  ["Ukraine",               "UA", "380",  "🇺🇦",  9,  9],
  ["United Arab Emirates",  "AE", "971",  "🇦🇪",  9,  9],
  ["United Kingdom",        "GB", "44",   "🇬🇧",  10, 10],
  ["United States",         "US", "1",    "🇺🇸",  10, 10],
  ["Uruguay",               "UY", "598",  "🇺🇾",  8,  8],
  ["Uzbekistan",            "UZ", "998",  "🇺🇿",  9,  9],
  ["Venezuela",             "VE", "58",   "🇻🇪",  10, 10],
  ["Vietnam",               "VN", "84",   "🇻🇳",  9,  10],
  ["Yemen",                 "YE", "967",  "🇾🇪",  9,  9],
  ["Zambia",                "ZM", "260",  "🇿🇲",  9,  9],
  ["Zimbabwe",              "ZW", "263",  "🇿🇼",  9,  9],
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Country {
  name: string; iso2: string; dialCode: string; flag: string;
  minLen: number; maxLen: number;
}

const COUNTRY_LIST: Country[] = COUNTRIES.map(
  ([name, iso2, dialCode, flag, minLen, maxLen]) =>
    ({ name, iso2, dialCode, flag, minLen, maxLen })
);

// Default to Tunisia
const DEFAULT = COUNTRY_LIST.find(c => c.iso2 === "TN") ?? COUNTRY_LIST[0];

// ─── Props ────────────────────────────────────────────────────────────────────
interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PhoneInput({ value, onChange, placeholder, className = "", error }: PhoneInputProps) {
  const [country, setCountry]     = useState<Country>(DEFAULT);
  const [number, setNumber]       = useState("");
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState("");
  const [touched, setTouched]     = useState(false);
  const dropdownRef               = useRef<HTMLDivElement>(null);
  const searchRef                 = useRef<HTMLInputElement>(null);

  // Parse incoming value on mount
  useEffect(() => {
    if (value && value.startsWith("+")) {
      const matched = COUNTRY_LIST.find(c => value.startsWith(`+${c.dialCode}`));
      if (matched) {
        setCountry(matched);
        setNumber(value.slice(matched.dialCode.length + 1).trim());
      }
    }
  }, []);

  // Emit full number up
  useEffect(() => {
    onChange(number ? `+${country.dialCode} ${number}` : "");
  }, [country, number]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? COUNTRY_LIST.filter(c => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.iso2.toLowerCase().includes(q))
      : COUNTRY_LIST;
  }, [search]);

  // Validation
  const digits   = number.replace(/\D/g, "");
  const isValid  = digits.length === 0 || (digits.length >= country.minLen && digits.length <= country.maxLen);
  const isTooLong = digits.length > country.maxLen;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\s\-()]/g, "");
    // Enforce max length
    if (raw.replace(/\D/g, "").length > country.maxLen) return;
    setNumber(raw);
  };

  const selectCountry = (c: Country) => {
    setCountry(c);
    setNumber("");
    setOpen(false);
    setSearch("");
  };

  const hint = touched && digits.length > 0 && !isValid
    ? `${country.name}: ${country.minLen === country.maxLen ? country.minLen : `${country.minLen}–${country.maxLen}`} digits required (${digits.length} entered)`
    : "";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input row */}
      <div className={`flex items-center gap-0 bg-gray-100 dark:bg-black/30 border rounded-xl overflow-hidden transition ${
        error || hint ? "border-red-500/60" : isValid && digits.length > 0 ? "border-[#c8202f]/60" : "border-gray-200 dark:border-white/10"
      } focus-within:border-[#c8202f]/60`}>

        {/* Country selector button */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 border-r border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/5 transition flex-shrink-0 h-full"
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">+{country.dialCode}</span>
          <ChevronDown size={11} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Number input */}
        <div className="flex items-center flex-1 px-3 gap-2">
          <Phone size={12} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            inputMode="numeric"
            value={number}
            onChange={handleNumberChange}
            onBlur={() => setTouched(true)}
            placeholder={placeholder ?? `${country.minLen === country.maxLen ? country.minLen : `${country.minLen}–${country.maxLen}`} digits`}
            className="flex-1 bg-transparent py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
          />
          {/* Length indicator */}
          {digits.length > 0 && (
            <span className={`text-[10px] font-mono flex-shrink-0 ${
              isValid ? "text-[#c8202f]" : "text-red-400"
            }`}>
              {digits.length}/{country.maxLen}
            </span>
          )}
        </div>
      </div>

      {/* Validation hint */}
      {hint && (
        <p className="text-[10px] text-red-400 mt-1 px-1">{hint}</p>
      )}
      {error && (
        <p className="text-[10px] text-red-400 mt-1 px-1">{error}</p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 z-50 bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-[#1b2a6b]/20">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-white/5 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No results</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition ${
                    c.iso2 === country.iso2 ? "bg-[#c8202f]/5 text-[#c8202f]" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="text-base leading-none w-6 flex-shrink-0">{c.flag}</span>
                  <span className="flex-1 text-xs truncate">{c.name}</span>
                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">+{c.dialCode}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {c.minLen === c.maxLen ? c.minLen : `${c.minLen}-${c.maxLen}`}d
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
