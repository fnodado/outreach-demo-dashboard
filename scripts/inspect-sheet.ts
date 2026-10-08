// Prints each tab's headers and first rows, plus the spreadsheet timezone.
// Use it to confirm column names before trusting the mapping. Usage: npm run inspect:sheet
import { appConfig } from "@/config/app.config";
import { fetchSpreadsheetMeta, fetchTabs } from "@/lib/data/sheets/client";

async function main() {
  const meta = await fetchSpreadsheetMeta();
  console.log(`Spreadsheet: ${meta.title}`);
  console.log(`Timezone:    ${meta.timeZone}${meta.timeZone !== appConfig.timeZone ? `  (!) config uses ${appConfig.timeZone}` : ""}`);
  console.log(`Tabs:        ${meta.tabs.join(" | ")}\n`);

  const grids = await fetchTabs(meta.tabs.filter((t) => t.toLowerCase() !== "readme"));
  for (const [tab, rows] of Object.entries(grids)) {
    console.log(`── ${tab} (${Math.max(rows.length - 1, 0)} data rows)`);
    for (const r of rows.slice(0, 4)) console.log("  ", JSON.stringify(r));
    console.log();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
