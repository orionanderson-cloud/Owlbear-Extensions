import OBR from "./vendor/obr-sdk.js";
import { ID, openSheet } from "./common.js";

const icon = new URL("icon.svg", import.meta.url).href;
const TOOL_ID = `${ID}/tool`;

function isToken(item) {
  return item && (item.layer === "CHARACTER" || item.layer === "MOUNT");
}

OBR.onReady(async () => {
  // Right-click a token -> "NPC sheet"
  OBR.contextMenu.create({
    id: `${ID}/context-menu`,
    icons: [{
      icon,
      label: "NPC sheet",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [
          { key: "layer", value: "CHARACTER", coordinator: "||" },
          { key: "layer", value: "MOUNT" },
        ],
      },
    }],
    onClick(context) {
      const item = context.items[0];
      if (item) openSheet(OBR, { item: item.id });
    },
  });

  // "Sheet" tool: while it's selected, click (or double-click) a token to open its sheet.
  if ((await OBR.player.getRole()) !== "GM") return;
  await OBR.tool.create({
    id: TOOL_ID,
    icons: [{ icon, label: "NPC Sheets: click a token", filter: { roles: ["GM"] } }],
    shortcut: "N",
  });
  await OBR.tool.createMode({
    id: `${ID}/tool-mode`,
    icons: [{ icon, label: "Open sheet", filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "pointer", filter: { target: [{ key: "layer", value: "CHARACTER", coordinator: "||" }, { key: "layer", value: "MOUNT" }] } }],
    onToolClick(context, event) {
      if (isToken(event.target)) {
        openSheet(OBR, { item: event.target.id });
        return false;
      }
    },
    onToolDoubleClick(context, event) {
      if (isToken(event.target)) {
        openSheet(OBR, { item: event.target.id });
        return false;
      }
    },
  });
});
