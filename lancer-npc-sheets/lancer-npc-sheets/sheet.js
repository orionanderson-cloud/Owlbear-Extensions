import OBR from "./vendor/obr-sdk.js";
import {
  POPOVER_ID, SHEET_KEY, TRACKERS_KEY, TEMPLATE_NAMES,
  loadData, saveData, allClassNames, getClass, getTemplate, sheetForItem, tokenName,
  renderParagraph, renderFeature, applyTheme,
} from "./common.js";

const $ = (id) => document.getElementById(id);
const params = new URL(location.href).searchParams;
const itemId = params.get("item");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let data = loadData();
let item = null;
let sheet = {
  cls: params.get("cls"), tier: Number(params.get("tier")) || 1, templates: [], picks: [], gruntType: null, guessed: false,
};
let showTier = sheet.tier; // 0 = show every tier's numbers
let inOBR = false;

// ---------- saving ----------
async function persist() {
  if (!item || !inOBR) return;
  const { guessed, ...save } = sheet;
  await OBR.scene.items.updateItems([item.id], (items) => {
    for (const it of items) it.metadata[SHEET_KEY] = save;
  });
  sheet.guessed = false;
}

// ---------- trackers (Owl Trackers) ----------
function trackersHTML() {
  const list = item?.metadata?.[TRACKERS_KEY];
  if (!Array.isArray(list) || list.length === 0) return "";
  return `<div class="trackers">${list.map((t, i) => {
    const name = esc(t.name || "");
    if (t.variant === "checkbox") {
      return `<label class="trk"><span class="n">${name}</span><input type="checkbox" data-trk="${i}" data-f="checked" ${t.checked ? "checked" : ""}/></label>`;
    }
    const max = t.variant === "value-max" ? `<span class="max">/ ${esc(t.max)}</span>` : "";
    return `<div class="trk"><span class="n">${name}</span>
      <button data-step="${i}" data-d="-1">−</button>
      <input type="number" data-trk="${i}" data-f="value" value="${esc(t.value)}"/>${max}
      <button data-step="${i}" data-d="1">+</button></div>`;
  }).join("")}</div>`;
}

async function setTracker(index, field, value) {
  if (!item) return;
  await OBR.scene.items.updateItems([item.id], (items) => {
    const list = items[0].metadata[TRACKERS_KEY];
    if (!Array.isArray(list) || !list[index]) return;
    list[index][field] = value;
  });
}

// ---------- rendering ----------
function statsHTML(cls) {
  if (!cls.tiers) return "";
  const tiers = showTier ? [showTier] : [1, 2, 3];
  const get = (k) => tiers.map((t) => cls.tiers[t - 1]?.[k] ?? "–");
  const val = (k) => {
    const v = get(k);
    return v.length === 1 ? esc(v[0]) : `${esc(v.join("/"))} <small>T1/2/3</small>`;
  };
  const cells = [
    ["HP", "HP"], ["Armor", "Armor"], ["Evasion", "Evasion"], ["E-Def", "E-Defense"],
    ["Heat Cap", "Heat Cap"], ["Speed", "Speed"], ["Sensors", "Sensors"], ["Save", "Save Target"],
    ["Size", "Size"],
  ];
  const hase = ["HULL", "AGILITY", "SYSTEMS", "ENGINEERING"]
    .map((k) => `<span>${k[0]} ${esc(get(k).join("/"))}</span>`).join("");
  return `<div class="hase" title="Hull / Agility / Systems / Engineering">${hase}</div>
    <div class="stats">${cells.map(([label, key]) => `<div class="stat"><div class="k">${label}</div><div class="v">${val(key)}</div></div>`).join("")}</div>`;
}

function pickKey(scope, f) { return `${scope}:${f.name}`; }

// entries: features, or { f, scope } pairs when one list mixes scopes.
// fold: always fold away what isn't taken (templates); otherwise show everything until something is taken.
function featureList(entries, scope, { pickable = false, fold = false } = {}) {
  const list = entries.map((e) => (e.f ? e : { f: e, scope }));
  if (!pickable) return list.map((e) => renderFeature(e.f, showTier)).join("");
  const isPicked = (e) => sheet.picks.includes(pickKey(e.scope, e.f));
  const picked = list.filter(isPicked);
  const rest = list.filter((e) => !isPicked(e));
  const card = (e, on) => renderFeature(e.f, showTier, { pickable: true, key: pickKey(e.scope, e.f), picked: on });
  if (picked.length === 0 && !fold) return rest.map((e) => card(e, false)).join("");
  const label = picked.length ? `${rest.length} not taken` : `${rest.length} to choose from`;
  return picked.map((e) => card(e, true)).join("") +
    (rest.length ? `<details><summary>${label}</summary><div class="group">${rest.map((e) => card(e, false)).join("")}</div></details>` : "");
}

function groupsHTML(doc, scope, { fold = false, extra = null } = {}) {
  let main = "", notes = "";
  for (const g of doc.groups) {
    const title = (g.title || "").toUpperCase();
    if (doc === data.grunt && g.sub && g.sub !== sheet.gruntType) continue;
    const text = (g.text ?? []).map((p) => renderParagraph(p, showTier)).join("");
    if (title.includes("TACTIC") || title.includes("OPFOR")) {
      notes += `<h3>${esc(g.title)}</h3><div class="prose">${text}</div>`;
      continue;
    }
    const pickable = title.includes("OPTIONAL") || title.includes("GENERAL VETERAN") || title.includes("ULTRA SYSTEMS");
    const heading = g.sub ? `${g.title ? `${g.title} · ` : ""}${g.sub}` : g.title;
    let feats = g.features ?? [];
    let shownHeading = heading;
    // Veteran: the class trait is an alternative to the general traits, so they share one pick list.
    if (extra && title.includes("GENERAL VETERAN")) {
      feats = [...extra.map((f) => ({ f, scope: "Veteran/class" })), ...feats.map((f) => ({ f, scope: `${scope}/${g.title}` }))];
      shownHeading = "Veteran traits (class or general)";
    }
    main += `<section class="group">${shownHeading ? `<h2>${esc(shownHeading)}</h2>` : ""}${text ? `<div class="prose">${text}</div>` : ""}${featureList(feats, `${scope}/${g.title}`, { pickable, fold: fold && pickable })}</section>`;
  }
  return { main, notes };
}

function render() {
  if (!data) return renderNoData();
  const cls = getClass(data, sheet.cls);
  const name = item ? tokenName(item) || "(unnamed token)" : cls?.name ?? "NPC sheet";

  const classOpts = [`<option value="">Pick a class…</option>`, ...allClassNames(data).map((n) =>
    `<option ${cls && n.toLowerCase() === cls.name.toLowerCase() ? "selected" : ""}>${esc(n)}</option>`)].join("");
  const tierSeg = [1, 2, 3, 0].map((t) =>
    `<button data-tier="${t}" class="${showTier === t ? "on" : ""}" title="${t ? `Tier ${t}` : "Show all tiers"}">${t ? `T${t}` : "All"}</button>`).join("");
  const tmpl = cls === data.grunt ? "" : TEMPLATE_NAMES.map((t) =>
    `<label class="chk"><input type="checkbox" data-tmpl="${t}" ${sheet.templates.includes(t) ? "checked" : ""}/> ${t}</label>`).join("");
  const gruntTypes = cls === data.grunt
    ? `<select id="gruntType"><option value="">Grunt type…</option>${data.grunt.groups.filter((g) => g.sub).map((g) =>
      `<option ${g.sub === sheet.gruntType ? "selected" : ""} value="${esc(g.sub)}">${esc(g.sub.replace("-TYPE", "").toLowerCase().replace(/^./, (c) => c.toUpperCase()))}</option>`).join("")}</select>`
    : "";

  let body = "";
  if (!cls) {
    body = `<div class="muted">${item ? `Couldn't tell the class from the name “${esc(name)}”. Pick one above; it's saved on the token.` : "Pick a class above."}</div>`;
  } else {
    const own = groupsHTML(cls, cls.name);
    let templates = "";
    for (const t of sheet.templates) {
      const tdoc = getTemplate(data, t);
      if (!tdoc) continue;
      const extra = t === "Veteran" ? (cls.veteranTrait ?? []).map((f) => ({ ...f, tags: [`${cls.name} class trait`, ...(f.tags ?? [])] })) : null;
      const g = groupsHTML(tdoc, t, { fold: true, extra });
      templates += `<h1 class="tmpl-title">${esc(t)} template</h1>${g.main}`;
    }
    body = `
      ${trackersHTML()}
      ${statsHTML(cls)}
      ${own.main}
      ${templates}
      ${own.notes ? `<details><summary>Tactics and OPFOR notes</summary>${own.notes}</details>` : ""}
      <div class="muted">${esc(cls.source || "")}</div>`;
  }

  document.body.innerHTML = `<div class="sheet">
    <div class="top">
      <div class="title"><h1>${esc(name)}</h1><span class="role">${esc(cls?.role ?? "")}</span>
        ${inOBR ? `<button class="close" id="close" title="Close">✕</button>` : ""}</div>
      <div class="row"><select id="cls">${classOpts}</select>${gruntTypes}<span class="seg">${tierSeg}</span></div>
      <div class="row">${tmpl}${sheet.guessed && cls ? `<span class="muted">Guessed from the token name</span>` : ""}</div>
    </div>
    <div class="scroll">${body}</div>
  </div>`;
  wire();
}

function renderNoData() {
  document.body.innerHTML = `<div class="empty">
    <b>No NPC data loaded in this browser.</b>
    <div class="muted">Load <code>rebake-npc-data.json</code> once. It stays in this browser until you clear site data.</div>
    <div class="row"><button class="primary" id="pick">Load NPC data file</button>${inOBR ? `<button id="close">Close</button>` : ""}</div>
    <input type="file" id="file" accept=".json,application/json" hidden />
    <div id="status"></div>
  </div>`;
  $("pick").onclick = () => $("file").click();
  $("file").onchange = async () => {
    try {
      data = saveData(await $("file").files[0].text());
      if (item) sheet = sheetForItem(data, item);
      render();
    } catch (err) {
      $("status").textContent = err.message; $("status").className = "err";
    }
  };
  if ($("close")) $("close").onclick = () => OBR.popover.close(POPOVER_ID);
}

function wire() {
  const scroll = document.querySelector(".scroll");
  const keep = (fn) => async (...a) => { const y = scroll?.scrollTop ?? 0; await fn(...a); render(); const s = document.querySelector(".scroll"); if (s) s.scrollTop = y; };

  if ($("close")) $("close").onclick = () => OBR.popover.close(POPOVER_ID);
  $("cls").onchange = keep(async () => {
    sheet.cls = $("cls").value || null; sheet.picks = []; sheet.gruntType = null; await persist();
  });
  if ($("gruntType")) $("gruntType").onchange = keep(async () => { sheet.gruntType = $("gruntType").value || null; await persist(); });
  document.querySelectorAll("[data-tier]").forEach((b) => {
    b.onclick = keep(async () => {
      showTier = Number(b.dataset.tier);
      if (showTier) { sheet.tier = showTier; await persist(); }
    });
  });
  document.querySelectorAll("[data-tmpl]").forEach((c) => {
    c.onchange = keep(async () => {
      const t = c.dataset.tmpl;
      sheet.templates = c.checked ? [...new Set([...sheet.templates, t])] : sheet.templates.filter((x) => x !== t);
      await persist();
    });
  });
  document.querySelectorAll("[data-pick]").forEach((c) => {
    c.onchange = keep(async () => {
      const k = c.dataset.pick;
      sheet.picks = c.checked ? [...new Set([...sheet.picks, k])] : sheet.picks.filter((x) => x !== k);
      await persist();
    });
  });
  document.querySelectorAll("[data-step]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.step);
      const t = item.metadata[TRACKERS_KEY][i];
      setTracker(i, "value", Number(t.value || 0) + Number(b.dataset.d));
    };
  });
  document.querySelectorAll("input[data-trk]").forEach((inp) => {
    inp.onchange = () => {
      const v = inp.dataset.f === "checked" ? inp.checked : Number(inp.value);
      setTracker(Number(inp.dataset.trk), inp.dataset.f, v);
    };
  });
}

// ---------- start ----------
function startStandalone() {
  // Opened outside Owlbear (for previewing): just browse classes.
  // ?demo=Token%20Name previews a sheet for a pretend token with Owl Trackers values.
  const demo = params.get("demo");
  if (demo && data) {
    item = {
      id: "demo", name: demo, metadata: {
        [TRACKERS_KEY]: [
          { id: "1", name: "HP", variant: "value-max", value: 13, max: 18, color: 6 },
          { id: "2", name: "Heat", variant: "value-max", value: 4, max: 8, color: 2 },
          { id: "3", name: "Structure", variant: "counter", value: 1, color: 6 },
          { id: "4", name: "Stress", variant: "counter", value: 1, color: 2 },
        ],
      },
    };
    sheet = sheetForItem(data, item);
    showTier = sheet.tier;
  }
  if (params.get("dark")) document.documentElement.dataset.mode = "DARK";
  render();
}

if (window.parent === window) {
  startStandalone();
} else {
  OBR.onReady(async () => {
    inOBR = true;
    await applyTheme(OBR);
    if (itemId) {
      const [it] = await OBR.scene.items.getItems([itemId]);
      item = it ?? null;
      if (item && data) sheet = sheetForItem(data, item);
      showTier = sheet.tier || 1;
      OBR.scene.items.onChange((items) => {
        const next = items.find((i) => i.id === itemId);
        if (!next) { OBR.popover.close(POPOVER_ID); return; }
        const changed = JSON.stringify(next.metadata) !== JSON.stringify(item.metadata) || tokenName(next) !== tokenName(item);
        item = next;
        if (changed) {
          const focused = document.activeElement;
          if (focused && focused.matches("input[type=number]")) return; // don't clobber typing
          const y = document.querySelector(".scroll")?.scrollTop ?? 0;
          const saved = item.metadata[SHEET_KEY];
          if (saved && saved.cls) sheet = { ...sheet, ...saved, guessed: false };
          render();
          const s = document.querySelector(".scroll"); if (s) s.scrollTop = y;
        }
      });
    }
    render();
  });
}
