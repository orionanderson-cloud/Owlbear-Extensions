import OBR from "./vendor/obr-sdk.js";
import { loadData, saveData, allClassNames, getClass, openSheet, applyTheme } from "./common.js";

const $ = (id) => document.getElementById(id);
let data = loadData();
let ready = false;

function setStatus(text, kind = "") { $("status").textContent = text; $("status").className = kind; }

function searchText(doc) {
  const parts = [doc.name, doc.role];
  for (const g of doc.groups ?? []) for (const f of g.features ?? []) parts.push(f.name);
  for (const f of doc.veteranTrait ?? []) parts.push(f.name);
  return parts.join(" ").toLowerCase();
}

function render() {
  $("openSel").disabled = !ready || !data;
  $("browse").hidden = !data;
  if (!data) { $("loaded").textContent = "No NPC data loaded."; return; }
  $("loaded").textContent = `${data.classes.length} classes + Grunt, Veteran and Ultra loaded.`;
  const q = $("q").value.trim().toLowerCase();
  const names = allClassNames(data).filter((n) => !q || searchText(getClass(data, n)).includes(q));
  $("list").innerHTML = "";
  for (const n of names) {
    const c = getClass(data, n);
    const b = document.createElement("button");
    b.innerHTML = `<span>${n}</span><span class="r">${c.role ?? ""}</span>`;
    b.onclick = () => {
      if (ready) openSheet(OBR, { cls: n });
      else window.open(`sheet.html?cls=${encodeURIComponent(n)}`, "_blank");
    };
    $("list").appendChild(b);
  }
}

$("pick").onclick = () => $("file").click();
$("file").onchange = async () => {
  try {
    data = saveData(await $("file").files[0].text());
    setStatus("NPC data loaded.", "ok");
  } catch (err) { setStatus(err.message, "err"); }
  $("file").value = "";
  render();
};
$("q").oninput = render;
$("openSel").onclick = async () => {
  const ids = await OBR.player.getSelection();
  if (!ids?.length) return setStatus("Select a token first.", "warn");
  openSheet(OBR, { item: ids[0] });
};

render();
if (window.parent !== window) {
  OBR.onReady(async () => {
    ready = true;
    await applyTheme(OBR);
    render();
  });
}
