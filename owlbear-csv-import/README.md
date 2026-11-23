# CSV Stat Import (Owlbear Rodeo extension)

Loads a CSV of stats and writes them onto tokens as **Owl Trackers** bars and bubbles,
so HP, Heat, Structure, Stress and the rest show up without typing them in.

It writes the exact data Owl Trackers reads (`com.owl-trackers/trackers` on each token),
so Owl Trackers must be installed and enabled in the room too.

## 1. Host it on GitHub Pages (one time, about 5 minutes)

1. On GitHub, click **New repository**. Name it e.g. `owlbear-csv-import`, make it **Public**, and create it.
2. On the new repo page, click **uploading an existing file** (or **Add file > Upload files**).
   Drag in everything in this folder **including the `vendor` folder** and the `.nojekyll` file
   (on a Mac press Cmd+Shift+. in the file picker to see dot files). Click **Commit changes**.
3. Go to **Settings > Pages**. Under *Build and deployment*, pick **Deploy from a branch**,
   branch **main**, folder **/ (root)**, and click **Save**.
4. Wait a minute, then open `https://YOUR-USERNAME.github.io/owlbear-csv-import/manifest.json`.
   If you see the JSON, it's live. That address is your **manifest URL**.

## 2. Install it in Owlbear Rodeo

1. Go to your Owlbear Rodeo **Profile** page and find **Extensions**.
2. Click **Add Extension** (the custom extension button), paste the manifest URL, and confirm.
3. Open your room, click the **Extensions** (puzzle piece) button in the room, and switch
   **CSV Stat Import** on. Owl Trackers should be on as well.

## 3. Use it

1. Click the **CSV Stat Import** icon in the top-left toolbar and **Load CSV file**
   (or **Paste CSV**). The CSV is remembered in this browser, so you only load it again when it changes.
2. Name your tokens after the CSV rows, e.g. `Assault`, `Assault 2`, `Goliath T2 (B)`.
   Trailing numbers and anything in brackets are ignored when matching. The token's label counts too.
3. Select tokens and click **Apply to selected tokens by name**, or right-click tokens and choose
   **Apply CSV stats** (GM only, uses the same settings).
4. Or pick a row from the dropdown and **Apply** it to every selected token, whatever they're called.

Options:
- **Remove the token's other trackers first**: off by default, which updates trackers with the same
  name (keeping where they sit) and leaves any others alone.
- **Players see stats**: can set Owl Trackers' "hidden" flag so only the GM sees enemy numbers.

Applying again resets the bars (HP back to full, Heat back to 0), so do it before the fight.

## CSV format

```
Name,HP,Heat,Structure,Stress,Armor,Evasion,E-Def,Speed [offmap]
Assault,15,8,1,1,1,8,8,4
Example Ultra,30/40,3/10,2/4,4,2,6,8,3
```

- **Name** (or Class, NPC, Token) is the column matched against token names. Upper/lower case doesn't matter.
- **HP, Structure, Stress** become bars that start full. **Heat** becomes a bar that starts at 0 with the number as its cap.
- Any other number column becomes a bubble. **Role, Tier, Template, Notes, Description, Tags, Size, Source, Hull, Agility, Systems, Engineering** are kept for reference but not turned into trackers. To track one, add a type, e.g. `Hull [bubble, offmap]`. Text like `N/A` makes no tracker.
- `value/max` in a cell sets a bar part-way, e.g. `30/40`.
- A blank cell means that token doesn't get that tracker.
- Rows whose first cell starts with `#` are ignored (handy for comments).
- Comma, semicolon and tab separated files all work, so Excel and Google Sheets exports are fine.
- Owl Trackers shows at most 12 trackers per token.

Header options go in square brackets, separated by commas, e.g. `Overshield [counter, cyan]`:

| Option | Effect |
| --- | --- |
| `bar` | bar that starts full |
| `bar0` | bar that starts at 0 (like Heat) |
| `bubble` | single number |
| `counter` | counter with +/- |
| `check` | checkbox (`yes`, `x`, `1`, `true` = ticked) |
| `skip` | ignore this column |
| `offmap` | tracked, but not drawn on the map (still in the token's Owl Trackers menu) |
| `red`, `orange`, `yellow`, `lime`, `green`, `cyan`, `blue`, `pink`, `fuchsia` | colour |

## Files

- `manifest.json`: what Owlbear reads to install the extension
- `action.html` / `action.js`: the popover
- `background.html` / `background.js`: the right-click menu item
- `lib.js`: CSV parsing and the Owl Trackers data format
- `vendor/obr-sdk.js`: the Owlbear Rodeo SDK 3.1.0, bundled so there's no build step
- `sample/lancer-npcs.csv`: Tier 1–3 stats for every class in NPCs Rebaked 1.2 and Wallflower NPCs Rebaked
  (rows are named `Assault`, `Assault T2`, `Assault T3`)
- `sample/template.csv`: a small example showing the format
