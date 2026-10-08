import { describe, expect, it } from "vitest";
import { matchTestRow } from "@/lib/clean/testRows";
import { cleanLeads, type RawLead } from "@/lib/clean/pipeline";

describe("matchTestRow", () => {
  it.each([
    [{ name: "Test Lead", email: "real@mail.com" }],
    [{ name: "TEST", email: "" }],
    [{ name: "asdf asdf" }],
    [{ name: "Jane Doe", email: "jane@example.com" }],
    [{ name: "Jane Doe", email: "JANE@EXAMPLE.COM" }],
    [{ name: "delete me" }],
    [{ name: "Delete  Me please" }],
    [{ name: "Jane", email: "test@gmail.com" }],
  ])("flags %o", (row) => {
    expect(matchTestRow(row)).not.toBeNull();
  });

  it.each([
    [{ name: "Celeste Contestant", email: "celeste@mail.com" }],
    [{ name: "Ava Reyes", email: "ava@examples.com" }],
    [{ name: "Ava Reyes", email: "ava@mail.com" }],
  ])("keeps real lead %o", (row) => {
    expect(matchTestRow(row)).toBeNull();
  });
});

describe("cleanLeads pipeline", () => {
  const base = { stage: "New Lead", createdDate: "3/2/2026" };
  const rows: RawLead[] = [
    { row: 2, id: "1", name: "Test", email: "a@mail.com", ...base },
    { row: 3, id: "2", name: "Real", email: "a@mail.com", ...base, createdDate: "3/3/2026" },
    { row: 4, id: "3", name: "Dup", email: "A@mail.com ", ...base, createdDate: "3/4/2026" },
    { row: 5, id: "4", name: "Bad date", email: "b@mail.com", ...base, createdDate: "soon" },
    { row: 6, id: "5", name: "Bad stage", email: "c@mail.com", ...base, stage: "Ghosted" },
    { row: 7, id: "6", name: "Stage case", email: "d@mail.com", ...base, stage: " quiz  completed " },
    { row: 8 },
  ];

  it("removes test rows before dedupe so a real lead is not lost to a test row", () => {
    const { leads, quality } = cleanLeads(rows);
    expect(leads.map((l) => l.id).sort()).toEqual(["2", "6"]);
    expect(quality).toMatchObject({
      rawRows: 6,
      testRowsRemoved: 1,
      duplicatesRemoved: 1,
      rowsRejected: 2,
      datesNormalized: 3,
      cleanRows: 2,
    });
  });

  it("normalizes stage spelling", () => {
    expect(cleanLeads(rows).leads.find((l) => l.id === "6")?.stage).toBe("Quiz Completed");
  });
});
