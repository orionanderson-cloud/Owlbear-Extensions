# Lancer NPC Sheets (Owlbear Rodeo extension)

Opens a full NPCs Rebaked sheet for an enemy token: its tier's stats, base and optional
systems (tier numbers filled in), Veteran / Ultra template features and traits, the Grunt types,
tactics and OPFOR notes, plus the token's live Owl Trackers values (HP, Heat, Structure, Stress)
that you can change from the sheet.

Players can open sheets too, in a read-only view (see "What players see" below).

## 1. Host it (same repo as CSV Stat Import)

1. In your `Owlbear-Extensions` repo, upload this whole `lancer-npc-sheets` folder,
   including `vendor/` and `.nojekyll`. Commit.
2. Pages is already on for that repo, so after a minute this should show JSON:
   `https://orionanderson-cloud.github.io/Owlbear-Extensions/lancer-npc-sheets/manifest.json`
3. In Owlbear: Profile > Extensions > Add Extension, paste that URL. In your room, open the
   Extensions menu and switch **Lancer NPC Sheets** on.

If you put it somewhere else, change the four URLs in `manifest.json` to match.

## 2. Load the NPC data (once per browser)

The book text is **not** in this folder, so it never ends up on a public website.
Open the **Lancer NPC Sheets** icon (top-left), click **Load NPC data file**, and pick
`rebake-npc-data.json` (from `lancer-npc-sheets-data.zip`). It's saved in that browser.
Do it again only if you switch browsers or clear site data.

## 3. Use it

- Right-click an enemy token > **NPC sheet**, or
- pick the **NPC Sheets** tool in the toolbar (shortcut **N**) and click any token, or
- search classes, systems and traits in the top-left popover to read a sheet without a token.

The class, tier and templates are guessed from the token name (`Assault T2`, `Veteran Sniper`,
`Ultra Hive Tier 3`, `Grunt 4`). Change them at the top of the sheet; your choice is saved on the token,
along with which optional systems and traits you ticked as **Taken**. Ticked ones are shown first and
the rest fold away.

Numbers like `3/4/5` show only the current tier's value in red (hover for all three). Pick **All** to
see every tier.

The sheet stays open while you play; close it with the ✕.

## What players see

Players get the same right-click item and tool. Each player loads `rebake-npc-data.json` once
in their own browser too (the sheet asks for it the first time).

Their view is read-only and shows only:
- the tier, templates and stats you set on the token,
- the token's Owl Trackers values (unless Owl Trackers has that token hidden from players),
- base systems, template features, and the optional systems / traits you ticked **Taken**.

They never see untaken options, tactics or OPFOR notes. To keep a taken pick secret, tick
**Hidden** next to it on your sheet (it gets a 🔒). Players then see a warning,
"At least one unknown feature", instead of that pick. This hides it on the sheet, but it is still
stored on the token, so a player digging through browser developer tools could find it.

When you open a sheet, the guessed class and tier are saved on the token, so players see the same.

## Files

- `manifest.json`: what Owlbear reads to install the extension
- `background.html/js`: right-click menu item and the NPC Sheets tool
- `sheet.html/js`: the sheet
- `action.html/js`: the top-left popover (load data, browse classes)
- `common.js`, `style.css`: shared code and styles
- `vendor/obr-sdk.js`: Owlbear Rodeo SDK 3.1.0, bundled so there's no build step
