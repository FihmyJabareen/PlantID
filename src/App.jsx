import React, { useEffect, useMemo, useRef, useState } from "react";

// === 🔧 CONFIG (replace with your keys or inject via env) ===
const CONFIG = {
  PLANT_ID_API_KEY: "YOUR_PLANT_ID_API_KEY",
  PERENUAL_API_KEY: "sk-8tjV68a9ca204d3a511985",
};

// === 🗺️ Simple i18n for Hebrew & Arabic (UI strings only) ===
const translations = {
  he: {
    appTitle: "מזהה צמחים + מדריך טיפול",
    language: "שפה",
    hebrew: "עברית",
    arabic: "العربية",
    uploadLabel: "בחר/י תמונה או צלמי",
    identify: "זהה",
    results: "תוצאות",
    topMatches: "התאמות מובילות",
    pickAnother: "בחר/י תמונה אחרת",
    careGuide: "מדריך טיפול",
    description: "תיאור",
    watering: "השקיה",
    sunlight: "אור",
    pruning: "גיזום",
    hardiness: "עמידות לקור (אזור)",
    toxicity: "רעילות",
    edible: "אכיל",
    healthy: "בריא?",
    yes: "כן",
    no: "לא",
    loading: "טוען...",
    identifyFirst: "נא לזהות צמח תחילה",
    errorApiKey: "נא להזין מפתחות API תקינים בהגדרות בקוד.",
    noMatches: "לא נמצאו התאמות",
    seeMore: "פרטים נוספים",
  },
  ar: {
    appTitle: "تعرّف على النباتات + دليل العناية",
    language: "اللغة",
    hebrew: "עברית",
    arabic: "العربية",
    uploadLabel: "التقط صورة أو ارفع ملفًا",
    identify: "تعرّف",
    results: "النتائج",
    topMatches: "أفضل التطابقات",
    pickAnother: "اختر صورة أخرى",
    careGuide: "دليل العناية",
    description: "الوصف",
    watering: "الري",
    sunlight: "الضوء",
    pruning: "التقليم",
    hardiness: "تحمّل البرودة (المنطقة)",
    toxicity: "السميّة",
    edible: "صالحة للأكل",
    healthy: "صحي؟",
    yes: "نعم",
    no: "لا",
    loading: "جارٍ التحميل...",
    identifyFirst: "رجاءً حدّد النبات أولًا",
    errorApiKey: "رجاءً أضف مفاتيح API صحيحة في الإعدادات داخل الكود.",
    noMatches: "لا توجد تطابقات",
    seeMore: "تفاصيل أكثر",
  },
};

// Mapping Perenual enumerations to HE/AR labels
const i18nCareValue = (lang, key, value) => {
  const map = {
    watering: {
      he: { Frequent: "השקיה תכופה", Average: "השקיה בינונית", Minimum: "מעט השקיה", None: "ללא השקיה" },
      ar: { Frequent: "ري متكرر", Average: "ري متوسط", Minimum: "ري قليل", None: "دون ري" },
    },
    sunlight: {
      he: {
        "Full sun": "שמש מלאה",
        "Part shade": "חצי צל",
        "Full shade": "צל מלא",
        "sun-part_shade": "שמש/חצי צל",
      },
      ar: {
        "Full sun": "شمس كاملة",
        "Part shade": "ظل جزئي",
        "Full shade": "ظل كامل",
        "sun-part_shade": "شمس/ظل جزئي",
      },
    },
  };
  return map[key]?.[lang]?.[value] || value;
};

const prettyProb = (p) => Math.round((p || 0) * 100);

export default function App() {
  const [lang, setLang] = useState("he");
  const t = translations[lang];
  const direction = "rtl"; // both HE & AR are RTL

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [ident, setIdent] = useState(null); // Plant.id response
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null); // selected suggestion

  const [care, setCare] = useState(null); // Perenual species details
  const [wiki, setWiki] = useState(null); // Wikipedia summary per language

  const inputRef = useRef(null);

  // Request geolocation (improves Plant.id accuracy)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setGeo(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // create preview and keep object URL tidy
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePick = () => inputRef.current?.click();

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const toBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // === 1) Identify via Plant.id ===
  const identify = async () => {
    setError("");
    setLoading(true);
    setIdent(null);
    setSuggestions([]);
    setSelected(null);
    setCare(null);
    setWiki(null);

    try {
      if (!CONFIG.PLANT_ID_API_KEY || !CONFIG.PERENUAL_API_KEY) {
        throw new Error(t.errorApiKey);
      }
      if (!file) throw new Error(t.identifyFirst);

      const b64 = await toBase64(file);
      const languageParam = lang === "ar" ? "ar" : "en"; // Plant.id supports ar, not he

      const body = {
        images: [b64],
        latitude: geo?.lat,
        longitude: geo?.lon,
        similar_images: true,
      };

      const url = `https://api.plant.id/api/v3/identification?details=common_names,url,description,watering,best_watering,best_light_condition,best_soil_type,edible_parts,toxicity&language=${encodeURIComponent(
        languageParam
      )}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": CONFIG.PLANT_ID_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Plant.id HTTP ${res.status}`);
      const data = await res.json();
      setIdent(data);

      const s = data?.result?.classification?.suggestions || [];
      setSuggestions(s);

      if (s[0]) {
        await selectSuggestion(s[0]);
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // === 2) On choose one suggestion: fetch Perenual care + Wikipedia summary (HE/AR) ===
  const selectSuggestion = async (sugg) => {
    setSelected(sugg);
    setCare(null);
    setWiki(null);

    const sci = sugg?.name || ""; // Plant.id returns taxon name here
    try {
      // Perenual: search by query, then details by id
      const q = encodeURIComponent(sci);
      const listRes = await fetch(
        `https://perenual.com/api/v2/species-list?key=${CONFIG.PERENUAL_API_KEY}&q=${q}`
      );
      const listJson = await listRes.json();
      const hit = listJson?.data?.[0];
      if (hit?.id) {
        const detRes = await fetch(
          `https://perenual.com/api/v2/species/details/${hit.id}?key=${CONFIG.PERENUAL_API_KEY}`
        );
        const detJson = await detRes.json();
        setCare(detJson);
      }

      // Wikipedia summary (HE/AR) based on selected language
      const wikiLang = lang === "he" ? "he" : "ar";
      const wikiTitle = encodeURIComponent(sci.replaceAll(" ", "_"));
      const wikiRes = await fetch(
        `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`
      );
      if (wikiRes.ok) {
        const wikiJson = await wikiRes.json();
        setWiki(wikiJson);
      }
    } catch (e) {
      // ignore wiki/perenual errors silently
    }
  };

  const uiTextDir = useMemo(() => ({ direction, textAlign: "right" }), [direction]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6" dir={direction} lang={lang} style={uiTextDir}>
      <div className="max-w-5xl mx-auto">
        {/* Sticky header on mobile for easy language switch */}
        <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 mb-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{t.appTitle}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs sm:text-sm opacity-70 hidden xs:block">{t.language}</label>
              <select
                className="border rounded-xl px-2 py-1 sm:px-3 sm:py-2 bg-white text-sm"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="he">{t.hebrew}</option>
                <option value="ar">{t.arabic}</option>
              </select>
            </div>
          </div>
        </header>

        {/* Card: uploader + results side-by-side on md+, stacked on mobile */}
        <section className="bg-white rounded-2xl shadow p-3 sm:p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
            {/* Left column: uploader */}
            <div className="order-1 md:order-none">
              <button
                onClick={handlePick}
                className="w-full rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 bg-black text-white hover:opacity-90 active:opacity-80"
              >
                {t.uploadLabel}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onFileChange}
              />

              {previewUrl && (
                <div className="mt-3 sm:mt-4">
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="w-full aspect-[4/3] object-cover rounded-xl border"
                  />
                </div>
              )}

              {/* action bar: sticky on small screens */}
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-3 sm:gap-3 sm:items-center sm:justify-start">
                <button
                  onClick={identify}
                  disabled={!file || loading}
                  className="w-full sm:w-auto rounded-2xl px-4 sm:px-5 py-3 bg-emerald-600 text-white disabled:opacity-50"
                >
                  {loading ? t.loading : t.identify}
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl("");
                    setIdent(null);
                    setSuggestions([]);
                    setSelected(null);
                    setCare(null);
                    setWiki(null);
                  }}
                  className="w-full sm:w-auto rounded-2xl px-4 sm:px-5 py-3 bg-slate-200"
                >
                  {t.pickAnother}
                </button>
              </div>

              {error && (
                <p className="mt-2 text-red-600 text-sm whitespace-pre-wrap">{error}</p>
              )}
            </div>

            {/* Right column: results */}
            <div className="w-full">
              <h2 className="text-lg sm:text-xl font-semibold mb-2">{t.results}</h2>

              {/* On mobile, convert list to horizontal scroll chips */}
              {suggestions.length === 0 ? (
                <p className="opacity-60">{t.noMatches}</p>
              ) : (
                <div className="md:hidden -mx-2 px-2 overflow-x-auto no-scrollbar">
                  <div className="flex gap-3">
                    {suggestions.slice(0, 8).map((sugg, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSuggestion(sugg)}
                        className={`shrink-0 rounded-2xl border px-3 py-2 text-sm text-left min-w-[200px] ${
                          selected?.id === sugg.id ? "border-emerald-600 ring-1 ring-emerald-600" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {sugg?.similar_images?.[0]?.url_small && (
                            <img
                              src={sugg.similar_images[0].url_small}
                              alt={sugg.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-semibold line-clamp-1">{sugg.name}</div>
                            <div className="text-xs opacity-70">{prettyProb(sugg.probability)}%</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Desktop/tablet vertical list */}
              <ul className="hidden md:block space-y-3">
                {suggestions.slice(0, 6).map((sugg, idx) => (
                  <li
                    key={idx}
                    className={`border rounded-xl p-3 cursor-pointer ${
                      selected?.id === sugg.id ? "border-emerald-600 ring-1 ring-emerald-600" : ""
                    }`}
                    onClick={() => selectSuggestion(sugg)}
                  >
                    <div className="flex items-center gap-3">
                      {sugg?.similar_images?.[0]?.url_small && (
                        <img
                          src={sugg.similar_images[0].url_small}
                          alt={sugg.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{sugg.name}</div>
                        <div className="text-sm opacity-70">{prettyProb(sugg.probability)}%</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {selected && (
          <section className="bg-white rounded-2xl shadow p-3 sm:p-4 md:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">{t.careGuide}</h2>

            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <div>
                <div className="mb-3">
                  <div className="text-sm opacity-70">{t.description}</div>
                  <div className="mt-1">
                    {wiki?.extract ? (
                      <p className="leading-7">{wiki.extract}</p>
                    ) : ident?.result?.classification?.suggestions?.[0]?.details?.description ? (
                      <p className="leading-7">
                        {ident.result.classification.suggestions[0].details.description}
                      </p>
                    ) : (
                      <p className="opacity-60">—</p>
                    )}
                  </div>
                </div>

                {care && (
                  <div className="space-y-2">
                    {care.watering && (
                      <Row label={t.watering}>
                        {i18nCareValue(lang, "watering", care.watering)}
                        {care.watering_general_benchmark?.value && (
                          <span className="opacity-70 text-sm">{` · ${care.watering_general_benchmark.value} ${care.watering_general_benchmark.unit}`}</span>
                        )}
                      </Row>
                    )}

                    {Array.isArray(care.sunlight) && care.sunlight.length > 0 && (
                      <Row label={t.sunlight}>
                        {care.sunlight.map((s, i) => (
                          <span key={i} className="inline-block ml-1">
                            {i18nCareValue(lang, "sunlight", s)}
                            {i < care.sunlight.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </Row>
                    )}

                    {care.pruning_count && (
                      <Row label={t.pruning}>
                        {`${care.pruning_count.amount || 1} / ${lang === "he" ? "שנה" : "سنة"}`}
                      </Row>
                    )}

                    {care.hardiness && (
                      <Row label={t.hardiness}>
                        {`${care.hardiness.min}–${care.hardiness.max}`}
                      </Row>
                    )}

                    {typeof care.seeds === "number" && (
                      <Row label={t.edible}>{care.seeds > 0 ? t.yes : t.no}</Row>
                    )}
                  </div>
                )}
              </div>

              <div>
                {selected?.similar_images?.[0]?.url && (
                  <img
                    src={selected.similar_images[0].url}
                    alt={selected.name}
                    className="w-full aspect-[4/3] md:max-h-[420px] object-cover rounded-xl border"
                  />
                )}
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 text-xs opacity-60 text-center">
          <p>Data by Plant.id & Perenual · Wikipedia summaries in selected language when available.</p>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <div className="min-w-28 text-slate-600">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// Small utility to hide horizontal scrollbar on mobile carousels
// Add this in your global CSS (index.css):
// .no-scrollbar::-webkit-scrollbar { display: none; }
// .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
