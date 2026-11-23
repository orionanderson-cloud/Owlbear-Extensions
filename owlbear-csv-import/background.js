import OBR from "./vendor/obr-sdk.js";
import { buildTable, findRowForItem, applyPlan, loadSaved, defaultOptions } from "./lib.js";

const MENU_ID = "ringbearer-csv-import/context-menu";

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: MENU_ID,
    icons: [
      {
        icon: new URL("icon.svg", import.meta.url).href,
        label: "Apply CSV stats",
        filter: {
          roles: ["GM"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "MOUNT" },
          ],
        },
      },
    ],
    async onClick(context) {
      try {
        const saved = loadSaved();
        if (!saved.csv) {
          OBR.notification.show("No CSV loaded yet. Open CSV Stat Import in the top-left menu and load one.", "WARNING");
          return;
        }
        const table = buildTable(saved.csv);
        const options = { ...defaultOptions, ...(saved.options ?? {}) };
        const plan = [];
        const missed = [];
        for (const item of context.items) {
          const row = findRowForItem(table, item);
          if (row) plan.push({ item, row });
          else missed.push(item.text?.plainText || item.name || "(unnamed)");
        }
        await applyPlan(OBR, table, plan, options);
        if (missed.length) {
          OBR.notification.show(`Updated ${plan.length}. No CSV row for: ${[...new Set(missed)].join(", ")}`, "WARNING");
        } else {
          OBR.notification.show(`Applied stats to ${plan.length} token${plan.length === 1 ? "" : "s"}.`, "SUCCESS");
        }
      } catch (err) {
        console.error(err);
        OBR.notification.show(`CSV Stat Import failed: ${err?.message ?? err}`, "ERROR");
      }
    },
  });
});
