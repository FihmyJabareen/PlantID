import React, { useEffect, useMemo, useRef, useState } from "react";

// === CONFIG via environment (never hardcode secrets) ===
const CONFIG = {
  PLANT_ID_API_KEY: import.meta.env.VITE_PLANT_ID_API_KEY || "",
  PERENUAL_API_KEY: import.meta.env.VITE_PERENUAL_API_KEY || "",
};

const PERENUAL_BASE = "https://perenual.com/api";
const PLANTID_IDENT_URL = "https://api.plant.id/api/v3/identification";

// === i18n strings (HE/AR) ===
const translations = {
  he: {
    appTitle: "מזהה צמחים + מדריך טיפול",
    language: "שפה",
    hebrew: "עברית",
    arabic: "العربية",
    uploadLabel: "בחר/י תמונה או צלמי",
    identify: "זהה",
    results: "תוצאות",
    pickAnother: "בחר/י תמונה אחרת",
    careGuide: "מדריך טיפול",
    description: "תיאור",
    watering: "השקיה",
    sunlight: "אור",
    pruning: "גיזום",
    hardiness: "עמידות לקור (אזור)",
    tips: "טיפים",
    pests: "מזיקים/מחלות",
    yes: "כן",
    no: "לא",
    loading: "טוען...",
    identifyFirst: "נא לזהות צמח תחילה",
    errorApiKey: "חסרים מפתחות API — בדקו .env",
    noMatches: "לא נמצאו התאמות",
  },
  ar: {
    appTitle: "تعرّف على النباتات + دليل العناية",
    language: "اللغة",
    hebrew: "עברית",
    arabic: "العربية",
    uploadLabel: "التقط صورة أو ارفع ملفًا",
    identify: "تعرّف",
    results: "النتائج",
    pickAnother: "اختر صورة أخرى",
    careGuide: "دليل العناية",
    description: "الوصف",
    watering: "الري",
    sunlight: "الضوء",
    pruning: "التقليم",
    hardiness: "تحمّل البرودة (المنطقة)",
    tips: "نصائح",
    pests: "الآفات/الأمراض",
    yes: "نعم",
    no: "لا",
    loading: "جارٍ التحميل...",
    identifyFirst: "رجاءً حدّد النبات أولًا",
    errorApiKey: "مفاتيح API غير موجودة — تأكد من .env",
    noMatches: "لا توجد تطابقات",
  },
};

const i18nCareValue = (lang, key, value) => {
  const map = {
    watering: {
      he: { Frequent: "השקיה תכופה", Average: "השקיה בינונית", Minimum: "מעט השקיה", None: "ללא השקיה" },
      ar: { Frequent: "ري متكرر", Average: "ري متوسط", Minimum: "ري قليل", None: "دون ري" },
    },
    sunlight: {
      he: { "Full sun": "שמש מלאה", "Part shade": "חצי צל", "Full shade": "צל מלא" },
      ar: { "Full sun": "شمس كاملة", "Part shade": "ظل جزئي", "Full shade": "ظل كامل" },
    },
  };
  return map[key]?.[lang]?.[value] || value;
};

const prettyProb = (p) => Math.round((p || 0) * 100);

export default function App() {
  const [lang, setLang] = useState("he");
  const t = translations[lang];
  const direction = "rtl";

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [care, setCare] = useState(null);
  const [wiki, setWiki] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setGeo(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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

  const identify = async () => {
    setError("");
    setLoading(true);
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
      const languageParam = lang === "ar" ? "ar" : "en";

      const url = `${PLANTID_IDENT_URL}?details=common_names,url,description,watering&language=${languageParam}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Api-Key": CONFIG.PLANT_ID_API_KEY },
        body: JSON.stringify({ images: [b64], latitude: geo?.lat, longitude: geo?.lon, similar_images: true }),
      });
      const data = await res.json();
      const s = data?.result?.classification?.suggestions || [];
      setSuggestions(s);
      if (s[0]) await selectSuggestion(s[0]);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = async (sugg) => {
    setSelected(sugg);
    setCare(null);
    setWiki(null);

    const sci = sugg?.name || "";
    try {
      // Perenual species search
      const listRes = await fetch(`${PERENUAL_BASE}/v2/species-list?key=${CONFIG.PERENUAL_API_KEY}&q=${encodeURIComponent(sci)}`);
      const listJson = await listRes.json();
      const hit = listJson?.data?.[0];
      if (hit?.id) {
        const detRes = await fetch(`${PERENUAL_BASE}/v2/species/details/${hit.id}?key=${CONFIG.PERENUAL_API_KEY}`);
        setCare(await detRes.json());
      }

      // Wikipedia
      const wikiLang = lang === "he" ? "he" : "ar";
      const wikiRes = await fetch(`https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(sci)}`);
      if (wikiRes.ok) setWiki(await wikiRes.json());
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6" dir={direction} lang={lang}>
      <div className="max-w-5xl mx-auto">
        <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 mb-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{t.appTitle}</h1>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="border rounded-xl px-3 py-2 bg-white text-sm">
              <option value="he">{t.hebrew}</option>
              <option value="ar">{t.arabic}</option>
            </select>
          </div>
        </header>

        <section className="bg-white rounded-2xl shadow p-3 sm:p-4 md:p-6 mb-6">
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
          <button onClick={() => inputRef.current?.click()} className="w-full rounded-xl px-4 py-3 bg-black text-white">{t.uploadLabel}</button>
          {previewUrl && <img src={previewUrl} alt="preview" className="mt-4 w-full aspect-[4/3] object-cover rounded-xl border" />}
          <div className="mt-4 flex gap-3">
            <button onClick={identify} disabled={!file || loading} className="flex-1 rounded-xl px-4 py-3 bg-emerald-600 text-white disabled:opacity-50">{loading ? t.loading : t.identify}</button>
            <button onClick={() => { setFile(null); setPreviewUrl(""); setSuggestions([]); setSelected(null); setCare(null); setWiki(null); }} className="flex-1 rounded-xl px-4 py-3 bg-slate-200">{t.pickAnother}</button>
          </div>
          {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        </section>

        {suggestions.length > 0 && (
          <section className="bg-white rounded-2xl shadow p-3 sm:p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-2">{t.results}</h2>
            <ul className="space-y-3">
              {suggestions.map((sugg, idx) => (
                <li key={idx} onClick={() => selectSuggestion(sugg)} className="border rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                  <div className="font-semibold">{sugg.name}</div>
                  <div className="text-sm opacity-70">{prettyProb(sugg.probability)}%</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {selected && care && (
          <section className="bg-white rounded-2xl shadow p-3 sm:p-4 md:p-6 mt-4">
            <h2 className="text-lg font-semibold mb-4">{t.careGuide}</h2>
            <p><b>{t.watering}:</b> {i18nCareValue(lang, "watering", care.watering)}</p>
            <p><b>{t.sunlight}:</b> {(care.sunlight || []).join(", ")}</p>
            {wiki?.extract && <p className="mt-3">{wiki.extract}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
