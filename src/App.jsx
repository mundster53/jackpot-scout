import { useState, useEffect } from "react";

// ─── Utilities ────────────────────────────────────────────────────────────────

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const fmt$ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;
const now = () => new Date().toLocaleString();

const SEED_LOG = [
  { id: 1, date: "3/18/2026, 10:14 AM", casino: "Riverside Casino", note: "Machine B7 corner", current: 2180, cap: 2250, pct: 96.9, bet: 1.50, rec: "PLAY", outcome: "played-won", amount: 2180, notes: "Hit after ~40 spins" },
  { id: 2, date: "3/18/2026, 2:33 PM", casino: "Riverside Casino", note: "Near food court", current: 1850, cap: 2500, pct: 74.0, bet: 1.00, rec: "SKIP", outcome: "did-not-play", amount: 0, notes: "Way too far from cap" },
  { id: 3, date: "3/20/2026, 6:05 PM", casino: "Gold Eagle", note: "Row 4 end machine", current: 4710, cap: 5000, pct: 94.2, bet: 2.00, rec: "MAYBE", outcome: "played-lost", amount: -80, notes: "Tried 40 spins, no hit" },
  { id: 4, date: "3/21/2026, 11:40 AM", casino: "Gold Eagle", note: "Slot aisle A", current: 990, cap: 1000, pct: 99.0, bet: 0.50, rec: "PLAY", outcome: "played-won", amount: 990, notes: "Quick hit, great find" },
];

// ─── Theme & Styles ───────────────────────────────────────────────────────────

const C = {
  bg: "#0d0f12",
  card: "#161a20",
  border: "#252b34",
  muted: "#3a424f",
  text: "#e8edf3",
  sub: "#8a95a3",
  accent: "#4fc3f7",
  green: "#2ecc71",
  yellow: "#f0b429",
  red: "#e74c3c",
  greenBg: "rgba(46,204,113,0.12)",
  yellowBg: "rgba(240,180,41,0.12)",
  redBg: "rgba(231,76,60,0.12)",
};

const s = {
  app: { background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", paddingBottom: 72, maxWidth: 480, margin: "0 auto", position: "relative" },
  header: { padding: "20px 20px 8px", borderBottom: `1px solid ${C.border}` },
  title: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", color: C.text },
  sub: { fontSize: 13, color: C.sub, marginTop: 2 },
  screen: { padding: "16px 16px 24px" },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 600, color: C.sub, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6, display: "block" },
  input: { width: "100%", background: "#1e232c", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 16, padding: "10px 12px", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#1e232c", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", resize: "vertical" },
  btn: (color = C.accent, bg = "transparent") => ({ display: "block", width: "100%", padding: "14px 16px", borderRadius: 10, border: `2px solid ${color}`, background: bg, color: color, fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "center", marginBottom: 10 }),
  btnSolid: (color = C.accent) => ({ display: "block", width: "100%", padding: "14px 16px", borderRadius: 10, border: "none", background: color, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", textAlign: "center", marginBottom: 10 }),
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#111519", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100 },
  navBtn: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? C.accent : C.sub, fontSize: 10, fontWeight: 600, padding: "4px 0" }),
  badge: (color) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color === "green" ? C.greenBg : color === "yellow" ? C.yellowBg : C.redBg, color: color === "green" ? C.green : color === "yellow" ? C.yellow : C.red, letterSpacing: "0.5px" }),
  bigRec: (rec) => {
    const map = { PLAY: [C.green, C.greenBg], MAYBE: [C.yellow, C.yellowBg], SKIP: [C.red, C.redBg], "WALK AWAY": [C.red, C.redBg], "INVALID TARGET": [C.red, C.redBg] };
    const [color, bg] = map[rec] || [C.sub, C.muted];
    return { background: bg, border: `2px solid ${color}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", marginBottom: 12 };
  },
  recLabel: (rec) => {
    const map = { PLAY: C.green, MAYBE: C.yellow, SKIP: C.red, "WALK AWAY": C.red, "INVALID TARGET": C.red };
    return { fontSize: 32, fontWeight: 800, color: map[rec] || C.sub, letterSpacing: "-1px", display: "block" };
  },
  toggle: (active, color = C.accent) => ({ flex: 1, padding: "10px 6px", borderRadius: 8, border: `2px solid ${active ? color : C.border}`, background: active ? (color === C.green ? C.greenBg : color === C.red ? C.redBg : "rgba(79,195,247,0.12)") : "transparent", color: active ? color : C.sub, fontWeight: 600, fontSize: 14, cursor: "pointer" }),
  progress: { width: "100%", height: 8, background: C.muted, borderRadius: 4, overflow: "hidden" },
  progressFill: (pct, color) => ({ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }),
  row: { display: "flex", gap: 8, marginBottom: 14 },
  section: { marginBottom: 16 },
  divider: { borderTop: `1px solid ${C.border}`, margin: "12px 0" },
  warn: (color = C.red) => ({ background: color === C.red ? C.redBg : C.yellowBg, border: `1px solid ${color === C.red ? C.red : C.yellow}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, color: color === C.red ? C.red : C.yellow, fontSize: 14, fontWeight: 600 }),
  chip: (active, color = C.accent) => ({ padding: "6px 12px", borderRadius: 20, border: `1px solid ${active ? color : C.border}`, background: active ? `${color}22` : "transparent", color: active ? color : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }),
};

// ─── Toggle Group ─────────────────────────────────────────────────────────────

function ToggleGroup({ options, value, onChange, color = C.accent }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map(o => (
        <button key={o.value} style={s.toggle(value === o.value, color)} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={s.section}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "check", label: "Check", icon: "◎" },
  { id: "tracker", label: "Tracker", icon: "◈" },
  { id: "log", label: "Log", icon: "≡" },
  { id: "rules", label: "Rules", icon: "✓" },
];

function Nav({ screen, setScreen }) {
  return (
    <nav style={s.nav}>
      {NAV.map(n => (
        <button key={n.id} style={s.navBtn(screen === n.id)} onClick={() => setScreen(n.id)}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home({ setScreen, log, session }) {
  const todayLog = log.filter(e => new Date(e.date).toDateString() === new Date().toDateString());
  const wins = log.filter(e => e.outcome === "played-won");
  const pl = session.active ? (Number(session.current) - Number(session.start)) : 0;

  const stats = [
    { label: "Today's Bankroll", value: session.active ? fmt$(session.current) : "—", color: C.accent },
    { label: "Session P/L", value: session.active ? (pl >= 0 ? `+${fmt$(pl)}` : fmt$(pl)) : "—", color: pl >= 0 ? C.green : C.red },
    { label: "Machines Checked", value: todayLog.length || log.length, color: C.text },
    { label: "Wins Logged", value: wins.length, color: C.green },
  ];

  return (
    <div style={s.screen}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: C.text }}>Jackpot Scout</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Evaluate machines fast. Stay disciplined.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {stats.map(st => (
          <div key={st.label} style={{ ...s.card, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{st.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.color }}>{st.value}</div>
          </div>
        ))}
      </div>

      <button style={s.btnSolid(C.accent)} onClick={() => setScreen("check")}>◎ New Machine Check</button>
      <button style={s.btn(C.accent)} onClick={() => setScreen("tracker")}>◈ Session Tracker</button>
      <button style={s.btn()} onClick={() => setScreen("log")}>≡ Machine Log</button>
      <button style={s.btn()} onClick={() => setScreen("rules")}>✓ Quick Rules</button>
      <button style={{ ...s.btn(C.sub), marginTop: 4 }} onClick={() => setScreen("settings")}>⚙ Settings</button>
    </div>
  );
}

// ─── Machine Check ────────────────────────────────────────────────────────────

const EMPTY_CHECK = { note: "", casino: "", mustHit: "", current: "", cap: "", bet: "", qualifies: "", recentReset: "", linked: "" };

function evaluate(f) {
  if (f.mustHit !== "yes") return { rec: "INVALID TARGET", pct: null, reason: "This does not appear to be a must-hit-by machine. Only play machines that clearly say Must Hit By or Must Award By." };
  if (!f.current || !f.cap) return null;
  const pct = (Number(f.current) / Number(f.cap)) * 100;
  if (f.qualifies === "no") return { rec: "SKIP", pct, reason: "Your bet may not qualify for the jackpot. Confirm bet requirements before playing." };
  if (f.recentReset === "yes") return { rec: "SKIP", pct, reason: "This machine appears recently reset. The jackpot is likely far from the cap." };
  if (pct >= 95) return { rec: "PLAY", pct, reason: "This looks like a valid must-hit-by setup and is very near the cap." };
  if (pct >= 90) return { rec: "MAYBE", pct, reason: "This machine is borderline. Weigh your bankroll before committing." };
  return { rec: "SKIP", pct, reason: "This machine is too far from the cap to justify play." };
}

function MachineCheck({ log, setLog, settings }) {
  const [f, setF] = useState({ ...EMPTY_CHECK, casino: settings.defCasino || "" });
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const calc = () => {
    if (f.mustHit === "no") { setResult({ rec: "INVALID TARGET", pct: null, reason: "This does not appear to be a must-hit-by machine." }); return; }
    if (!f.current || !f.cap) { alert("Please enter current jackpot and cap amounts."); return; }
    setResult(evaluate(f));
    setSaved(false);
  };

  const saveToLog = () => {
    if (!result) return;
    const entry = {
      id: Date.now(), date: now(), casino: f.casino, note: f.note,
      current: Number(f.current), cap: Number(f.cap), pct: result.pct ? Number(result.pct.toFixed(1)) : null,
      bet: Number(f.bet), rec: result.rec, outcome: "did-not-play", amount: 0, notes: "",
    };
    const next = [entry, ...log];
    setLog(next);
    LS.set("js_log", next);
    setSaved(true);
  };

  const clear = () => { setF({ ...EMPTY_CHECK, casino: settings.defCasino || "" }); setResult(null); setSaved(false); };

  const recColor = result ? ({ PLAY: C.green, MAYBE: C.yellow }[result.rec] || C.red) : C.sub;

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>New Machine Check</div>

      <Field label="Casino (optional)">
        <input style={s.input} value={f.casino} onChange={e => set("casino", e.target.value)} placeholder="e.g. Riverside Casino" />
      </Field>
      <Field label="Machine note (optional)">
        <input style={s.input} value={f.note} onChange={e => set("note", e.target.value)} placeholder="e.g. Row B, near entrance" />
      </Field>

      <Field label="Says Must Hit By / Must Award By?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]} value={f.mustHit} onChange={v => set("mustHit", v)} color={f.mustHit === "yes" ? C.green : C.red} />
      </Field>

      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Current Jackpot ($)</label>
          <input style={s.input} type="number" value={f.current} onChange={e => set("current", e.target.value)} placeholder="0.00" inputMode="decimal" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Cap Amount ($)</label>
          <input style={s.input} type="number" value={f.cap} onChange={e => set("cap", e.target.value)} placeholder="0.00" inputMode="decimal" />
        </div>
      </div>

      <Field label="Bet per spin ($)">
        <input style={s.input} type="number" value={f.bet} onChange={e => set("bet", e.target.value)} placeholder="e.g. 1.50" inputMode="decimal" />
      </Field>

      <Field label="Does your bet qualify for jackpot?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unknown", value: "unknown" }]} value={f.qualifies} onChange={v => set("qualifies", v)} />
      </Field>

      <Field label="Looks recently reset?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unsure", value: "unsure" }]} value={f.recentReset} onChange={v => set("recentReset", v)} />
      </Field>

      <Field label="Linked bank of machines?">
        <ToggleGroup options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Unsure", value: "unsure" }]} value={f.linked} onChange={v => set("linked", v)} />
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
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 14, color: C.sub, marginBottom: 6 }}>Percent to cap</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: recColor }}>{fmtPct(result.pct)}</div>
                <div style={{ ...s.progress, marginTop: 8 }}>
                  <div style={s.progressFill(result.pct, recColor)} />
                </div>
              </div>
            )}
            <div style={{ fontSize: 14, color: C.sub, marginTop: 14, lineHeight: 1.5 }}>{result.reason}</div>
          </div>
          {f.qualifies === "no" && <div style={s.warn(C.yellow)}>⚠ Bet may not qualify for the jackpot.</div>}
          {f.recentReset === "yes" && <div style={s.warn(C.yellow)}>⚠ Recently reset machines are rarely worth playing.</div>}
          <button style={s.btn(saved ? C.green : C.sub)} onClick={saveToLog} disabled={saved}>
            {saved ? "✓ Saved to Log" : "Save to Machine Log"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Decision Tree ─────────────────────────────────────────────────────────────

const TREE_QUESTIONS = [
  { q: "Does the machine clearly say Must Hit By or Must Award By?", yes: 1, no: "WALK AWAY", noReason: "Only evaluate machines with clear must-hit-by language." },
  { q: "Can you see both the current jackpot amount and the cap?", yes: 2, no: "WALK AWAY", noReason: "You need both numbers to evaluate. If you can't see them, skip it." },
  { q: "Is the jackpot at least 90% of the cap?", yes: 3, no: "WALK AWAY", noReason: "Under 90% is generally not worth the risk." },
  { q: "Does your bet qualify for the jackpot?", yes: 4, no: "WALK AWAY", noReason: "If your bet doesn't qualify, you can't win the jackpot." },
  { q: "Does the machine appear recently reset (very low amount)?", yes: "WALK AWAY", no: "PLAY", yesReason: "Recently reset machines are far from cap. Skip.", noReason: null, playReason: "This machine passes all checks. It's a valid candidate." },
];

function DecisionTree() {
  const [step, setStep] = useState(0);
  const [final, setFinal] = useState(null);
  const [reason, setReason] = useState("");

  const answer = (choice) => {
    const q = TREE_QUESTIONS[step];
    if (choice === "yes") {
      if (typeof q.yes === "number") setStep(q.yes);
      else { setFinal(q.yes); setReason(q.yesReason || ""); }
    } else {
      if (q.no === "WALK AWAY") { setFinal("WALK AWAY"); setReason(q.noReason); }
      else if (q.no === "PLAY") { setFinal("PLAY"); setReason(q.playReason || ""); }
    }
  };

  const reset = () => { setStep(0); setFinal(null); setReason(""); };

  if (final) {
    const color = final === "PLAY" ? C.green : C.red;
    return (
      <div style={s.screen}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Quick Decision</div>
        <div style={{ ...s.bigRec(final), padding: "28px 20px" }}>
          <span style={s.recLabel(final)}>{final}</span>
          <div style={{ fontSize: 15, color: C.sub, marginTop: 14, lineHeight: 1.6 }}>{reason}</div>
        </div>
        <button style={s.btn(C.accent)} onClick={reset}>Start Over</button>
      </div>
    );
  }

  const q = TREE_QUESTIONS[step];
  const progress = ((step) / TREE_QUESTIONS.length) * 100;

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Quick Decision</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>Question {step + 1} of {TREE_QUESTIONS.length}</div>
      <div style={s.progress}>
        <div style={s.progressFill(progress, C.accent)} />
      </div>
      <div style={{ ...s.card, marginTop: 20, padding: "24px 18px", minHeight: 120, display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, color: C.text }}>{q.q}</div>
      </div>
      <button style={s.btnSolid(C.green)} onClick={() => answer("yes")}>Yes</button>
      <button style={s.btnSolid(C.red)} onClick={() => answer("no")}>No</button>
      <button style={s.btn(C.sub)} onClick={reset}>Restart</button>
    </div>
  );
}

// ─── Session Tracker ──────────────────────────────────────────────────────────

function SessionTracker({ session, setSession, settings }) {
  const [form, setForm] = useState({ start: session.start || settings.defBankroll || "", stopLoss: session.stopLoss || settings.defStopLoss || "", stopWin: session.stopWin || settings.defStopWin || "", current: session.current || "", notes: session.notes || "" });

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const start = () => {
    const next = { ...form, active: true, startTime: now() };
    setSession(next);
    LS.set("js_session", next);
  };

  const update = () => {
    const next = { ...session, current: form.current, notes: form.notes };
    setSession(next);
    LS.set("js_session", next);
  };

  const end = () => {
    const next = { ...session, active: false, endTime: now() };
    setSession(next);
    LS.set("js_session", next);
  };

  const pl = session.active ? (Number(session.current || form.current) - Number(session.start)) : 0;
  const lossUsed = session.active ? Math.max(0, -pl) : 0;
  const lossLimit = Number(session.stopLoss) || Number(form.stopLoss) || 1;
  const winTarget = Number(session.stopWin) || Number(form.stopWin) || 1;
  const lossHit = session.active && lossUsed >= lossLimit;
  const winHit = session.active && pl >= winTarget;

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Session Tracker</div>

      {lossHit && <div style={s.warn(C.red)}>🛑 Session limit reached. Stop now.</div>}
      {winHit && !lossHit && <div style={s.warn(C.yellow)}>🎯 You hit your target. Consider cashing out.</div>}

      {session.active && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Current Bankroll</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{fmt$(session.current)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>P / L</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: pl >= 0 ? C.green : C.red }}>{pl >= 0 ? "+" : ""}{fmt$(pl)}</div>
            </div>
          </div>
          <div style={s.divider} />
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Loss used — {fmt$(lossUsed)} of {fmt$(lossLimit)}</div>
          <div style={s.progress}>
            <div style={s.progressFill((lossUsed / lossLimit) * 100, lossHit ? C.red : C.yellow)} />
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 10, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Win progress — {fmt$(Math.max(0, pl))} of {fmt$(winTarget)}</div>
          <div style={s.progress}>
            <div style={s.progressFill((Math.max(0, pl) / winTarget) * 100, C.green)} />
          </div>
        </div>
      )}

      <Field label="Starting bankroll ($)">
        <input style={s.input} type="number" value={form.start} onChange={e => setF("start", e.target.value)} placeholder="e.g. 200" inputMode="decimal" disabled={session.active} />
      </Field>

      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Stop-Loss ($)</label>
          <input style={s.input} type="number" value={form.stopLoss} onChange={e => setF("stopLoss", e.target.value)} placeholder="e.g. 100" inputMode="decimal" disabled={session.active} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Stop-Win ($)</label>
          <input style={s.input} type="number" value={form.stopWin} onChange={e => setF("stopWin", e.target.value)} placeholder="e.g. 150" inputMode="decimal" disabled={session.active} />
        </div>
      </div>

      {session.active && (
        <Field label="Current cash on hand ($)">
          <input style={s.input} type="number" value={form.current} onChange={e => setF("current", e.target.value)} placeholder="0.00" inputMode="decimal" />
        </Field>
      )}

      <Field label="Notes">
        <textarea style={s.textarea} rows={3} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Any session notes..." />
      </Field>

      {!session.active
        ? <button style={s.btnSolid(C.green)} onClick={start}>Start Session</button>
        : <>
          <button style={s.btnSolid(C.accent)} onClick={update}>Update Session</button>
          <button style={s.btn(C.red)} onClick={end}>End Session</button>
        </>
      }
    </div>
  );
}

// ─── Machine Log ──────────────────────────────────────────────────────────────

const OUTCOME_LABELS = { "did-not-play": "Skipped", "played-won": "Won", "played-lost": "Lost" };
const OUTCOME_COLOR = { "did-not-play": C.sub, "played-won": C.green, "played-lost": C.red };
const REC_COLOR = { PLAY: C.green, MAYBE: C.yellow, SKIP: C.red, "INVALID TARGET": C.red, "WALK AWAY": C.red };

function MachineLog({ log, setLog }) {
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // entry id

  const filtered = log.filter(e => {
    if (filter === "played") return e.outcome === "played-won" || e.outcome === "played-lost";
    if (filter === "won") return e.outcome === "played-won";
    if (filter === "skipped") return e.outcome === "did-not-play";
    return true;
  });

  const updateEntry = (id, changes) => {
    const next = log.map(e => e.id === id ? { ...e, ...changes } : e);
    setLog(next);
    LS.set("js_log", next);
  };

  const deleteEntry = (id) => {
    const next = log.filter(e => e.id !== id);
    setLog(next);
    LS.set("js_log", next);
    setEditing(null);
  };

  const wins = log.filter(e => e.outcome === "played-won" && e.pct);
  const avgWinPct = wins.length ? (wins.reduce((a, e) => a + e.pct, 0) / wins.length).toFixed(1) : null;
  const ignoredRec = log.filter(e => (e.rec === "SKIP" || e.rec === "INVALID TARGET") && (e.outcome === "played-won" || e.outcome === "played-lost")).length;

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Machine Log</div>

      {(avgWinPct || ignoredRec > 0) && (
        <div style={{ ...s.card, display: "flex", gap: 16, marginBottom: 14 }}>
          {avgWinPct && <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Avg % at Win</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{avgWinPct}%</div></div>}
          {ignoredRec > 0 && <div><div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Skipped Rec</div><div style={{ fontSize: 18, fontWeight: 700, color: C.yellow }}>{ignoredRec}×</div></div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "played", "won", "skipped"].map(f => (
          <button key={f} style={s.chip(filter === f)} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ color: C.sub, textAlign: "center", marginTop: 40 }}>No entries yet.</div>}

      {filtered.map(e => (
        <div key={e.id} style={{ ...s.card, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{e.casino || "Unknown Casino"}</div>
              {e.note && <div style={{ fontSize: 12, color: C.sub }}>{e.note}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.date}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={s.badge(REC_COLOR[e.rec] === C.green ? "green" : REC_COLOR[e.rec] === C.yellow ? "yellow" : "red")}>{e.rec}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 13, color: C.sub, marginBottom: 10 }}>
            {e.pct !== null && <span style={{ color: C.accent, fontWeight: 700 }}>{fmtPct(e.pct)}</span>}
            {e.current > 0 && <span>{fmt$(e.current)} / {fmt$(e.cap)}</span>}
            {e.bet > 0 && <span>Bet: {fmt$(e.bet)}</span>}
          </div>

          {editing === e.id ? (
            <>
              <Field label="Outcome">
                <ToggleGroup
                  options={[{ label: "Skipped", value: "did-not-play" }, { label: "Played/Lost", value: "played-lost" }, { label: "Played/Won", value: "played-won" }]}
                  value={e.outcome}
                  onChange={v => updateEntry(e.id, { outcome: v })}
                />
              </Field>
              {(e.outcome === "played-won" || e.outcome === "played-lost") && (
                <Field label="Amount won/lost ($)">
                  <input style={s.input} type="number" defaultValue={Math.abs(e.amount)} onBlur={ev => updateEntry(e.id, { amount: e.outcome === "played-won" ? Number(ev.target.value) : -Number(ev.target.value) })} inputMode="decimal" />
                </Field>
              )}
              <Field label="Notes">
                <textarea style={s.textarea} rows={2} defaultValue={e.notes} onBlur={ev => updateEntry(e.id, { notes: ev.target.value })} />
              </Field>
              <div style={s.row}>
                <button style={{ ...s.btnSolid(C.accent), flex: 1, marginBottom: 0 }} onClick={() => setEditing(null)}>Done</button>
                <button style={{ ...s.btn(C.red), flex: 1, marginBottom: 0 }} onClick={() => deleteEntry(e.id)}>Delete</button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: OUTCOME_COLOR[e.outcome] }}>{OUTCOME_LABELS[e.outcome]}{e.amount !== 0 ? ` (${e.amount > 0 ? "+" : ""}${fmt$(e.amount)})` : ""}</span>
              <button style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }} onClick={() => setEditing(e.id)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Quick Rules ──────────────────────────────────────────────────────────────

const RULES = [
  "Only play machines that clearly say Must Hit By or Must Award By",
  "Always confirm both the current amount and the cap",
  "95%+ of cap is the strongest candidate signal",
  "90%–94.9% is borderline — weigh carefully",
  "Under 90% is generally a skip",
  "Confirm your bet qualifies for the jackpot",
  "Avoid machines that appear recently reset",
  "Set a per-machine spending limit before you sit",
  "Set a daily stop-loss and stick to it",
  "If you hit your target, cash out and walk",
];

function QuickRules() {
  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Quick Rules</div>
      <div style={s.card}>
        {RULES.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: i < RULES.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={{ color: C.green, fontWeight: 700, fontSize: 14, minWidth: 20 }}>✓</span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: C.text }}>{r}</span>
          </div>
        ))}
      </div>

      <div style={{ background: C.muted + "33", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
        <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Disclaimer</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          This app supports discipline and evaluation. It does not predict outcomes or guarantee profit. All gambling involves risk. Play responsibly.
        </div>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings({ settings, setSettings }) {
  const setF = (k, v) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    LS.set("js_settings", next);
  };

  const reset = () => {
    if (!window.confirm("Reset all app data? This cannot be undone.")) return;
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Settings</div>

      <Field label="Default Bankroll ($)">
        <input style={s.input} type="number" value={settings.defBankroll || ""} onChange={e => setF("defBankroll", e.target.value)} placeholder="e.g. 200" inputMode="decimal" />
      </Field>
      <Field label="Default Stop-Loss ($)">
        <input style={s.input} type="number" value={settings.defStopLoss || ""} onChange={e => setF("defStopLoss", e.target.value)} placeholder="e.g. 100" inputMode="decimal" />
      </Field>
      <Field label="Default Stop-Win ($)">
        <input style={s.input} type="number" value={settings.defStopWin || ""} onChange={e => setF("defStopWin", e.target.value)} placeholder="e.g. 150" inputMode="decimal" />
      </Field>
      <Field label="Default Per-Machine Budget ($)">
        <input style={s.input} type="number" value={settings.defMachineBudget || ""} onChange={e => setF("defMachineBudget", e.target.value)} placeholder="e.g. 40" inputMode="decimal" />
      </Field>
      <Field label="Default Target Bet ($)">
        <input style={s.input} type="number" value={settings.defBet || ""} onChange={e => setF("defBet", e.target.value)} placeholder="e.g. 1.50" inputMode="decimal" />
      </Field>
      <Field label="Default Casino Name">
        <input style={s.input} value={settings.defCasino || ""} onChange={e => setF("defCasino", e.target.value)} placeholder="e.g. Riverside Casino" />
      </Field>

      <div style={{ ...s.divider, margin: "20px 0" }} />
      <button style={s.btn(C.red)} onClick={reset}>Reset All App Data</button>
      <div style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 4 }}>This will clear all logs, sessions, and settings.</div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("home");
  const [log, setLog] = useState(() => LS.get("js_log", SEED_LOG));
  const [session, setSession] = useState(() => LS.get("js_session", {}));
  const [settings, setSettings] = useState(() => LS.get("js_settings", {}));

  const navScreen = NAV.find(n => n.id === screen) ? screen : screen;

  const SCREENS = {
    home: <Home setScreen={setScreen} log={log} session={session} />,
    check: <MachineCheck log={log} setLog={setLog} settings={settings} />,
    tree: <DecisionTree />,
    tracker: <SessionTracker session={session} setSession={setSession} settings={settings} />,
    log: <MachineLog log={log} setLog={setLog} />,
    rules: <QuickRules />,
    settings: <Settings settings={settings} setSettings={setSettings} />,
  };

  const screenTitle = {
    home: null, check: "New Machine Check", tree: "Quick Decision",
    tracker: "Session Tracker", log: "Machine Log", rules: "Quick Rules", settings: "Settings",
  };

  return (
    <div style={s.app}>
      {screen !== "home" && (
        <div style={{ ...s.header, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.sub, fontSize: 20, cursor: "pointer", padding: "0 4px" }}>←</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{screenTitle[screen]}</span>
        </div>
      )}
      {screen === "home" && (
        <div style={{ ...s.header, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.accent, fontWeight: 700, letterSpacing: "0.5px" }}>JACKPOT SCOUT</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setScreen("tree")} style={{ background: C.accent + "22", border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quick Tree</button>
            <button onClick={() => setScreen("settings")} style={{ background: "none", border: "none", color: C.sub, fontSize: 18, cursor: "pointer" }}>⚙</button>
          </div>
        </div>
      )}
      {SCREENS[screen] || SCREENS.home}
      <Nav screen={navScreen} setScreen={setScreen} />
    </div>
  );
}