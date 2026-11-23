// Shared logic for Lancer NPC Sheets: the NPC data store, matching tokens to
// classes, and turning feature text into HTML.
//
// The NPC data (classes, Grunt, Veteran and Ultra templates) is NOT shipped with
// the extension. The GM loads a JSON file once and it's kept in this browser's
// localStorage, so the book's text is never published on the web.

export const ID = "ringbearer-npc-sheets";
export const DATA_KEY = `${ID}/data`;
export const SHEET_KEY = `${ID}/npc`; // item metadata: { cls, tier, templates[], picks[], gruntType }
export const POPOVER_ID = `${ID}/sheet`;
export const TRACKERS_KEY = "com.owl-trackers/trackers";
export const TEMPLATE_NAMES = ["Veteran", "Ultra"];

// ---------- data store ----------
let cache;
export function loadData() {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    cache = raw ? JSON.parse(raw) : null;
  } catch { cache = null; }
  return cache;
}

export function saveData(text) {
  const data = JSON.parse(text);
  if (!data || data.format !== "ringbearer-npc-sheets/1" || !Array.isArray(data.classes)) {
    throw new Error("That isn't a Lancer NPC Sheets data file.");
  }
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  cache = data;
  return data;
}

export function clearData() {
  localStorage.removeItem(DATA_KEY);
  cache = null;
}

export function allClassNames(data) {
  return [...data.classes.map((c) => c.name), "Grunt"].sort();
}

export function getClass(data, name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === "grunt") return data.grunt;
  return data.classes.find((c) => c.name.toLowerCase() === n) ?? null;
}

export function getTemplate(data, name) {
  return data.templates.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
}

// ---------- token → NPC ----------
export function tokenName(item) {
  return item?.text?.plainText?.trim() || item?.name?.trim() || "";
}

/** Guess class, tier and templates from a token name like "Assault T2 (B)" or "Veteran Sniper 3". */
export function guessFromName(data, name) {
  const lower = ` ${String(name).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  let cls = null;
  for (const c of allClassNames(data)) {
    if (lower.includes(` ${c.toLowerCase()} `)) { cls = c; break; }
  }
  let tier = 1;
  const m = lower.match(/ (?:t|tier )([123]) /);
  if (m) tier = Number(m[1]);
  const templates = TEMPLATE_NAMES.filter((t) => lower.includes(` ${t.toLowerCase()} `));
  return { cls, tier, templates, picks: [], hidden: [], gruntType: null };
}

export function sheetForItem(data, item) {
  const saved = item?.metadata?.[SHEET_KEY];
  if (saved && saved.cls) return { ...defaults(), ...saved, guessed: false };
  return { ...defaults(), ...guessFromName(data, tokenName(item)), guessed: true };
}

function defaults() {
  return { cls: null, tier: 1, templates: [], picks: [], hidden: [], gruntType: null };
}

// ---------- text → HTML ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const ICON_WORDS = {
  kinetic: "kinetic", explosive: "explosive", energy: "energy", burn: "burn", heat: "heat",
  accuracy: "accuracy", difficulty: "difficulty", range: "Range", threat: "Threat",
  blast: "Blast", burst: "Burst", cone: "Cone", line: "Line",
};

/**
 * Render one paragraph of book text.
 * tier: 1-3 to pick from "a/b/c" values, or 0 to show them all.
 */
export function renderText(text, tier) {
  let s = esc(String(text).replace(/([^\s(\[])\{([a-z]+)\}/g, "$1 {$2}"));
  // tiered values: 3/4/5, +1/2/3 (exactly three parts)
  s = s.replace(/(^|[^\d/])(\d+)\/(\d+)\/(\d+)(?![\d/])/g, (m, pre, a, b, c) => {
    if (!tier) return `${pre}<span class="tv">${a}/${b}/${c}</span>`;
    const v = [a, b, c][tier - 1];
    return `${pre}<span class="tv" title="Tier 1/2/3: ${a}/${b}/${c}">${v}</span>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/\{([a-z]+)\}/g, (m, w) => `<span class="ic ic-${w}">${ICON_WORDS[w] ?? w}</span>`);
  s = s.replace(/\[([^\]]+)\]/g, '<span class="br">$1</span>');
  return s;
}

/** A paragraph may contain inline "⬣" bullets; split them into a list. */
export function renderParagraph(text, tier) {
  if (!text.includes("⬣")) return `<p>${renderText(text, tier)}</p>`;
  const [lead, ...items] = text.split("⬣").map((t) => t.trim());
  const li = items.filter(Boolean).map((t) => `<li>${renderText(t, tier)}</li>`).join("");
  return `${lead ? `<p>${renderText(lead, tier)}</p>` : ""}<ul>${li}</ul>`;
}

export function renderFeature(f, tier, opts = {}) {
  const tags = (f.tags ?? []).map((t) => `<div class="tag">${renderText(t, tier)}</div>`).join("");
  const body = (f.body ?? []).map((p) => renderParagraph(p, tier)).join("");
  const toggle = opts.pickable
    ? `<label class="pick" title="Mark as taken by this NPC"><input type="checkbox" data-pick="${esc(opts.key)}" ${opts.picked ? "checked" : ""}/> Taken</label>`
    : "";
  const hide = opts.pickable && opts.picked
    ? `<label class="pick hide" title="Hide this from players"><input type="checkbox" data-hide="${esc(opts.key)}" ${opts.hidden ? "checked" : ""}/> Hidden</label>`
    : "";
  return `<article class="feat${opts.picked ? " picked" : ""}${opts.hidden ? " secret" : ""}">
    <header><span class="fname">${esc(f.name)}</span>${hide}${toggle}</header>
    ${tags ? `<div class="tags">${tags}</div>` : ""}
    ${body ? `<div class="body">${body}</div>` : ""}
  </article>`;
}

export function applyTheme(OBR) {
  return OBR.theme.getTheme().then((theme) => {
    document.documentElement.dataset.mode = theme.mode;
    OBR.theme.onChange((t) => { document.documentElement.dataset.mode = t.mode; });
  }).catch(() => {});
}

/** Open the sheet popover for a token (itemId) or for a class with no token. */
export async function openSheet(OBR, params) {
  const url = new URL("sheet.html", import.meta.url);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  let vw = 1200, vh = 800;
  try { vw = await OBR.viewport.getWidth(); vh = await OBR.viewport.getHeight(); } catch {}
  const width = Math.min(460, vw - 40);
  const height = Math.max(320, Math.min(820, vh - 90));
  await OBR.popover.open({
    id: POPOVER_ID,
    url: url.href,
    width,
    height,
    anchorReference: "POSITION",
    anchorPosition: { left: vw - 16, top: 70 },
    anchorOrigin: { horizontal: "RIGHT", vertical: "TOP" },
    transformOrigin: { horizontal: "RIGHT", vertical: "TOP" },
    disableClickAway: true,
  });
}
