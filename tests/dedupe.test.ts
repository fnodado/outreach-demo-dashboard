import { describe, expect, it } from "vitest";
import { dedupe, normalizeEmail, normalizePhone } from "@/lib/clean/dedupe";

const rec = (id: string, iso: string, email?: string, phone?: string) => ({ id, email, phone, createdAt: new Date(iso) });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("normalizers", () => {
  it("trims and lowercases email", () => {
    expect(normalizeEmail("  Ava.Reyes@Mail.COM ")).toBe("ava.reyes@mail.com");
    expect(normalizeEmail("   ")).toBeUndefined();
  });

  it("keeps phone digits only and drops a US country code", () => {
    expect(normalizePhone("(212) 555-0101")).toBe("2125550101");
    expect(normalizePhone("+1 212.555.0101")).toBe("2125550101");
    expect(normalizePhone(2125550101)).toBe("2125550101");
    expect(normalizePhone("n/a")).toBeUndefined();
    expect(normalizePhone("555")).toBeUndefined();
  });
});

describe("dedupe", () => {
  it("matches on email regardless of case and whitespace, keeping the earliest", () => {
    const { kept, removed } = dedupe([
      rec("late", "2026-03-05", " AVA@mail.com"),
      rec("early", "2026-03-01", "ava@mail.com"),
    ]);
    expect(ids(kept)).toEqual(["early"]);
    expect(removed[0].duplicateOf.id).toBe("early");
  });

  it("matches on phone digits when emails differ", () => {
    const { kept } = dedupe([
      rec("a", "2026-03-01", "a@mail.com", "(212) 555-0101"),
      rec("b", "2026-03-02", "b@mail.com", "212-555-0101"),
    ]);
    expect(ids(kept)).toEqual(["a"]);
  });

  it("does not treat blank email or phone as a match", () => {
    const { kept } = dedupe([rec("a", "2026-03-01", "", ""), rec("b", "2026-03-02", undefined, undefined)]);
    expect(ids(kept)).toEqual(["a", "b"]);
  });

  it("keeps the earliest record unchanged (its own stage)", () => {
    const first = { ...rec("a", "2026-03-01", "x@mail.com"), stage: "New Lead" };
    const later = { ...rec("b", "2026-03-04", "x@mail.com"), stage: "Hired" };
    expect(dedupe([later, first]).kept).toEqual([first]);
  });

  it("breaks createdAt ties by input order", () => {
    const { kept } = dedupe([rec("first", "2026-03-01", "x@mail.com"), rec("second", "2026-03-01", "x@mail.com")]);
    expect(ids(kept)).toEqual(["first"]);
  });

  it("is transitive through a dropped duplicate", () => {
    const { kept } = dedupe([
      rec("a", "2026-03-01", "e1@mail.com", "2125550101"),
      rec("b", "2026-03-02", "e1@mail.com", "3105550199"),
      rec("c", "2026-03-03", "e3@mail.com", "3105550199"),
    ]);
    expect(ids(kept)).toEqual(["a"]);
  });
});
