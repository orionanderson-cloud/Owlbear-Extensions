// Shared logic: CSV parsing, turning a CSV row into Owl Trackers trackers,
// matching tokens to rows, and writing trackers onto tokens.
//
// Owl Trackers stores its data on each item at:
//   item.metadata["com.owl-trackers/trackers"] = Tracker[]
//   item.metadata["com.owl-trackers/hidden"]   = boolean (hide stats from players)
// Tracker shapes (from Owl Trackers src/TrackerZod.ts):
//   { id, color, name?, showOnMap?, variant: "value-max", value, max }  -> bar
//   { id, color, name?, showOnMap?, variant: "value", value }           -> bubble
//   { id, color, name?, showOnMap?, variant: "counter", value }         -> counter
//   { id, color, name?, showOnMap?, variant: "checkbox", checked }      -> checkbox
 
export const TRACKERS_KEY = "com.owl-trackers/trackers";
export const HIDDEN_KEY = "com.owl-trackers/hidden";
export const MAX_TRACKERS = 12; // Owl Trackers' MAX_TRACKER_COUNT
export const STORAGE_KEY = "ringbearer-csv-import/v1";
 
// Owl Trackers' 9 colours, by index.
export const COLORS = {
  fuchsia: 0, purple: 0, pink: 1, red: 2, orange: 3, yellow: 4,
  lime: 5, green: 6, emerald: 6, cyan: 7, teal: 7, blue: 8,
};
 
// Columns that identify the row (the first one found is used).
const NAME_HEADERS = ["name", "class", "npc", "token", "unit"];
 
// Columns ignored unless you give them a type in brackets.
const SKIP_HEADERS = ["role", "tier", "template", "templates", "notes", "note", "description", "tags", "size", "source", "page", "book",
  "hull", "agility", "systems", "engineering"];
 
// Defaults for Lancer stats, keyed by header with spaces/punctuation removed.
// type: bar = full bar (value = max = cell), bar0 = bar that starts empty (heat),
//       bubble = single number, counter, check
const KNOWN = {
  hp:         { type: "bar",    color: COLORS.green,     label: "HP" },
  heat:       { type: "bar0",   color: COLORS.red,  label: "Heat" },
  heatcap:    { type: "bar0",   color: COLORS.red,  label: "Heat" },
  structure:  { type: "counter",    color: COLORS.green,    label: "Structure" },
  stress:     { type: "counter",    color: COLORS.red, label: "Stress" },
  overshield: { type: "bubble", color: COLORS.cyan,    label: "Overshield" },
  burn:       { type: "bubble", color: COLORS.orange,  label: "Burn" },
  armor:      { type: "bubble", color: COLORS.lime,    label: "Armor", offmap: true },
  armour:     { type: "bubble", color: COLORS.lime,    label: "Armor", offmap: true },
  evasion:    { type: "bubble", color: COLORS.blue,   label: "Evasion", offmap: true },
  evade:      { type: "bubble", color: COLORS.blue,   label: "Evasion", offmap: true },
  edef:       { type: "bubble", color: COLORS.yellow,    label: "E-Def", offmap: true },
  speed:      { type: "bubble", color: COLORS.orange,  label: "Speed" },
  sensors:    { type: "bubble", color: COLORS.pink,    label: "Sensors" },
  sensor:     { type: "bubble", color: COLORS.pink,    label: "Sensors" },
  save:       { type: "bubble", color: COLORS.cyan,    label: "Save" },
  savetarget: { type: "bubble", color: COLORS.cyan,    label: "Save" },
  activations:{ type: "bubble", color: COLORS.purple,  label: "Activations" },
};
 
const TYPE_WORDS = {
  bar: "bar", full: "bar", bar0: "bar0", empty: "bar0",
  bubble: "bubble", value: "bubble", number: "bubble",
  counter: "counter", check: "check", checkbox: "check",
  skip: "skip", ignore: "skip",
};
 
export const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const normName = (s) => String(s ?? "").toLowerCase().trim().replace(/[\s_]+/g, " ");
 
/** Parse CSV text into an array of string arrays. Handles quotes, CRLF, BOM, and ; or tab delimiters. */
export function parseCSV(text) {
  text = String(text ?? "").replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
 
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== "") && !r[0].trim().startsWith("#"));
}
 
/** Read a header like "Speed [offmap, yellow]" into a column spec. */
export function parseHeader(raw) {
  const m = String(raw).match(/^(.*?)\s*(?:\[(.*)\])?\s*$/);
  const label = m[1].trim();
  const mods = (m[2] ?? "").split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const known = KNOWN[squash(label)];
  const spec = {
    header: raw,
    label: known?.label ?? label,
    type: known?.type ?? (SKIP_HEADERS.includes(squash(label)) ? "skip" : "bubble"),
    color: known?.color,
    showOnMap: !known?.offmap,
  };
  for (const mod of mods) {
    if (mod in TYPE_WORDS) spec.type = TYPE_WORDS[mod];
    else if (mod in COLORS) spec.color = COLORS[mod];
    else if (/^\d$/.test(mod)) spec.color = Number(mod);
    else if (mod === "offmap" || mod === "hide" || mod === "hidden") spec.showOnMap = false;
    else if (mod === "onmap" || mod === "show") spec.showOnMap = true;
  }
  return spec;
}
 
/**
 * Turn CSV text into a table: { columns, rows, byName, warnings }.
 * rows: [{ name, cells: string[] }] in file order.
 */
export function buildTable(text) {
  const grid = parseCSV(text);
  const warnings = [];
  if (grid.length < 2) return { columns: [], rows: [], byName: new Map(), nameIndex: 0, warnings: ["The CSV needs a header row and at least one data row."] };
 
  const headers = grid[0].map((h) => h.trim());
  let nameIndex = headers.findIndex((h) => NAME_HEADERS.includes(squash(h.replace(/\[.*\]/, ""))));
  if (nameIndex < 0) {
    nameIndex = 0;
    warnings.push(`No "Name" column found, so the first column ("${headers[0]}") is used as the name.`);
  }
  const columns = headers.map((h, i) => (i === nameIndex ? { header: h, type: "name" } : parseHeader(h)));
 
  // Assign colours to columns without one, cycling like Owl Trackers does.
  let auto = 0;
  for (const col of columns) {
    if (col.type !== "name" && col.type !== "skip" && col.color === undefined) col.color = (5 + auto++ * 2) % 9;
  }
 
  const rows = [];
  const byName = new Map();
  for (const r of grid.slice(1)) {
    const name = (r[nameIndex] ?? "").trim();
    if (!name) continue;
    const key = normName(name);
    if (byName.has(key)) warnings.push(`"${name}" appears more than once; the last row wins.`);
    const row = { name, cells: headers.map((_, i) => (r[i] ?? "").trim()) };
    byName.set(key, row);
    rows.push(row);
  }
  const trackerCols = columns.filter((c) => c.type !== "name" && c.type !== "skip");
  if (trackerCols.length > MAX_TRACKERS) warnings.push(`There are ${trackerCols.length} stat columns, but Owl Trackers shows at most ${MAX_TRACKERS} per token.`);
  return { columns, rows, byName, nameIndex, warnings };
}
 
const newId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
 
function toNumber(s) {
  // First number in the cell: "8" -> 8, "+2" -> 2, "2/4" -> 2, "N/A" -> null (no tracker)
  const m = String(s).match(/[+-]?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
 
/** Build the list of trackers for one CSV row. Blank cells make no tracker. */
export function trackersForRow(table, row) {
  const out = [];
  table.columns.forEach((col, i) => {
    if (col.type === "name" || col.type === "skip") return;
    const cell = row.cells[i] ?? "";
    if (cell === "") return;
    const base = { id: newId() + "-" + i, color: col.color, name: col.label };
    if (!col.showOnMap) base.showOnMap = false;
 
    if (col.type === "bar" || col.type === "bar0") {
      let value, max;
      const frac = cell.match(/^\s*(-?[\d.]+)\s*\/\s*(-?[\d.]+)\s*$/);
      if (frac) { value = Number(frac[1]); max = Number(frac[2]); }
      else {
        max = toNumber(cell);
        if (max === null) return;
        value = col.type === "bar0" ? 0 : max;
      }
      out.push({ ...base, variant: "value-max", value, max });
    } else if (col.type === "check") {
      out.push({ ...base, variant: "checkbox", checked: /^(1|y|yes|true|x|✓|✔)$/i.test(cell) });
    } else {
      const value = toNumber(cell);
      if (value === null) return;
      out.push({ ...base, variant: col.type === "counter" ? "counter" : "value", value });
      if (col.type === "counter") out[out.length - 1].inlineMath = false;
    }
  });
  return out;
}
 
/** Combine new trackers with a token's existing ones. */
export function mergeTrackers(existing, incoming, replaceAll) {
  if (replaceAll || !Array.isArray(existing)) return incoming.slice(0, MAX_TRACKERS);
  const result = existing.map((t) => ({ ...t }));
  for (const t of incoming) {
    const idx = result.findIndex((e) => e && typeof e.name === "string" && normName(e.name) === normName(t.name));
    if (idx >= 0) result[idx] = { ...t, id: result[idx].id };
    else result.push(t);
  }
  return result.slice(0, MAX_TRACKERS);
}
 
/** Names to try for a token: its name and its label, then each with a trailing number/(note) removed. */
export function candidateNames(item) {
  const raw = [item?.name, item?.text?.plainText].filter((s) => typeof s === "string" && s.trim());
  const out = [];
  for (const r of raw) {
    let s = normName(r);
    out.push(s);
    let prev;
    do {
      prev = s;
      s = s.replace(/\s*(\(.*\)|#?\d+|[-–—:])\s*$/, "").trim();
      if (s && s !== prev) out.push(s);
    } while (s !== prev && s);
  }
  return [...new Set(out)];
}
 
export function findRowForItem(table, item) {
  for (const n of candidateNames(item)) {
    const row = table.byName.get(n);
    if (row) return row;
  }
  return null;
}
 
/**
 * Write rows onto items.
 * plan: [{ item, row }]; options: { replaceAll, hidden: "keep" | "hide" | "show" }
 */
export async function applyPlan(OBR, table, plan, options) {
  if (!plan.length) return;
  const byId = new Map(plan.map((p) => [p.item.id, trackersForRow(table, p.row)]));
  await OBR.scene.items.updateItems([...byId.keys()], (items) => {
    for (const item of items) {
      const incoming = byId.get(item.id);
      if (!incoming) continue;
      item.metadata[TRACKERS_KEY] = mergeTrackers(item.metadata[TRACKERS_KEY], incoming, options.replaceAll);
      if (options.hidden === "hide") item.metadata[HIDDEN_KEY] = true;
      if (options.hidden === "show") item.metadata[HIDDEN_KEY] = false;
    }
  });
}
 
/** Saved state in this browser: { csv, fileName, options }. */
export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function saveState(patch) {
  try {
    const next = { ...loadSaved(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the importer still works for this session */
  }
}
export const defaultOptions = { replaceAll: false, hidden: "keep" };
 
