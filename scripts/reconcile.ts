// Diffs computed weekly counts (by Created Date week, current stage) against the
// client's Weekly Stats tab. Exit code 0 = zero differences. Usage: npm run reconcile
//   --verbose   also list rejected rows and every matching cell
import { appConfig, STAGES } from "@/config/app.config";
import { cleanLeads } from "@/lib/clean/pipeline";
import { fetchTabs } from "@/lib/data/sheets/client";
import { mapLeads, mapWeeklyStats } from "@/lib/data/sheets/mapping";
import { addDays, countByWeekAndStage } from "@/lib/metrics/weeks";

const verbose = process.argv.includes("--verbose");

async function main() {
  const { tabs, timeZone } = appConfig;
  const grid = await fetchTabs([tabs.leads, tabs.weeklyStats]);

  const { leads, quality } = cleanLeads(mapLeads(grid[tabs.leads], tabs.leads), timeZone);
  const reported = mapWeeklyStats(grid[tabs.weeklyStats], timeZone, tabs.weeklyStats);
  if (reported.length === 0) throw new Error(`No weeks found in "${tabs.weeklyStats}"`);

  const { rejected, dateFormats, ...q } = quality;
  console.log("Data quality:", q);
  console.log("Date formats:", dateFormats);
  if (rejected.length) {
    console.log(`Rejected rows (${rejected.length}):`);
    for (const r of verbose ? rejected : rejected.slice(0, 10)) console.log(`  row ${r.row} ${r.id ?? ""}: ${r.reason}`);
  }

  const weeks = reported.map((r) => r.weekStart).sort();
  const range = { from: weeks[0], to: weeks[weeks.length - 1] };
  const computed = new Map(countByWeekAndStage(leads, range).map((r) => [r.weekStart, r]));

  const diffs: string[] = [];
  let cells = 0;
  for (const rep of reported) {
    const mine = computed.get(rep.weekStart);
    if (!mine) {
      diffs.push(`${rep.weekStart}: week not computed`);
      continue;
    }
    for (const stage of STAGES) {
      const expected = rep.counts[stage];
      if (expected === undefined) continue;
      cells++;
      const got = mine.counts[stage];
      if (got !== expected) diffs.push(`${rep.weekStart}  ${stage.padEnd(20)} sheet=${expected}  computed=${got}  (${got - expected > 0 ? "+" : ""}${got - expected})`);
      else if (verbose) console.log(`  ok ${rep.weekStart} ${stage}=${got}`);
    }
    if (rep.total !== undefined) {
      cells++;
      if (rep.total !== mine.total) diffs.push(`${rep.weekStart}  ${"Total".padEnd(20)} sheet=${rep.total}  computed=${mine.total}  (${mine.total - rep.total > 0 ? "+" : ""}${mine.total - rep.total})`);
    }
  }

  const outside = leads.filter((l) => l.createdDate < range.from || l.createdDate > addDays(range.to, 6)).length;
  if (outside) console.log(`Note: ${outside} clean lead(s) fall outside the Weekly Stats weeks (${range.from} – ${range.to}).`);

  console.log(`\nCompared ${cells} cells across ${reported.length} weeks.`);
  if (diffs.length === 0) {
    console.log("✓ Zero differences.");
    return;
  }
  console.log(`✗ ${diffs.length} difference(s):`);
  for (const d of diffs) console.log("  " + d);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
