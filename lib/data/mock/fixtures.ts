// Deterministic, deliberately messy fixture data shaped like the real Leads tab.
// Exercises every cleaning rule: mixed date formats, duplicates, test rows, bad rows.
import { STAGES } from "@/config/app.config";
import type { RawLead } from "@/lib/clean/pipeline";
import type { WeeklyAdSpend } from "@/lib/domain/types";
import { addWeeks } from "@/lib/metrics/weeks";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIRST = ["Ava", "Liam", "Mia", "Noah", "Zoe", "Ethan", "Ivy", "Lucas", "Nora", "Owen", "Ruby", "Mason", "Leah", "Caleb", "Jade", "Elias"];
const LAST = ["Reyes", "Carter", "Nguyen", "Brooks", "Patel", "Hughes", "Diaz", "Foster", "Kim", "Bennett", "Ortiz", "Price"];
const SOURCES = ["Facebook Ads", "Instagram Ads", "Indeed", "Referral", "Google Ads"];
const FIRST_WEEK = "2026-07-27";
const WEEKS = 10;

/** Stage distribution: most leads stall early, a few reach Hired. */
const STAGE_WEIGHTS = [0.24, 0.2, 0.14, 0.1, 0.06, 0.08, 0.18];

const pad = (n: number) => String(n).padStart(2, "0");

/** Days since 1899-12-30 for a UTC calendar date + fractional time. */
const serialOf = (date: string, hours: number) =>
  (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000 + hours / 24;

function formatDate(date: string, hours: number, style: number): unknown {
  const [y, m, d] = date.split("-").map(Number);
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);
  switch (style) {
    case 0: return serialOf(date, hours);
    case 1: return `${m}/${d}/${y}`;
    case 2: return date;
    case 3: return `${date} ${pad(hh)}:${pad(mm)}`;
    default: return `${pad(m)}/${pad(d)}/${String(y).slice(2)}`;
  }
}

function pickStage(r: number) {
  let acc = 0;
  for (let i = 0; i < STAGES.length; i++) {
    acc += STAGE_WEIGHTS[i];
    if (r < acc) return STAGES[i];
  }
  return STAGES[0];
}

function buildLeads(): RawLead[] {
  const rand = rng(20261008);
  const rows: RawLead[] = [];
  let n = 1;
  const push = (r: Omit<RawLead, "row">) => rows.push({ row: rows.length + 2, ...r });

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addWeeks(FIRST_WEEK, w);
    const count = 18 + Math.floor(rand() * 14);
    for (let i = 0; i < count; i++) {
      const day = Math.floor(rand() * 7);
      const date = new Date(Date.parse(`${weekStart}T00:00:00Z`) + day * 86_400_000).toISOString().slice(0, 10);
      const hours = 8 + rand() * 14;
      const first = FIRST[Math.floor(rand() * FIRST.length)];
      const last = LAST[Math.floor(rand() * LAST.length)];
      const id = `L-${String(n++).padStart(4, "0")}`;
      const score = Math.floor(40 + rand() * 60);
      push({
        id,
        name: `${first} ${last}`,
        email: `${first}.${last}${n}@mail.com`.toLowerCase(),
        phone: `(${200 + Math.floor(rand() * 700)}) 555-${String(1000 + n).slice(-4)}`,
        createdDate: formatDate(date, hours, Math.floor(rand() * 5)),
        stage: pickStage(rand()),
        quizScore: score,
        quizResult: score >= 70 ? "Pass" : "Fail",
        source: SOURCES[Math.floor(rand() * SOURCES.length)],
      });
    }
  }

  // Duplicates: re-submissions a few days later with messy casing / phone formatting.
  for (const src of [rows[3], rows[40], rows[77], rows[120], rows[160], rows[201]]) {
    push({
      ...src,
      id: `L-${String(n++).padStart(4, "0")}`,
      email: `  ${String(src.email).toUpperCase()} `,
      createdDate: "2026-10-02 09:15",
      stage: "New Lead",
    });
  }
  for (const src of [rows[15], rows[95]]) {
    const digits = String(src.phone).replace(/\D/g, "");
    push({ ...src, id: `L-${String(n++).padStart(4, "0")}`, email: "", phone: `+1 ${digits}`, createdDate: "10/1/2026" });
  }

  // Test rows.
  push({ id: "L-T1", name: "Test Lead", email: "test@gmail.com", phone: "555-000-0000", createdDate: "8/4/2026", stage: "New Lead" });
  push({ id: "L-T2", name: "asdf asdf", email: "asdf@asdf.com", phone: "", createdDate: "2026-08-12", stage: "New Lead" });
  push({ id: "L-T3", name: "Jane Doe", email: "jane@example.com", phone: "", createdDate: "9/2/2026", stage: "Quiz Completed" });
  push({ id: "L-T4", name: "DELETE ME", email: "x@mail.com", phone: "", createdDate: "9/15/26", stage: "New Lead" });

  // Rejected rows: unparseable date, unknown stage.
  push({ id: "L-B1", name: "Sam Ortiz", email: "sam.o@mail.com", phone: "(310) 555-0199", createdDate: "sometime in Sept", stage: "New Lead" });
  push({ id: "L-B2", name: "Kai Foster", email: "kai.f@mail.com", phone: "(310) 555-0198", createdDate: "9/9/2026", stage: "Ghosted" });

  return rows;
}

export const mockLeadRows: RawLead[] = buildLeads();

export const mockAdSpend: WeeklyAdSpend[] = Array.from({ length: WEEKS }, (_, w) => ({
  weekStart: addWeeks(FIRST_WEEK, w),
  amount: 1800 + ((w * 37) % 9) * 120,
}));
