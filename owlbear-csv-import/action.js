import OBR from "./vendor/obr-sdk.js";
import {
  buildTable, trackersForRow, findRowForItem, applyPlan,
  loadSaved, saveState, defaultOptions, MAX_TRACKERS,
} from "./lib.js";

const $ = (id) => document.getElementById(id);
const COLOR_NAMES = ["fuchsia", "pink", "red", "orange", "yellow", "lime", "emerald", "cyan", "blue"];

let table = null;
let ready = false;

function setStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = kind;
}

function render() {
  const has = table && table.rows.length > 0;
  $("applyByName").disabled = !has || !ready;
  $("applyRow").disabled = !has || !ready;
  $("rowPick").disabled = !has;

  $("rowPick").innerHTML = "";
  $("columns").innerHTML = "";
  if (!has) return;

  for (const row of table.rows) {
    const opt = document.createElement("option");
    opt.value = row.name;
    opt.textContent = row.name;
    $("rowPick").appendChild(opt);
  }
  const saved = loadSaved().lastRow;
  if (saved && table.rows.some((r) => r.name === saved)) $("rowPick").value = saved;

  for (const col of table.columns) {
    if (col.type === "name" || col.type === "skip") continue;
    const chip = document.createElement("span");
    chip.className = "chip" + (col.showOnMap ? "" : " off");
    const kind = { bar: "bar", bar0: "bar, starts at 0", bubble: "number", counter: "counter", check: "checkbox" }[col.type];
    chip.textContent = col.label;
    chip.title = `${kind} · ${COLOR_NAMES[col.color % 9]}${col.showOnMap ? "" : " · not shown on map"}`;
    $("columns").appendChild(chip);
  }
}

function loadCSV(text, fileName) {
  table = buildTable(text);
  const n = table.rows.length;
  $("loaded").textContent = n
    ? `${fileName || "Pasted CSV"}: ${n} row${n === 1 ? "" : "s"}`
    : "No CSV loaded.";
  render();
  if (table.warnings.length) setStatus(table.warnings.join("\n"), n ? "warn" : "err");
  else setStatus("");
  return n > 0;
}

function options() {
  return { replaceAll: $("replaceAll").checked, hidden: $("hidden").value };
}

async function selectedItems() {
  const ids = await OBR.player.getSelection();
  if (!ids || ids.length === 0) return [];
  return OBR.scene.items.getItems(ids);
}

async function applyByName() {
  const items = await selectedItems();
  if (!items.length) return setStatus("Select one or more tokens first.", "warn");
  const plan = [];
  const missed = [];
  for (const item of items) {
    const row = findRowForItem(table, item);
    if (row) plan.push({ item, row });
    else missed.push(item.text?.plainText || item.name || "(unnamed)");
  }
  await applyPlan(OBR, table, plan, options());
  let msg = `Updated ${plan.length} token${plan.length === 1 ? "" : "s"}.`;
  if (missed.length) msg += `\nNo row matched: ${[...new Set(missed)].join(", ")}`;
  setStatus(msg, missed.length ? "warn" : "ok");
}

async function applyRow() {
  const row = table.rows.find((r) => r.name === $("rowPick").value);
  if (!row) return;
  const items = await selectedItems();
  if (!items.length) return setStatus("Select one or more tokens first.", "warn");
  await applyPlan(OBR, table, items.map((item) => ({ item, row })), options());
  const count = trackersForRow(table, row).length;
  setStatus(`Applied ${row.name} (${Math.min(count, MAX_TRACKERS)} trackers) to ${items.length} token${items.length === 1 ? "" : "s"}.`, "ok");
}

function guard(fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setStatus(`Something went wrong: ${err?.message ?? err}`, "err");
    }
  };
}

// ---- wire up UI (works before OBR is ready so the CSV can be loaded) ----
const saved = loadSaved();
const opts = { ...defaultOptions, ...(saved.options ?? {}) };
$("replaceAll").checked = !!opts.replaceAll;
$("hidden").value = opts.hidden;
if (saved.csv) loadCSV(saved.csv, saved.fileName);

$("pick").onclick = () => $("file").click();
$("file").onchange = async () => {
  const f = $("file").files?.[0];
  if (!f) return;
  const text = await f.text();
  if (loadCSV(text, f.name)) saveState({ csv: text, fileName: f.name });
  $("file").value = "";
};
$("togglePaste").onclick = () => { $("pasteBox").hidden = !$("pasteBox").hidden; };
$("usePaste").onclick = () => {
  const text = $("paste").value;
  if (loadCSV(text, "Pasted CSV")) {
    saveState({ csv: text, fileName: "Pasted CSV" });
    $("pasteBox").hidden = true;
  }
};
$("rowPick").onchange = () => saveState({ lastRow: $("rowPick").value });
$("replaceAll").onchange = () => saveState({ options: options() });
$("hidden").onchange = () => saveState({ options: options() });
$("applyByName").onclick = guard(applyByName);
$("applyRow").onclick = guard(applyRow);

OBR.onReady(async () => {
  try {
    const theme = await OBR.theme.getTheme();
    document.documentElement.dataset.mode = theme.mode;
    OBR.theme.onChange((t) => { document.documentElement.dataset.mode = t.mode; });
  } catch { /* theme is cosmetic */ }
  ready = true;
  render();
});
