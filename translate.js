// translate.js
// Usage: node translate.js
// Reads src/locales/en.json → translates to FR via MyMemory API → writes src/locales/fr.json

const fs   = require("fs");
const path = require("path");

const EN_PATH = path.join(__dirname, "src/locales/en.json");
const FR_PATH = path.join(__dirname, "src/locales/fr.json");
const DELAY_MS = 150; // polite delay between requests to avoid rate limiting

// ── Load files ────────────────────────────────────────────────────────────────
const enData = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
let   frData = {};
try { frData = JSON.parse(fs.readFileSync(FR_PATH, "utf8")); } catch {}

// ── Only translate keys that are missing or still in English ─────────────────
const toTranslate = Object.entries(enData).filter(([key, val]) => {
  const existing = frData[key];
  return !existing || existing === val; // missing or untranslated
});

if (toTranslate.length === 0) {
  console.log("✅ fr.json is already up to date — nothing to translate.");
  process.exit(0);
}

console.log(`🌍 Translating ${toTranslate.length} keys (${Object.keys(enData).length - toTranslate.length} already done)...\n`);

// ── Translate via MyMemory ────────────────────────────────────────────────────
async function translate(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`;
  const res  = await fetch(url);
  const json = await res.json();

  if (json.responseStatus !== 200) {
    throw new Error(`MyMemory error: ${json.responseDetails}`);
  }
  return json.responseData.translatedText;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  let done = 0;
  let failed = 0;

  for (const [key, val] of toTranslate) {
    try {
      const translated = await translate(val);
      frData[key] = translated;
      done++;

      // Progress indicator every 10 keys
      if (done % 10 === 0 || done === toTranslate.length) {
        const pct = Math.round((done / toTranslate.length) * 100);
        process.stdout.write(`\r  [${"█".repeat(Math.floor(pct/5))}${" ".repeat(20-Math.floor(pct/5))}] ${pct}% (${done}/${toTranslate.length})`);
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`\n  ⚠️  Failed to translate "${key}": ${err.message}`);
      frData[key] = val; // fallback to English
      failed++;
    }
  }

  // ── Preserve key order from en.json ────────────────────────────────────────
  const ordered = {};
  for (const key of Object.keys(enData)) {
    ordered[key] = frData[key] ?? enData[key];
  }

  fs.writeFileSync(FR_PATH, JSON.stringify(ordered, null, 2), "utf8");

  console.log(`\n\n✅ Done! ${done - failed} translated, ${failed} fallbacks.`);
  console.log(`📄 Written to: src/locales/fr.json`);
})();