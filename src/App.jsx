import { useState, useRef, useCallback } from "react";

// ─── localStorage Utilities ───────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt$ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;
const nowStr = () => new Date().toLocaleString();
const uid = () => Date.now() + Math.random().toString(36).slice(2, 7);

// ─── Evaluator ────────────────────────────────────────────────────────────────
function evaluate({ mustHit, current, cap, qualifies, recentReset }) {
  if (mustHit === "no") return { rec: "INVALID TARGET", pct: null, reason: "This does not appear to be a must-hit-by machine. Only evaluate machines with clear Must Hit By or Must Award By language.", warnings: ["Not a must-hit-by machine"] };
  if (!current || !cap || isNaN(Number(current)) || isNaN(Number(cap))) return null;
  const pct = (Number(current) / Number(cap)) * 100;
  const warnings = [];
  if (qualifies === "no") warnings.push("Bet may not qualify");
  if (recentReset === "yes") warnings.push("Recently reset");
  if (qualifies === "no") return { rec: "SKIP", pct, reason: "Your bet may not qualify for the major prize. Confirm bet requirements before playing.", warnings };
  if (recentReset === "yes") return { rec: "SKIP", pct, reason: "This machine appears recently reset. Skip and look for a more mature major prize.", warnings };
  if (pct >= 95) return { rec: "PLAY", pct, reason: "Valid must-hit-by setup and very close to the major prize cap. Strong candidate.", warnings };
  if (pct >= 90) return { rec: "MAYBE", pct, reason: "Borderline. Close to the major prize cap but not at peak threshold. Weigh your bankroll.", warnings };
  return { rec: "SKIP", pct, reason: "Too far from the major prize cap to justify play at this time.", warnings };
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_PRESETS = [
  { id: "p1", presetName: "South Point", casinoName: "South Point Casino", city: "Las Vegas", state: "NV", notes: "Large slot floor. High-traffic banks matter. Verify must-hit-by language carefully.", defaultBankroll: 300, defaultStopLoss: 150, defaultStopWin: 200, defaultMachineBudget: 40, defaultTargetBet: 1.50, preferredDenominations: "penny, nickel", goodAreas: "", avoidAreas: "", observedMachineFamilies: "", playerCardReminders: "Use South Point card", redFlagNotes: "", reminderText: "Check the far east wing for bank clusters", isDefault: true },
  { id: "p2", presetName: "Southland", casinoName: "Southland Casino Hotel", city: "West Memphis", state: "AR", notes: "Mixed old/new cabinet environment. Skip anything unclear fast.", defaultBankroll: 200, defaultStopLoss: 100, defaultStopWin: 150, defaultMachineBudget: 30, defaultTargetBet: 1.00, preferredDenominations: "penny", goodAreas: "", avoidAreas: "", observedMachineFamilies: "", playerCardReminders: "", redFlagNotes: "Many machines lack clear cap display", reminderText: "", isDefault: false },
  { id: "p3", presetName: "Potawatomi", casinoName: "Potawatomi Casino Hotel", city: "Milwaukee", state: "WI", notes: "Use exact official casino name. Add floor-specific notes as you learn the layout.", defaultBankroll: 250, defaultStopLoss: 125, defaultStopWin: 175, defaultMachineBudget: 35, defaultTargetBet: 1.50, preferredDenominations: "penny, nickel", goodAreas: "", avoidAreas: "", observedMachineFamilies: "", playerCardReminders: "Bingo by the B card", redFlagNotes: "", reminderText: "", isDefault: false },
];

const SEED_LOG = [
  { id: "l1", createdAt: "3/18/2026, 10:14 AM", casinoPresetId: "p1", casinoName: "South Point Casino", machineNote: "Machine B7 corner", currentJackpot: 2180, capJackpot: 2250, percentToCap: 96.9, betAmount: 1.50, qualifies: "yes", recentReset: "no", linkedBank: "no", recommendation: "PLAY", outcome: "played-won", amountDelta: 2180, notes: "Hit after ~40 spins", photoDataUrl: null, ocrRawText: "" },
  { id: "l2", createdAt: "3/18/2026, 2:33 PM", casinoPresetId: "p1", casinoName: "South Point Casino", machineNote: "Near food court", currentJackpot: 1850, capJackpot: 2500, percentToCap: 74.0, betAmount: 1.00, qualifies: "yes", recentReset: "no", linkedBank: "no", recommendation: "SKIP", outcome: "did-not-play", amountDelta: 0, notes: "Way too far from cap", photoDataUrl: null, ocrRawText: "" },
  { id: "l3", createdAt: "3/20/2026, 6:05 PM", casinoPresetId: "p2", casinoName: "Southland Casino Hotel", machineNote: "Row 4 end machine", currentJackpot: 4710, capJackpot: 5000, percentToCap: 94.2, betAmount: 2.00, qualifies: "yes", recentReset: "no", linkedBank: "yes", recommendation: "MAYBE", outcome: "played-lost", amountDelta: -80, notes: "Tried 40 spins, no hit", photoDataUrl: null, ocrRawText: "" },
  { id: "l4", createdAt: "3/21/2026, 11:40 AM", casinoPresetId: "p3", casinoName: "Potawatomi Casino Hotel", machineNote: "Slot aisle A", currentJackpot: 990, capJackpot: 1000, percentToCap: 99.0, betAmount: 0.50, qualifies: "yes", recentReset: "no", linkedBank: "no", recommendation: "PLAY", outcome: "played-won", amountDelta: 990, notes: "Quick hit, great find", photoDataUrl: null, ocrRawText: "" },
];

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0f12", card: "#161a20", border: "#252b34", muted: "#3a424f",
  text: "#e8edf3", sub: "#8a95a3", accent: "#4fc3f7",
  green: "#2ecc71", yellow: "#f0b429", red: "#e74c3c",
  greenBg: "rgba(46,204,113,0.12)", yellowBg: "rgba(240,180,41,0.12)", redBg: "rgba(231,76,60,0.12)",
};

// ─── Style Helpers ────────────────────────────────────────────────────────────
const s = {
  app: { background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 76, maxWidth: 480, margin: "0 auto", position: "relative" },
  screen: { padding: "16px 16px 28px" },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 600, color: C.sub, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6, display: "block" },
  input: { width: "100%", background: "#1e232c", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 16, padding: "11px 12px", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#1e232c", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", resize: "vertical" },
  select: { width: "100%", background: "#1e232c", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", appearance: "none", WebkitAppearance: "none" },
  btn: (color = C.accent) => ({ display: "block", width: "100%", padding: "14px 16px", borderRadius: 10, border: `2px solid ${color}`, background: "transparent", color, fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "center", marginBottom: 10 }),
  btnSolid: (color = C.accent, textColor = "#fff") => ({ display: "block", width: "100%", padding: "14px 16px", borderRadius: 10, border: "none", background: color, color: textColor, fontSize: 16, fontWeight: 700, cursor: "pointer", textAlign: "center", marginBottom: 10 }),
  btnSm: (color = C.accent, bg = "transparent") => ({ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${color}`, background: bg, color, fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0f1318", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 14px", zIndex: 100 },
  navBtn: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? C.accent : C.sub, fontSize: 10, fontWeight: 600, padding: "4px 0" }),
  toggle: (active, color = C.accent) => ({ flex: 1, padding: "10px 4px", borderRadius: 8, border: `2px solid ${active ? color : C.border}`, background: active ? `${color}1a` : "transparent", color: active ? color : C.sub, fontWeight: 600, fontSize: 13, cursor: "pointer" }),
  progress: { width: "100%", height: 8, background: C.muted, borderRadius: 4, overflow: "hidden" },
  progressFill: (pct, color) => ({ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }),
  row: { display: "flex", gap: 8, marginBottom: 14 },
  section: { marginBottom: 16 },
  divider: { borderTop: `1px solid ${C.border}`, margin: "14px 0" },
  warn: (color = C.red) => ({ background: color === C.red ? C.redBg : C.yellowBg, border: `1px solid ${color}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, color, fontSize: 14, fontWeight: 600 }),
  chip: (active, color = C.accent) => ({ padding: "6px 12px", borderRadius: 20, border: `1px solid ${active ? color : C.border}`, background: active ? `${color}22` : "transparent", color: active ? color : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  bigRec: (rec) => {
    const map = { PLAY: [C.green, C.greenBg], MAYBE: [C.yellow, C.yellowBg], SKIP: [C.red, C.redBg], "WALK AWAY": [C.red, C.redBg], "INVALID TARGET": [C.red, C.redBg] };
    const [color, bg] = map[rec] || [C.sub, C.muted + "33"];
    return { background: bg, border: `2px solid ${color}`, borderRadius: 12, padding: "22px 16px", textAlign: "center", marginBottom: 12 };
  },
  recLabel: (rec) => {
    const map = { PLAY: C.green, MAYBE: C.yellow, SKIP: C.red, "WALK AWAY": C.red, "INVALID TARGET": C.red };
    return { fontSize: 34, fontWeight: 800, color: map[rec] || C.sub, letterSpacing: "-1px", display: "block" };
  },
  badge: (type) => {
    const map = { green: [C.green, C.greenBg], yellow: [C.yellow, C.yellowBg], red: [C.red, C.redBg], gray: [C.sub, C.muted + "44"] };
    const [color, bg] = map[type] || map.gray;
    return { display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color, letterSpacing: "0.4px" };
  },
};

const recBadgeType = (rec) => ({ PLAY: "green", MAYBE: "yellow", SKIP: "red", "INVALID TARGET": "red", "WALK AWAY": "red" }[rec] || "gray");

// ─── Shared Components ────────────────────────────────────────────────────────
function ToggleGroup({ options, value, onChange, color = C.accent }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map(o => (
        <button key={o.value} style={s.toggle(value === o.value, color)} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={s.section}>
      <label style={s.label}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Divider() { return <div style={{ borderTop: `1px solid ${C.border}`, margin: "14px 0" }} />; }

function SectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10, marginTop: 4 }}>{children}</div>;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "check", label: "Check", icon: "◎" },
  { id: "tracker", label: "Tracker", icon: "◈" },
  { id: "log", label: "Log", icon: "≡" },
  { id: "rules", label: "Rules", icon: "✓" },
];

function BottomNav({ screen, setScreen }) {
  return (
    <nav style={s.nav}>
      {NAV_ITEMS.map(n => (
        <button key={n.id} style={s.navBtn(screen === n.id)} onClick={() => setScreen(n.id)}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ screen, setScreen }) {
  const titles = { check: "New Machine Check", tree: "Quick Decision", tracker: "Session Tracker", log: "Machine Log", rules: "Quick Rules", settings: "Settings", presets: "Casino Presets", presetEdit: "Edit Preset" };
  if (screen === "home") {
    return (
      <div style={{ padding: "16px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.accent, fontWeight: 800, letterSpacing: "1px" }}>JACKPOT SCOUT</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setScreen("presets")} style={s.btnSm(C.accent)}>Presets</button>
          <button onClick={() => setScreen("settings")} style={{ background: "none", border: "none", color: C.sub, fontSize: 20, cursor: "pointer", padding: "2px 4px" }}>⚙</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>←</button>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{titles[screen] || screen}</span>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function Home({ setScreen, log, session, presets }) {
  const wins = log.filter(e => e.outcome === "played-won");
  const pl = session.active ? (Number(session.current || 0) - Number(session.start || 0)) : 0;
  const defaultPreset = presets.find(p => p.isDefault);
  const todayChecks = log.filter(e => {
    try { return new Date(e.createdAt).toDateString() === new Date().toDateString(); } catch { return false; }
  });

  const stats = [
    { label: "Bankroll", value: session.active ? fmt$(session.current) : "—", color: C.accent },
    { label: "Session P/L", value: session.active ? (pl >= 0 ? `+${fmt$(pl)}` : fmt$(pl)) : "—", color: pl >= 0 ? C.green : C.red },
    { label: "Checked", value: todayChecks.length || log.length, color: C.text },
    { label: "Wins", value: wins.length, color: C.green },
  ];

  return (
    <div style={s.screen}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Jackpot Scout</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Evaluate fast. Stay disciplined.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {stats.map(st => (
          <div key={st.label} style={{ ...s.card, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>{st.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.color }}>{st.value}</div>
          </div>
        ))}
      </div>

      {defaultPreset && (
        <div style={{ ...s.card, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>Active Preset</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{defaultPreset.presetName}</div>
            <div style={{ fontSize: 12, color: C.sub }}>{defaultPreset.casinoName} · {defaultPreset.city}, {defaultPreset.state}</div>
          </div>
          <button style={s.btnSm(C.accent)} onClick={() => setScreen("presets")}>Change</button>
        </div>
      )}

      <button style={s.btnSolid(C.accent)} onClick={() => setScreen("check")}>◎  New Machine Check</button>
      <button style={s.btn(C.accent)} onClick={() => setScreen("tree")}>⚡  Quick Decision</button>
      <button style={s.btn()} onClick={() => setScreen("tracker")}>◈  Session Tracker</button>
      <button style={s.btn()} onClick={() => setScreen("log")}>≡  Machine Log</button>
      <button style={s.btn()} onClick={() => setScreen("presets")}>★  Casino Presets</button>
      <button style={s.btn()} onClick={() => setScreen("rules")}>✓  Quick Rules</button>

      <div style={{ background: C.muted + "22", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
          This app supports evaluation and discipline. It does not predict outcomes or guarantee profit.
        </div>
      </div>
    </div>
  );
}

// ─── MACHINE CHECK ────────────────────────────────────────────────────────────
const EMPTY_CHECK = { casinoPresetId: "", casinoName: "", machineNote: "", notes: "", mustHit: "", currentJackpot: "", capJackpot: "", betAmount: "", qualifies: "", recentReset: "", linkedBank: "", denomination: "", photoDataUrl: null, ocrRawText: "" };

function MachineCheck({ log, setLog, presets, settings }) {
  const defaultPreset = presets.find(p => p.isDefault);
  const [f, setF] = useState(() => ({
    ...EMPTY_CHECK,
    casinoPresetId: defaultPreset?.id || "",
    casinoName: defaultPreset?.casinoName || "",
    betAmount: defaultPreset?.defaultTargetBet || settings.defBet || "",
  }));
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const fileRef = useRef();

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const applyPreset = (presetId) => {
    const p = presets.find(x => x.id === presetId);
    if (p) setF(prev => ({ ...prev, casinoPresetId: p.id, casinoName: p.casinoName, betAmount: p.defaultTargetBet || prev.betAmount }));
    else setF(prev => ({ ...prev, casinoPresetId: "", casinoName: "" }));
  };

  const calc = () => {
    if (f.mustHit === "no") { setResult({ rec: "INVALID TARGET", pct: null, reason: "This does not appear to be a must-hit-by machine.", warnings: ["Not a must-hit-by machine"] }); return; }
    if (!f.mustHit) { alert("Please indicate if this is a Must Hit By machine."); return; }
    if (!f.currentJackpot || !f.capJackpot) { alert("Please enter current jackpot and cap amounts."); return; }
    setResult(evaluate(f));
    setSaved(false);
  };

  const saveCheck = () => {
    if (!result) { calc(); return; }
    const entry = {
      id: uid(), createdAt: nowStr(),
      casinoPresetId: f.casinoPresetId, casinoName: f.casinoName, machineNote: f.machineNote,
      currentJackpot: Number(f.currentJackpot), capJackpot: Number(f.capJackpot),
      percentToCap: result.pct ? Number(result.pct.toFixed(1)) : null,
      betAmount: Number(f.betAmount), qualifies: f.qualifies, recentReset: f.recentReset,
      linkedBank: f.linkedBank, recommendation: result.rec, outcome: "did-not-play",
      amountDelta: 0, notes: f.notes, photoDataUrl: f.photoDataUrl, ocrRawText: ocrText,
    };
    const next = [entry, ...log];
    setLog(next); LS.set("js_log", next); setSaved(true);
  };

  const clear = () => {
    const p = presets.find(x => x.isDefault);
    setF({ ...EMPTY_CHECK, casinoPresetId: p?.id || "", casinoName: p?.casinoName || "", betAmount: p?.defaultTargetBet || settings.defBet || "" });
    setResult(null); setSaved(false); setOcrText("");
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      set("photoDataUrl", dataUrl);
      if (settings.ocrEnabled !== false) {
        setOcrLoading(true);
        try {
          const { createWorker } = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
          const worker = await createWorker("eng");
          const { data: { text } } = await worker.recognize(dataUrl);
          await worker.terminate();
          setOcrText(text);
          // Try to parse values
          const numMatches = text.match(/\$?([\d,]+\.?\d*)/g) || [];
          const nums = numMatches.map(m => parseFloat(m.replace(/[$,]/g, ""))).filter(n => n > 0).sort((a, b) => b - a);
          if (nums.length >= 1 && !f.currentJackpot) set("currentJackpot", String(nums[0]));
          if (nums.length >= 2 && !f.capJackpot) set("capJackpot", String(nums[1] > nums[0] ? nums[1] : nums[0]));
          const lower = text.toLowerCase();
          if ((lower.includes("must hit") || lower.includes("must award")) && !f.mustHit) set("mustHit", "yes");
        } catch {
          setOcrText("OCR unavailable. Please enter values manually.");
        }
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const recColor = result ? ({ PLAY: C.green, MAYBE: C.yellow }[result.rec] || C.red) : C.sub;

  return (
    <div style={s.screen}>
      <SectionTitle>Casino</SectionTitle>
      <Field label="Casino Preset">
        <select style={s.select} value={f.casinoPresetId} onChange={e => applyPreset(e.target.value)}>
          <option value="">— Select preset —</option>
          {presets.map(p => <option key={p.id} value={p.id}>{p.presetName} · {p.city}</option>)}
        </select>
      </Field>
      <Field label="Casino Name">
        <input style={s.input} value={f.casinoName} onChange={e => set("casinoName", e.target.value)} placeholder="e.g. South Point Casino" />
      </Field>
      <Field label="Machine Note (optional)">
        <input style={s.input} value={f.machineNote} onChange={e => set("machineNote", e.target.value)} placeholder="e.g. Row B near entrance" />
      </Field>

      <Divider />
      <SectionTitle>Photo / OCR</SectionTitle>
      <button style={s.btn(C.accent)} onClick={() => fileRef.current?.click()}>📷  Scan From Photo</button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
      {ocrLoading && <div style={{ ...s.card, textAlign: "center", color: C.accent }}>Reading display…</div>}
      {f.photoDataUrl && <img src={f.photoDataUrl} alt="Machine" style={{ width: "100%", borderRadius: 10, marginBottom: 12, maxHeight: 180, objectFit: "cover" }} />}
      {ocrText !== "" && (
        <Field label="OCR Text (review before saving)" hint="Review OCR results before saving. Values may need correction.">
          <textarea style={s.textarea} rows={3} value={ocrText} onChange={e => setOcrText(e.target.value)} />
        </Field>
      )}

      <Divider />
      <SectionTitle>Machine Details</SectionTitle>
      <Field label="Says Must Hit By / Must Award By?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]} value={f.mustHit} onChange={v => set("mustHit", v)} color={f.mustHit === "yes" ? C.green : f.mustHit === "no" ? C.red : C.accent} />
      </Field>

      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Current Jackpot ($)</label>
          <input style={s.input} type="number" inputMode="decimal" value={f.currentJackpot} onChange={e => set("currentJackpot", e.target.value)} placeholder="0.00" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Cap Amount ($)</label>
          <input style={s.input} type="number" inputMode="decimal" value={f.capJackpot} onChange={e => set("capJackpot", e.target.value)} placeholder="0.00" />
        </div>
      </div>

      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Bet per Spin ($)</label>
          <input style={s.input} type="number" inputMode="decimal" value={f.betAmount} onChange={e => set("betAmount", e.target.value)} placeholder="1.50" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Denomination</label>
          <select style={s.select} value={f.denomination} onChange={e => set("denomination", e.target.value)}>
            <option value="">—</option>
            {["Penny", "Nickel", "Dime", "Quarter", "$0.50", "$1", "$5"].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <Field label="Bet qualifies for major prize?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unknown", value: "unknown" }]} value={f.qualifies} onChange={v => set("qualifies", v)} />
      </Field>
      <Field label="Looks recently reset?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unsure", value: "unsure" }]} value={f.recentReset} onChange={v => set("recentReset", v)} />
      </Field>
      <Field label="Linked bank of machines?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unsure", value: "unsure" }]} value={f.linkedBank} onChange={v => set("linkedBank", v)} />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={s.textarea} rows={2} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Any observations..." />
      </Field>

      <div style={s.row}>
        <button style={{ ...s.btnSolid(C.accent), flex: 1, marginBottom: 0 }} onClick={calc}>Calculate</button>
        <button style={{ ...s.btn(C.sub), flex: 1, marginBottom: 0 }} onClick={clear}>Clear</button>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={s.bigRec(result.rec)}>
            <span style={s.recLabel(result.rec)}>{result.rec}</span>
            {result.pct !== null && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 5 }}>Percent to major prize cap</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: recColor }}>{fmtPct(result.pct)}</div>
                <div style={{ ...s.progress, marginTop: 8 }}><div style={s.progressFill(result.pct, recColor)} /></div>
              </div>
            )}
            <div style={{ fontSize: 14, color: C.sub, marginTop: 14, lineHeight: 1.6 }}>{result.reason}</div>
            {result.warnings?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
                {result.warnings.map(w => <span key={w} style={s.badge("yellow")}>⚠ {w}</span>)}
              </div>
            )}
          </div>
          <button style={s.btn(saved ? C.green : C.sub)} onClick={saveCheck} disabled={saved}>
            {saved ? "✓ Saved to Log" : "Save to Machine Log"}
          </button>
        </div>
      )}
      {!result && <button style={{ ...s.btnSolid(C.green), marginTop: 8 }} onClick={saveCheck}>Save Check</button>}
    </div>
  );
}

// ─── QUICK DECISION TREE ──────────────────────────────────────────────────────
const TREE_Q = [
  { q: "Does it clearly say Must Hit By or Must Award By?", yes: 1, no: "WALK AWAY", noReason: "Only evaluate machines with clear must-hit-by language." },
  { q: "Can you see both the current amount and the cap?", yes: 2, no: "WALK AWAY", noReason: "You need both numbers to evaluate. Walk away." },
  { q: "Is the current major prize at least 90% of the cap?", yes: 3, no: "WALK AWAY", noReason: "Under 90% of the major prize cap is generally not worth the risk." },
  { q: "Does your bet qualify for the major prize?", yes: 4, no: "WALK AWAY", noReason: "If your bet doesn't qualify, you can't win the major prize." },
  { q: "Does the machine appear recently reset?", yes: "WALK AWAY", yesReason: "Recently reset machines are far from the major prize cap. Skip it.", no: "PLAY", noReason: "This machine passes all checks. It's a valid candidate." },
];

function QuickDecision() {
  const [step, setStep] = useState(0);
  const [final, setFinal] = useState(null);
  const [reason, setReason] = useState("");

  const answer = (choice) => {
    const q = TREE_Q[step];
    if (choice === "yes") {
      if (typeof q.yes === "number") setStep(q.yes);
      else { setFinal(q.yes); setReason(q.yesReason || ""); }
    } else {
      if (q.no === "WALK AWAY") { setFinal("WALK AWAY"); setReason(q.noReason); }
      else if (q.no === "PLAY") { setFinal("PLAY"); setReason(q.noReason); }
    }
  };

  const reset = () => { setStep(0); setFinal(null); setReason(""); };

  if (final) {
    return (
      <div style={s.screen}>
        <div style={{ ...s.bigRec(final), padding: "32px 20px" }}>
          <span style={s.recLabel(final)}>{final}</span>
          <div style={{ fontSize: 15, color: C.sub, marginTop: 14, lineHeight: 1.6 }}>{reason}</div>
        </div>
        <button style={s.btn(C.accent)} onClick={reset}>Start Over</button>
      </div>
    );
  }

  const q = TREE_Q[step];
  const pct = (step / TREE_Q.length) * 100;

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Question {step + 1} of {TREE_Q.length}</div>
      <div style={s.progress}><div style={s.progressFill(pct, C.accent)} /></div>
      <div style={{ ...s.card, marginTop: 20, minHeight: 100, display: "flex", alignItems: "center", padding: "24px 18px" }}>
        <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.5 }}>{q.q}</div>
      </div>
      <button style={s.btnSolid(C.green)} onClick={() => answer("yes")}>Yes</button>
      <button style={s.btnSolid(C.red)} onClick={() => answer("no")}>No</button>
      <button style={s.btn(C.sub)} onClick={reset}>Restart</button>
    </div>
  );
}

// ─── SESSION TRACKER ──────────────────────────────────────────────────────────
function SessionTracker({ session, setSession, presets, settings }) {
  const defaultPreset = presets.find(p => p.isDefault);
  const [form, setForm] = useState({
    start: session.start || defaultPreset?.defaultBankroll || settings.defBankroll || "",
    stopLoss: session.stopLoss || defaultPreset?.defaultStopLoss || settings.defStopLoss || "",
    stopWin: session.stopWin || defaultPreset?.defaultStopWin || settings.defStopWin || "",
    machineBudget: session.machineBudget || defaultPreset?.defaultMachineBudget || settings.defMachineBudget || "",
    current: session.current || "",
    notes: session.notes || "",
  });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = (updates) => {
    const next = { ...session, ...updates };
    setSession(next); LS.set("js_session", next);
  };

  const startSession = () => save({ ...form, active: true, startTime: nowStr() });
  const updateSession = () => save({ current: form.current, notes: form.notes });
  const endSession = () => save({ active: false, endTime: nowStr() });

  const quickAdd = (delta) => {
    const newVal = (Number(form.current || session.current || session.start) + delta).toFixed(2);
    setF("current", newVal);
    save({ current: newVal });
  };

  const pl = session.active ? (Number(session.current || form.current || 0) - Number(session.start || 0)) : 0;
  const lossUsed = Math.max(0, -pl);
  const lossLimit = Number(session.stopLoss || form.stopLoss) || 1;
  const winTarget = Number(session.stopWin || form.stopWin) || 1;
  const lossHit = session.active && lossUsed >= lossLimit;
  const winHit = session.active && pl >= winTarget;

  return (
    <div style={s.screen}>
      {lossHit && <div style={s.warn(C.red)}>🛑 Session limit reached. Stop now.</div>}
      {winHit && !lossHit && <div style={s.warn(C.yellow)}>🎯 You hit your target. Consider cashing out.</div>}

      {session.active && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Bankroll</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{fmt$(session.current || session.start)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>P / L</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: pl >= 0 ? C.green : C.red }}>{pl >= 0 ? "+" : ""}{fmt$(pl)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[20, 50, 100].map(n => (
              <button key={`+${n}`} style={{ ...s.btnSm(C.green), flex: 1 }} onClick={() => quickAdd(n)}>+${n}</button>
            ))}
            {[20, 50].map(n => (
              <button key={`-${n}`} style={{ ...s.btnSm(C.red), flex: 1 }} onClick={() => quickAdd(-n)}>-${n}</button>
            ))}
          </div>
          <Divider />
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>Loss — {fmt$(lossUsed)} of {fmt$(lossLimit)}</div>
          <div style={s.progress}><div style={s.progressFill((lossUsed / lossLimit) * 100, lossHit ? C.red : C.yellow)} /></div>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, textTransform: "uppercase", margin: "10px 0 5px" }}>Win Progress — {fmt$(Math.max(0, pl))} of {fmt$(winTarget)}</div>
          <div style={s.progress}><div style={s.progressFill((Math.max(0, pl) / winTarget) * 100, C.green)} /></div>
          {form.machineBudget && <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>Per-machine budget: {fmt$(form.machineBudget)}</div>}
        </div>
      )}

      <Field label="Starting Bankroll ($)">
        <input style={s.input} type="number" inputMode="decimal" value={form.start} onChange={e => setF("start", e.target.value)} placeholder="e.g. 200" disabled={session.active} />
      </Field>
      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Stop-Loss ($)</label>
          <input style={s.input} type="number" inputMode="decimal" value={form.stopLoss} onChange={e => setF("stopLoss", e.target.value)} placeholder="e.g. 100" disabled={session.active} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Stop-Win ($)</label>
          <input style={s.input} type="number" inputMode="decimal" value={form.stopWin} onChange={e => setF("stopWin", e.target.value)} placeholder="e.g. 150" disabled={session.active} />
        </div>
      </div>
      <Field label="Per-Machine Budget ($)">
        <input style={s.input} type="number" inputMode="decimal" value={form.machineBudget} onChange={e => setF("machineBudget", e.target.value)} placeholder="e.g. 40" disabled={session.active} />
      </Field>
      {session.active && (
        <Field label="Current Cash on Hand ($)">
          <input style={s.input} type="number" inputMode="decimal" value={form.current} onChange={e => setF("current", e.target.value)} placeholder="0.00" />
        </Field>
      )}
      <Field label="Notes">
        <textarea style={s.textarea} rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Session notes..." />
      </Field>

      {!session.active
        ? <button style={s.btnSolid(C.green)} onClick={startSession}>Start Session</button>
        : <>
          <button style={s.btnSolid(C.accent)} onClick={updateSession}>Update Session</button>
          <button style={s.btn(C.red)} onClick={endSession}>End Session</button>
        </>
      }
    </div>
  );
}

// ─── MACHINE LOG ──────────────────────────────────────────────────────────────
const OUTCOME_LABELS = { "did-not-play": "Skipped", "played-won": "Won", "played-lost": "Lost" };
const OUTCOME_COLOR = { "did-not-play": C.sub, "played-won": C.green, "played-lost": C.red };

function MachineLog({ log, setLog }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState(null);

  const filtered = log.filter(e => {
    if (filter === "played") return e.outcome !== "did-not-play";
    if (filter === "won") return e.outcome === "played-won";
    if (filter === "skipped") return e.outcome === "did-not-play";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "pct") return (b.percentToCap || 0) - (a.percentToCap || 0);
    if (sort === "win") return (b.amountDelta || 0) - (a.amountDelta || 0);
    return 0;
  });

  const update = (id, changes) => {
    const next = log.map(e => e.id === id ? { ...e, ...changes } : e);
    setLog(next); LS.set("js_log", next);
  };
  const del = (id) => { if (!window.confirm("Delete this entry?")) return; const next = log.filter(e => e.id !== id); setLog(next); LS.set("js_log", next); setEditing(null); };

  const wins = log.filter(e => e.outcome === "played-won" && e.percentToCap);
  const avgWinPct = wins.length ? (wins.reduce((a, e) => a + e.percentToCap, 0) / wins.length).toFixed(1) : null;
  const totalWinAmount = wins.reduce((a, e) => a + (e.amountDelta || 0), 0);
  const ignoredRec = log.filter(e => ["SKIP", "INVALID TARGET"].includes(e.recommendation) && e.outcome !== "did-not-play").length;

  return (
    <div style={s.screen}>
      {(avgWinPct || ignoredRec > 0) && (
        <div style={{ ...s.card, display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Total Checks</div><div style={{ fontSize: 18, fontWeight: 700 }}>{log.length}</div></div>
          <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Wins</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{wins.length}</div></div>
          {avgWinPct && <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Avg % at Win</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{avgWinPct}%</div></div>}
          {ignoredRec > 0 && <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Skipped Rec</div><div style={{ fontSize: 18, fontWeight: 700, color: C.yellow }}>{ignoredRec}×</div></div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
        {["all", "played", "won", "skipped"].map(f => <button key={f} style={s.chip(filter === f)} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["newest", "Newest"], ["pct", "% to Cap"], ["win", "Largest Win"]].map(([v, l]) => (
          <button key={v} style={s.chip(sort === v, C.yellow)} onClick={() => setSort(v)}>{l}</button>
        ))}
      </div>

      {sorted.length === 0 && <div style={{ color: C.sub, textAlign: "center", marginTop: 40 }}>No entries yet.</div>}

      {sorted.map(e => (
        <div key={e.id} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{e.casinoName || "Unknown Casino"}</div>
              {e.machineNote && <div style={{ fontSize: 12, color: C.sub }}>{e.machineNote}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.createdAt}</div>
            </div>
            <span style={s.badge(recBadgeType(e.recommendation))}>{e.recommendation}</span>
          </div>

          {e.photoDataUrl && <img src={e.photoDataUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 120, objectFit: "cover" }} />}

          <div style={{ display: "flex", gap: 12, fontSize: 13, color: C.sub, marginBottom: 10, flexWrap: "wrap" }}>
            {e.percentToCap !== null && <span style={{ color: C.accent, fontWeight: 700 }}>{fmtPct(e.percentToCap)}</span>}
            {e.currentJackpot > 0 && <span>{fmt$(e.currentJackpot)} / {fmt$(e.capJackpot)}</span>}
            {e.betAmount > 0 && <span>Bet: {fmt$(e.betAmount)}</span>}
          </div>

          {editing === e.id ? (
            <>
              <Field label="Outcome">
                <ToggleGroup options={[{ label: "Skipped", value: "did-not-play" }, { label: "Lost", value: "played-lost" }, { label: "Won", value: "played-won" }]} value={e.outcome} onChange={v => update(e.id, { outcome: v })} />
              </Field>
              {e.outcome !== "did-not-play" && (
                <Field label="Amount ($)">
                  <input style={s.input} type="number" inputMode="decimal" defaultValue={Math.abs(e.amountDelta)} onBlur={ev => update(e.id, { amountDelta: e.outcome === "played-won" ? Number(ev.target.value) : -Math.abs(Number(ev.target.value)) })} />
                </Field>
              )}
              <Field label="Notes">
                <textarea style={s.textarea} rows={2} defaultValue={e.notes} onBlur={ev => update(e.id, { notes: ev.target.value })} />
              </Field>
              <div style={s.row}>
                <button style={{ ...s.btnSolid(C.accent), flex: 1, marginBottom: 0 }} onClick={() => setEditing(null)}>Done</button>
                <button style={{ ...s.btn(C.red), flex: 1, marginBottom: 0 }} onClick={() => del(e.id)}>Delete</button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: OUTCOME_COLOR[e.outcome] }}>
                {OUTCOME_LABELS[e.outcome]}{e.amountDelta !== 0 ? ` (${e.amountDelta > 0 ? "+" : ""}${fmt$(e.amountDelta)})` : ""}
              </span>
              <button style={s.btnSm(C.sub)} onClick={() => setEditing(e.id)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CASINO PRESETS ───────────────────────────────────────────────────────────
const EMPTY_PRESET = { presetName: "", casinoName: "", city: "", state: "", notes: "", defaultBankroll: "", defaultStopLoss: "", defaultStopWin: "", defaultMachineBudget: "", defaultTargetBet: "", preferredDenominations: "", goodAreas: "", avoidAreas: "", observedMachineFamilies: "", playerCardReminders: "", redFlagNotes: "", reminderText: "", isDefault: false };

function CasinoPresets({ presets, setPresets }) {
  const [editing, setEditing] = useState(null); // preset id or "new"
  const [form, setForm] = useState(EMPTY_PRESET);

  const save$ = (data) => { setPresets(data); LS.set("js_presets", data); };

  const startNew = () => { setForm({ ...EMPTY_PRESET, id: uid() }); setEditing("new"); };
  const startEdit = (p) => { setForm({ ...p }); setEditing(p.id); };
  const duplicate = (p) => { const n = { ...p, id: uid(), presetName: p.presetName + " (copy)", isDefault: false }; save$([...presets, n]); };
  const setDefault = (id) => save$(presets.map(p => ({ ...p, isDefault: p.id === id })));
  const del = (id) => { if (!window.confirm("Delete this preset?")) return; save$(presets.filter(p => p.id !== id)); };

  const saveForm = () => {
    if (!form.presetName) { alert("Preset name is required."); return; }
    let next;
    if (editing === "new") next = [...presets, form];
    else next = presets.map(p => p.id === form.id ? form : p);
    if (form.isDefault) next = next.map(p => ({ ...p, isDefault: p.id === form.id }));
    save$(next); setEditing(null);
  };

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (editing) {
    return (
      <div style={s.screen}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing === "new" ? "New Preset" : "Edit Preset"}</div>

        <SectionTitle>Identity</SectionTitle>
        <Field label="Preset Name *"><input style={s.input} value={form.presetName} onChange={e => setF("presetName", e.target.value)} placeholder="e.g. South Point" /></Field>
        <Field label="Casino Name"><input style={s.input} value={form.casinoName} onChange={e => setF("casinoName", e.target.value)} placeholder="Full official name" /></Field>
        <div style={s.row}>
          <div style={{ flex: 1 }}><label style={s.label}>City</label><input style={s.input} value={form.city} onChange={e => setF("city", e.target.value)} placeholder="Las Vegas" /></div>
          <div style={{ flex: 1 }}><label style={s.label}>State</label><input style={s.input} value={form.state} onChange={e => setF("state", e.target.value)} placeholder="NV" /></div>
        </div>
        <Field label="Notes"><textarea style={s.textarea} rows={3} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="General observations..." /></Field>

        <Divider />
        <SectionTitle>Default Values</SectionTitle>
        <div style={s.row}>
          <div style={{ flex: 1 }}><label style={s.label}>Bankroll ($)</label><input style={s.input} type="number" inputMode="decimal" value={form.defaultBankroll} onChange={e => setF("defaultBankroll", e.target.value)} placeholder="200" /></div>
          <div style={{ flex: 1 }}><label style={s.label}>Stop-Loss ($)</label><input style={s.input} type="number" inputMode="decimal" value={form.defaultStopLoss} onChange={e => setF("defaultStopLoss", e.target.value)} placeholder="100" /></div>
        </div>
        <div style={s.row}>
          <div style={{ flex: 1 }}><label style={s.label}>Stop-Win ($)</label><input style={s.input} type="number" inputMode="decimal" value={form.defaultStopWin} onChange={e => setF("defaultStopWin", e.target.value)} placeholder="150" /></div>
          <div style={{ flex: 1 }}><label style={s.label}>Machine Budget ($)</label><input style={s.input} type="number" inputMode="decimal" value={form.defaultMachineBudget} onChange={e => setF("defaultMachineBudget", e.target.value)} placeholder="40" /></div>
        </div>
        <Field label="Target Bet ($)"><input style={s.input} type="number" inputMode="decimal" value={form.defaultTargetBet} onChange={e => setF("defaultTargetBet", e.target.value)} placeholder="1.50" /></Field>
        <Field label="Preferred Denominations"><input style={s.input} value={form.preferredDenominations} onChange={e => setF("preferredDenominations", e.target.value)} placeholder="penny, nickel" /></Field>

        <Divider />
        <SectionTitle>Floor Notes</SectionTitle>
        <Field label="Good Areas"><textarea style={s.textarea} rows={2} value={form.goodAreas} onChange={e => setF("goodAreas", e.target.value)} placeholder="Areas worth checking..." /></Field>
        <Field label="Avoid Areas"><textarea style={s.textarea} rows={2} value={form.avoidAreas} onChange={e => setF("avoidAreas", e.target.value)} placeholder="Areas to skip..." /></Field>
        <Field label="Observed Machine Families"><textarea style={s.textarea} rows={2} value={form.observedMachineFamilies} onChange={e => setF("observedMachineFamilies", e.target.value)} placeholder="e.g. Dragon Link, Lightning Cash..." /></Field>
        <Field label="Player Card Reminders"><input style={s.input} value={form.playerCardReminders} onChange={e => setF("playerCardReminders", e.target.value)} placeholder="e.g. Use Gold card" /></Field>
        <Field label="Red Flag Notes"><textarea style={s.textarea} rows={2} value={form.redFlagNotes} onChange={e => setF("redFlagNotes", e.target.value)} placeholder="Things to watch out for..." /></Field>
        <Field label="Reminder Text"><input style={s.input} value={form.reminderText} onChange={e => setF("reminderText", e.target.value)} placeholder="Quick reminder shown on check screen" /></Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setF("isDefault", e.target.checked)} style={{ width: 18, height: 18 }} />
          <label htmlFor="isDefault" style={{ fontSize: 14, color: C.text, cursor: "pointer" }}>Set as default preset</label>
        </div>

        <button style={s.btnSolid(C.accent)} onClick={saveForm}>Save Preset</button>
        <button style={s.btn(C.sub)} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={s.screen}>
      <button style={s.btnSolid(C.accent)} onClick={startNew}>+ New Preset</button>
      {presets.length === 0 && <div style={{ color: C.sub, textAlign: "center", marginTop: 30 }}>No presets yet.</div>}
      {presets.map(p => (
        <div key={p.id} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.presetName}</div>
                {p.isDefault && <span style={s.badge("green")}>Default</span>}
              </div>
              <div style={{ fontSize: 13, color: C.sub }}>{p.casinoName}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{p.city}, {p.state}</div>
            </div>
          </div>
          {p.reminderText && <div style={{ fontSize: 13, color: C.yellow, marginBottom: 8 }}>💡 {p.reminderText}</div>}
          {p.notes && <div style={{ fontSize: 13, color: C.sub, marginBottom: 10, lineHeight: 1.5 }}>{p.notes}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={s.btnSm(C.accent)} onClick={() => startEdit(p)}>Edit</button>
            <button style={s.btnSm(C.sub)} onClick={() => duplicate(p)}>Duplicate</button>
            {!p.isDefault && <button style={s.btnSm(C.green)} onClick={() => setDefault(p.id)}>Set Default</button>}
            {!p.isDefault && <button style={s.btnSm(C.red)} onClick={() => del(p.id)}>Delete</button>}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
        Presets store your personal notes and defaults. They do not reflect real-time casino data.
      </div>
    </div>
  );
}

// ─── QUICK RULES ──────────────────────────────────────────────────────────────
const RULES = [
  "Only play machines that clearly say Must Hit By or Must Award By",
  "Always confirm both the current major prize amount and the cap",
  "95%+ of the major prize cap is the strongest candidate signal",
  "90%–94.9% of the major prize cap is borderline — weigh carefully",
  "Under 90% of the major prize cap is generally a skip",
  "Confirm your bet qualifies for the major prize",
  "Avoid machines that appear recently reset",
  "Set a per-machine budget before you sit",
  "Set a session stop-loss and stick to it",
  "Win and consider leaving",
];

function QuickRules() {
  return (
    <div style={s.screen}>
      <div style={s.card}>
        {RULES.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderBottom: i < RULES.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={{ color: C.green, fontWeight: 700, fontSize: 14, minWidth: 18 }}>✓</span>
            <span style={{ fontSize: 15, lineHeight: 1.5 }}>{r}</span>
          </div>
        ))}
      </div>
      <div style={{ background: C.muted + "22", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Disclaimer</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>This app supports discipline and observation. It does not predict outcomes or guarantee profit. All gambling involves risk. Play responsibly.</div>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ settings, setSettings }) {
  const setF = (k, v) => { const n = { ...settings, [k]: v }; setSettings(n); LS.set("js_settings", n); };

  const exportData = () => {
    const data = { settings, log: LS.get("js_log", []), session: LS.get("js_session", {}), presets: LS.get("js_presets", []) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "jackpot-scout-backup.json"; a.click();
  };

  const importData = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.settings) { LS.set("js_settings", d.settings); }
        if (d.log) LS.set("js_log", d.log);
        if (d.session) LS.set("js_session", d.session);
        if (d.presets) LS.set("js_presets", d.presets);
        alert("Data imported. Reloading..."); window.location.reload();
      } catch { alert("Import failed. Check file format."); }
    };
    r.readAsText(file);
  };

  const reset = () => { if (!window.confirm("Reset ALL app data? Cannot be undone.")) return; localStorage.clear(); window.location.reload(); };
  const importRef = useRef();

  return (
    <div style={s.screen}>
      <SectionTitle>Defaults</SectionTitle>
      <Field label="Default Bankroll ($)"><input style={s.input} type="number" inputMode="decimal" value={settings.defBankroll || ""} onChange={e => setF("defBankroll", e.target.value)} placeholder="200" /></Field>
      <div style={s.row}>
        <div style={{ flex: 1 }}><label style={s.label}>Stop-Loss ($)</label><input style={s.input} type="number" inputMode="decimal" value={settings.defStopLoss || ""} onChange={e => setF("defStopLoss", e.target.value)} placeholder="100" /></div>
        <div style={{ flex: 1 }}><label style={s.label}>Stop-Win ($)</label><input style={s.input} type="number" inputMode="decimal" value={settings.defStopWin || ""} onChange={e => setF("defStopWin", e.target.value)} placeholder="150" /></div>
      </div>
      <Field label="Per-Machine Budget ($)"><input style={s.input} type="number" inputMode="decimal" value={settings.defMachineBudget || ""} onChange={e => setF("defMachineBudget", e.target.value)} placeholder="40" /></Field>
      <Field label="Target Bet ($)"><input style={s.input} type="number" inputMode="decimal" value={settings.defBet || ""} onChange={e => setF("defBet", e.target.value)} placeholder="1.50" /></Field>

      <Divider />
      <SectionTitle>OCR</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>OCR Photo Scanning</div>
          <div style={{ fontSize: 12, color: C.sub }}>Attempt to read major prize amounts from photos</div>
        </div>
        <button style={{ ...s.btnSm(settings.ocrEnabled !== false ? C.green : C.sub, settings.ocrEnabled !== false ? C.greenBg : "transparent"), minWidth: 56 }} onClick={() => setF("ocrEnabled", settings.ocrEnabled === false ? true : false)}>
          {settings.ocrEnabled !== false ? "ON" : "OFF"}
        </button>
      </div>

      <Divider />
      <SectionTitle>Data</SectionTitle>
      <button style={s.btn(C.accent)} onClick={exportData}>Export Data (JSON)</button>
      <button style={s.btn(C.accent)} onClick={() => importRef.current?.click()}>Import Data (JSON)</button>
      <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={importData} />
      <button style={s.btn(C.red)} onClick={reset}>Reset All App Data</button>
      <div style={{ fontSize: 12, color: C.sub, textAlign: "center" }}>This clears all logs, sessions, presets, and settings.</div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [log, setLog] = useState(() => LS.get("js_log", SEED_LOG));
  const [session, setSession] = useState(() => LS.get("js_session", {}));
  const [settings, setSettings] = useState(() => LS.get("js_settings", { ocrEnabled: true }));
  const [presets, setPresets] = useState(() => LS.get("js_presets", SEED_PRESETS));

  const screenMap = {
    home: <Home setScreen={setScreen} log={log} session={session} presets={presets} />,
    check: <MachineCheck log={log} setLog={setLog} presets={presets} settings={settings} />,
    tree: <QuickDecision />,
    tracker: <SessionTracker session={session} setSession={setSession} presets={presets} settings={settings} />,
    log: <MachineLog log={log} setLog={setLog} />,
    presets: <CasinoPresets presets={presets} setPresets={setPresets} />,
    rules: <QuickRules />,
    settings: <Settings settings={settings} setSettings={setSettings} />,
  };

  return (
    <div style={s.app}>
      <Header screen={screen} setScreen={setScreen} />
      <div key={screen}>{screenMap[screen] || screenMap.home}</div>
      <BottomNav screen={screen} setScreen={setScreen} />
    </div>
  );
}