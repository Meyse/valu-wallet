# Valu Wallet design language

This file is the design contract for the Valu Wallet redesign. Every new or
redesigned screen, in design and in React Native code, uses this one visual
language.

## Authority and sources

- The design authority is the Paper file "Valu Wallet" (file id
  `01M89HJ2BND3D69WKW4EER5PC7`, page "Page 1"). Its 13 artboards come from the
  Figma file of the design team that Valu hired.
- This document records the values in that file. All values come from
  `get_jsx`, `get_computed_styles`, `get_fill_image`, `find_nodes`, and the
  asset files that the nodes reference. Screenshots were used only to
  understand layout.
- If this document and the Paper file disagree, the Paper file wins. Report the
  difference. Do not change either one without a decision from Max.
- If the source code and this document disagree, report it. The source shows
  what the app does now. This document shows what the redesign must look like.
- The Paper file has no design tokens. The token names in this document are a
  proposal.
- A value that the designs do not show is not in this document. It is in
  [Open points](#open-points). Do not invent it.

### Artboards

| Artboard | Size | What it shows |
| --- | --- | --- |
| Onboarding 01 - Splash | 402 × 874 | Logo glyph on the screen background |
| Onboarding 02 - Take control | 402 × 874 | Gradient glow, app icon, title, primary button, text button |
| Onboarding 03 - Sign in | 402 × 874 | Glass panel with two text fields and a primary button, system keyboard |
| Onboarding 04 - Device key | 402 × 874 | Step screen: step icon, title, body, next steps, primary button |
| Onboarding 05 - Device key alert | 402 × 874 | Screen 04 under a dim overlay with an alert |
| Onboarding 06 - Connect account | 402 × 874 | Step screen with one done step |
| Onboarding 07 - Camera alert | 402 × 874 | Screen 06 under a dim overlay with an alert |
| Onboarding 08 - Scan QR | 402 × 874 | Camera scanner with scrim and corner marks |
| Onboarding 09 - Accept credentials | 402 × 874 | Step screen with two done steps and an identity name |
| Onboarding 10 - Key accepted | 402 × 874 | Bottom sheet over a blurred background |
| Onboarding 11 - Home | 393 × 852 | Icon buttons, welcome card, activity row, tab bar |
| Crypto - Empty balance | 393 × 852 | Balance display (zero), asset row, action grid, tab bar |
| Money - With balance | 393 × 852 | Balance display ($85.27), asset row, action grid, tab bar |

The status bar, the home indicator, the keyboard and the device corner radius
(62 px on 402-wide artboards, 55 px on 393-wide artboards) are iOS system
chrome. They are not part of this design language. Do not copy their values
into tokens.

## Character

- Dark only. Every artboard uses a near-black neutral background (`#292929`).
- One colour moment per screen. The onboarding screens use a large, soft
  gradient glow at the top. The tab screens use no glow; small coloured icon
  discs carry the colour.
- Flat neutral surfaces with a 1 px black outline. No shadows anywhere
  (`find_nodes` for `boxShadow` returns 0 nodes).
- Large rounded shapes: 24 px on buttons, cards, panels and sheets; full
  pills on the tab bar and icon buttons.
- One typeface (Inter), two weights (400 and 600), no letter spacing.
- Outline icons with round caps and round joins.

## Colour

All hex values are exact. An 8-digit hex value has alpha in the last two
digits (for example `#00000052` is black at 32 %).

### Neutral surfaces

| Proposed token | Value | Role | Where it appears |
| --- | --- | --- | --- |
| `--color-surface` | `#292929` | Screen background. Also sheet background. | All artboards except 08; "Modal" on 10 |
| `--color-surface-card` | `#1F1F1F` | Card background | "Welcome card" on 11 |
| `--color-surface-raised` | `#3D3D3D` | App icon tile. Scanner background. | "App icon" on 02–07, 09; artboard 08 |
| `--color-surface-glass` | `#292929B3` | Glass panel over the glow (with `backdrop-filter: blur(32px)`) | "Panel" on 03 |
| `--color-fill-subtle` | `#00000052` | List row and action card fill | "Activity row" on 11; action cards on Crypto and Money |
| `--color-fill-field` | `#0000000F` | Text field fill | Text fields on 03 |
| `--color-fill-icon-button` | `#FFFFFF1A` | Round icon button fill | "Scan button", "Settings button" on 11 |
| `--color-tabbar` | `#3C3C3CB3` | Tab bar background | "Tab bar" on 11, Crypto, Money |
| `--color-tab-active` | `#3F3F3F` | Active tab pill | Active tab on 11, Crypto, Money |
| `--color-backdrop` | `#26272A` | Base of the blurred background behind a sheet | "Blurred background" on 10 |

### Text and lines

| Proposed token | Value | Role | Where it appears |
| --- | --- | --- | --- |
| `--color-text` | `#FFFFFF` | Primary text, titles, icon strokes | All screens |
| `--color-text-secondary` | `#EBEBEB` | Secondary text: subtitles, meta, tab labels, step labels | 03, 04, 06, 09, 11, Crypto, Money |
| `--color-text-muted` | `#737373` | De-emphasised part of an identity name | ".valuid@" suffix on 09 |
| `--color-text-on-primary` | `#3D3D3D` | Label on the primary button | All primary buttons |
| `--color-border` | `#000000` | 1 px outline on buttons, cards, panels, sheets | Primary button, panel, welcome card, action cards, sheet |
| `--color-border-subtle` | `#FFFFFF14` | 1 px outline on the tab bar | Tab bar |

Two opacity values make text quieter. The designs apply them as `opacity` on
the text node, not as a new colour.

| Proposed token | Value | Use |
| --- | --- | --- |
| `--opacity-step` | `60%` | Step labels (done and next) on `--color-text-secondary`. Done-step check icon (opacity 0.6 inside the SVG). |
| `--opacity-placeholder` | `40%` | Text field placeholder on `--color-text`. Zero amount "0 VRSC" on `--color-text-secondary`. |

The zero balance uses a colour with alpha, not node opacity: the digits
"0.00" are `#FFFFFF66` (white at 40 %). Propose `--color-text-placeholder:
#FFFFFF66` for that case.

### Brand and accent

| Proposed token | Value | Role | Where it appears |
| --- | --- | --- | --- |
| `--color-primary` | `#FAFAFA` | Primary button fill. Text button label. | All primary buttons; "Recover vault" on 02 |
| `--color-accent` | `#1F89FA` | Focus, selection and the blue step | Focused text field border (03), active tab icon and label, "Device key" step icon (04, 05), Receive icon disc |
| `--color-success` | `#42DF5E` | Completed or confirmed state | Key icon on 10, check-badge icon on welcome card (11), smile icon on 09 |
| `--color-success-soft` | `#90F993` | Small link icon next to the balance label | "Balance link icon" on Money |
| `--color-highlight` | `#FFD56F` | The yellow step | "Connect account" step icon on 06, 07 |

### Category colours (icon discs)

| Proposed token | Value | Where it appears |
| --- | --- | --- |
| `--color-action-receive` | `#1F89FA` | Receive card icon disc |
| `--color-action-transfer` | `#F153AB` | Transfer card icon disc |
| `--color-action-buy` | `#899BFF` | Buy card icon disc |
| `--color-action-sell` | `#5DB9BA` | Sell card icon disc |
| `--color-asset-vrsc` | `#3165D4` | Verus asset disc (also the fill inside the VRSC logo SVG) |

### Alert and overlay colours

The alert follows the iOS system alert. Its colours are light on purpose.

| Proposed token | Value | Role |
| --- | --- | --- |
| `--color-scrim` | `#28283066` | Dim overlay behind an alert ("Dim overlay" on 05, 07) |
| `--color-alert-surface` | `#CDCDD0EB` | Alert background |
| `--color-alert-text` | `#000000` | Alert title, message and secondary button label |
| `--color-alert-button` | `#78788052` | Alert secondary button ("No") |
| `--color-alert-confirm` | `#0A72EA` | Alert confirm button ("Yes"), label `#FFFFFF` |
| `--color-scanner-scrim` | `#000000` at 50 % | Scanner scrim with a square cutout (SVG path with `opacity="0.5"`) |

### Brand gradient stops

The app avatar on "Activity row" (11) uses a conic gradient. The glow images
use the same hues (see [Gradient glow](#gradient-glow)).

```
conic-gradient(in oklab from 90deg at 50% 50%,
  #B1FFCA 0%, #7BFEA4 14.29%, #45FC7E 28.57%, #33E4BF 42.86%,
  #21CBFF 57.14%, #51A4FD 71.43%, #81D2E4 85.71%, #B1FFCA 100%)
```

| Proposed token | Value |
| --- | --- |
| `--color-brand-mint` | `#B1FFCA` |
| `--color-brand-green-light` | `#7BFEA4` |
| `--color-brand-green` | `#45FC7E` |
| `--color-brand-teal` | `#33E4BF` |
| `--color-brand-cyan` | `#21CBFF` |
| `--color-brand-blue` | `#51A4FD` |
| `--color-brand-sky` | `#81D2E4` |

## Gradient glow

The designs have no gradient header bar. The "gradient header" is a large,
soft, blurred glow at the top of the onboarding screens.

### What it is

- A raster PNG, 1228 × 1398 px (2× of the 614 × 699 node). It is not a CSS
  gradient.
- Shape: a soft, egg-shaped ellipse with grain (noise), on a transparent
  background. The corners have alpha 0. The centre has alpha about 230–240.
- The screen background (`#292929`) shows through the transparent area.

### Placement (the same on every screen that has it)

- Outer frame "Gradient glow": 630 × 678, `position: absolute`, content
  centred.
- Inner frame: 461 × 547, `rotate: -21.57deg`, `transform-origin: 50% 50%`.
- Image node: 614 × 699 at `left: -76px; top: -76px` inside the inner frame,
  `background-size: 100% 100%`.
- The frame position changes per screen:

| Screens | Frame `left`, `top` | Image (by content) | Sampled colours (centre of the ellipse) |
| --- | --- | --- | --- |
| 02 Take control, 03 Sign in | −162, −193 | Glow A: blue left, green right | `#2EC0FE` (left), `#48FB85` (right), `#A0F4CD` (top), `#4CE1C5` (centre) |
| 04 Device key, 05 Device key alert | −176, −260 | Glow B: mirror of A, green left, blue right | `#59FC8D` (left), `#24CBF9` (right), `#A0F3CD` (top) |
| 06 Connect account, 07 Camera alert | −89, −279 | Glow C: yellow left, green right | `#F0E153` (left), `#4EFC80` (right), `#B5FABC` (top), `#A6F076` (centre) |
| 09 Accept credentials | −176, −260 | Glow D: green | `#5AFC8C` (left), `#86F790` (right), `#96F7BA` (top), `#67F48D` (centre) |

The sampled colours are 25 × 25 px averages read from the PNG files. Use them
to describe the glow. Do not build the glow from them as stops.

### Hex overlay

Screens 02, 04, 06 and 09 add a "Hex overlay" over the glow: a 186 × 206 frame
with `mix-blend-mode: overlay`. It holds an SVG hexagon outline (values read
from the file on 02: 386 × 406,
opacity 0.5, Gaussian blur `stdDeviation="50"`, fill `#FAFAFA`, stroke
0.66 px with white and black gradients at 8 %). Position (`left`, `top`):
02 at (117, 162), 04 at (176, 160), 06 at (134, 45), 09 at (13, 56). Screens
03, 05 and 07 do not have it.

### Rules

- Do: use the glow only on onboarding and step screens.
- Do: match the glow hue to the step colour. The designs pair the blue step
  icon (`#1F89FA`, Device key) with blue-green glows A/B, the yellow step icon
  (`#FFD56F`, Connect account) with yellow-green glow C, and the green icon
  (`#42DF5E`, Accept credentials) with green glow D. This pairing is an
  inference from the four screens.
- Do: ship the PNG files as image assets. Keep the rotation and the offset.
- Do not: put the glow on tab screens (Home, Crypto, Money have none).
- Do not: put text directly on the brightest part of the glow. In the designs,
  only the app icon tile sits on the glow; text starts below it.
- Do not: replace the glow with a linear gradient bar.

## Typography

Family: Inter, with `system-ui, sans-serif` as fallback. The status bar uses
`system-ui` (system chrome). No serif face appears anywhere.

Weights: 400 (Regular) and 600 (SemiBold) only. `find_nodes` finds no weight
500 or 700.

Letter spacing: none. No node sets `letterSpacing` (`find_nodes` returns 0).
Use `0`.

Text transform: none. No uppercase labels.

| Role | Proposed tokens | Size / line height | Weight | Colour | Where it appears |
| --- | --- | --- | --- | --- | --- |
| Display (balance) | `--text-display`, `--leading-display` | 48 / 58 | 600 | `--color-text` | "Balance" on Crypto, Money |
| Title | `--text-title`, `--leading-title` | 28 / 36 | 600 | `--color-text` | Screen titles 02, 04, 06; sheet title 10; identity name 09 |
| Title (card) | — | 28 / 34 | 600 | `--color-text` | "Welcome message" on 11 (see Open points) |
| Alert title | `--text-alert`, `--leading-alert` | 17 / 22 | 600 | `--color-alert-text` | Alerts on 05, 07; alert button labels |
| Alert message | `--text-alert`, `--leading-alert` | 17 / 22 | 400 | `--color-alert-text` | Alerts on 05, 07 |
| Label large | `--text-label`, `--leading-label` | 16 / 19 | 600 | `--color-text` | Button labels, panel title, section header "Activity", row title, card title, asset name, step labels |
| Body large | `--text-body-lg`, `--leading-body-lg` | 16 / 19 | 400 | `--color-text` or `--color-text-secondary` | Subtitles under titles on 02, 04, 06, 09 |
| Body | `--text-body`, `--leading-body` | 14 / 18 | 400 | `--color-text` or `--color-text-secondary` | Panel subtitle, field text, text button, card and sheet body |
| Label small | `--text-label-sm`, `--leading-label-sm` | 13 / 16 | 600 | `--color-text` | "Total Balance" |
| Caption | `--text-caption`, `--leading-caption` | 12 / 15 | 400 | `--color-text` or `--color-text-secondary` | Row meta, action card description, asset amount |
| Tab label | `--text-tab`, `--leading-tab` | 10 / 12 | 600 | `--color-text-secondary`, active `--color-accent` | Tab bar |

Mixed sizes inside one line:

- Identity name (09): "firstname_lastname" at 28 / 36 / 600 `#FFFFFF`, then
  "." at 28 px `#737373`, then "valuid@" at 16 px `#737373`. Same baseline.
- Zero balance (Crypto): "$" at `#FFFFFF`, then "0.00" at `#FFFFFF66`.

Text button: 14 / 18 / 400, `#FAFAFA`, `text-decoration: underline 1px`,
underline position from the font ("Recover vault" on 02).

Rules:

- Do: use only the roles above.
- Do: use 600 for every label and title, 400 for every sentence.
- Do not: add a third weight, letter spacing, italics or uppercase.
- Do not: set text smaller than 12 px, except the tab label (10 px).

## Spacing

Values read from gaps, paddings and positions. Px values are in points (iOS)
and dp (Android).

| Proposed token | Value | Where it appears |
| --- | --- | --- |
| `--spacing-1` | 4 px | Tab bar inline padding; alert text inline padding; keyboard row gap (system) |
| `--spacing-2` | 8 px | Title-to-body gap; icon-to-label gap in step and section header; alert text gap; alert button gap |
| `--spacing-3` | 12 px | Row icon-to-text gap; asset row gap |
| `--spacing-4` | 16 px | Text field padding; icon-to-text block gap; alert padding and gap; action card padding and grid gap; row top padding; tab screen gutter |
| `--spacing-5` | 20 px | Page gutter on 02 and 03 |
| `--spacing-6` | 24 px | Card, sheet and panel content padding; gap between next steps (04); gap inside glass panel |
| `--spacing-8` | 32 px | Glass panel padding |
| `--spacing-9` | 36 px | Page gutter on step screens 04–09 |
| `--spacing-10` | 40 px | Gap between app icon and text on 02 |
| `--spacing-12` | 48 px | Gap between card content and its button (welcome card, sheet) |

Off-scale values in the designs: 1 px and 3 px (icon-to-label gap in tabs),
6 px (keyboard, system). Do not add them to the scale.

Page gutters (left edge to content):

| Screen group | Gutter | Content width |
| --- | --- | --- |
| Tab screens (11, Crypto, Money) | 16 px (cards at 16, balance digits at 14) | 361 px on a 393 frame |
| Onboarding 02, 03 | 20 px | 362 px on a 402 frame |
| Step screens 04–09 | 36 px | Button 330 px; text block 342 px (04, 06) or 330 px (09) |
| Sheet on 10 | 30 px | 343 px |

These differ. See [Open points](#open-points).

## Radii

| Proposed token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | 4 px | Scanner corner marks |
| `--radius-sm` | 12 px | Avatar tile (40 × 40) |
| `--radius-lg` | 24 px | Primary button, glass panel, card, action card, list row, sheet, alert button |
| `--radius-field` | 30 px | Text field (renders as a pill) |
| `--radius-icon-tile` | 32 px | App icon tile (96 × 96) |
| `--radius-alert` | 34 px | Alert |
| `--radius-full` | 9999 px | Elements whose radius is half their height: icon button (22 on 44), tab bar (31 on 62), active tab (27 on 54), icon disc (16 on 32) |

The primary button is 50 px high with a 24 px radius. That is 1 px less than
a full pill. Keep 24 so that the button matches the cards.

## Borders

- 1 px solid `#000000` on: primary button, glass panel, welcome card, action
  cards, sheet. The black outline separates a lighter or same-tone surface from
  the `#292929` background.
- 1 px solid `#FFFFFF14` on the tab bar.
- Text field: 1 px solid. Focused: `#1F89FA`. Not focused: `#FFFFFF`.
- Scanner corner marks: 3 px solid `#FFFFFF` on two sides, 18 × 18, radius
  4 px on the outer corner.
- List rows ("Activity row") and alerts have no border.

## Shadows, blur and depth

- No shadows. Do not add `shadow*` or `elevation`.
- Depth comes from fills and the black outline.
- Blur appears in three places:
  - Glass panel (03): `backdrop-filter: blur(32px)` on `#292929B3`.
  - Blurred background (10): four soft blobs with `filter: blur(28px–30px)` on
    `#26272A`. Blobs: `#6B5848` 130 × 150 at 80 %, `#3A3F44` 280 × 60 at 70 %,
    `#25415A` 90 × 100 at 70 %, `#4A2C3A` 90 × 90 at 70 %. This stands in for
    a blurred view of the screen behind the sheet.
  - Hex overlay: SVG Gaussian blur (see [Gradient glow](#gradient-glow)).
- The tab bar and the alert have alpha fills but no backdrop blur in the
  designs.

## Icons

- Style: outline (stroke) icons, `fill="none"`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`. The Valu logo and the VRSC logo are filled.
- Stroke colour: `#FFFFFF` (tab icons, action icons, section icon),
  `#EBEBEB` (scan, settings, done-step check), or a step/semantic colour for
  the large step icon.

| Size (box) | Stroke | Colour | Use |
| --- | --- | --- | --- |
| 48 × 48 | 2 px (1.6 px on the welcome card icon) | `#1F89FA`, `#FFD56F` or `#42DF5E` | Step icon and hero icon above a title |
| 32 × 32 inside a 44 × 44 button | 1.33 px | `#EBEBEB` | Scan button (Home) |
| 27 × 27 inside a 44 × 44 button | 1.33 px | `#FFFFFF` | Settings button (Home) |
| 24 × 24 | 1.5 px | `#FFFFFF` | Tab icons (inactive, and the active Money tab) |
| 22 × 22 (viewBox 24) | 2 px | `#1F89FA` | Active Home tab icon on 11 (inline SVG) |
| 24 × 24 | 1 px | `#FFFFFF` | Section header icon ("Activity") |
| 20 × 20 inside a 32 × 32 disc | 1 px | `#FFFFFF` | Action card icons |
| 16 × 16 | 1.5 px, opacity 0.6 | `#EBEBEB` | Done-step check |
| 16 × 16 | 1 px | `#90F993` | Balance link icon |

- Logo glyph: 52 × 45, white fill, three parts (left, middle circle, right).
  On the splash it sits on the background. On other onboarding screens it sits
  in the app icon tile: 96 × 96, `#3D3D3D`, radius 32, centred in a
  112 × 112 frame.
- Avatar: 40 × 40, radius 12, brand conic gradient, white logo glyph
  26 × 22 inside.
- Icon disc: 32 × 32 circle, category colour, white icon 20 × 20 inside. The
  VRSC disc holds a 26 × 26 logo.

Rules:

- Do: use one stroke family. Keep round caps and joins.
- Do: put a coloured icon only in a disc, or as the 48 px step icon.
- Do not: mix filled and outline icons in one row or bar.
- Do not: use the app's current Feather/vector-icon glyphs on redesigned
  screens without checking stroke weight and caps against this table.

## Components

Sizes are in px (pt/dp). Tokens refer to the tables above.

### Primary button

- Anatomy: a filled container with one centred label.
- Size: height 50. Width fills the content column (362, 330, 313, 298 or 295
  in the designs).
- Tokens: fill `--color-primary` (`#FAFAFA`), border 1 px `--color-border`,
  radius `--radius-lg` (24), label `--text-label` 16 / 19 / 600 in
  `--color-text-on-primary` (`#3D3D3D`).
- Position: at the bottom of the screen above the home indicator, or at the
  bottom of a card, panel or sheet.
- States in the designs: default only. On 05 the button shows through the
  dim overlay; that is not a disabled style.
- Do: use one primary button per screen.
- Do: write a short verb label ("Enable", "Accept", "Close", "Dismiss").
- Do not: colour the primary button blue. Blue is for focus and selection.
- Do not: invent pressed, disabled or loading states. See Open points.

### Text button

- Anatomy: an underlined label in a 48 px high touch area.
- Size: height 48, width of the column (362 on 02).
- Tokens: `--text-body` 14 / 18 / 400, colour `--color-primary` (`#FAFAFA`),
  underline 1 px.
- Use: a secondary path under the primary button ("Recover vault").
- Do: place it directly under the primary button, 6 px below it (735 + 50 to
  791 on 02).
- Do not: use it for a destructive action.

### Icon button

- Anatomy: a round fill with one outline icon.
- Size: 44 × 44, radius `--radius-full`.
- Tokens: fill `--color-fill-icon-button` (`#FFFFFF1A`), icon 32 or 27 px,
  stroke 1.33 px.
- Use: top-left Scan and top-right Settings on Home, 16 px from the side
  edges, top 67.
- Do not: give it a border.

### Alert buttons

- Anatomy: two equal buttons side by side.
- Size: height 48, equal width (`flex: 1`), gap 8.
- Tokens: radius 24; secondary fill `#78788052` with label `#000000`;
  confirm fill `#0A72EA` with label `#FFFFFF`; label 17 / 22 / 600.
- Order: negative left ("No"), positive right ("Yes").

### Text field

- Anatomy: a pill container with one line of text. No label and no helper
  text in the designs; the placeholder names the field.
- Size: padding 16, line height 18, border 1 → height 52. Width 298 (panel
  content width).
- Tokens: fill `--color-fill-field` (`#0000000F`), radius `--radius-field`
  (30), border 1 px, text `--text-body` 14 / 18 / 400 `--color-text`,
  placeholder at `--opacity-placeholder` (40 %).
- States in the designs: focused (border `#1F89FA`), not focused (border
  `#FFFFFF`). Both fields show placeholders.
- Do: stack fields with a 16 px gap.
- Do not: invent error, disabled or filled-value styles. See Open points.

### Glass panel

- Anatomy: a centred panel over the glow with a title, a subtitle, fields
  and a primary button.
- Size: width 362 (20 px gutters), padding 32, gap 24 between the field group
  and the button. Inside the field group: gap 16; title and subtitle gap 8.
- Tokens: fill `--color-surface-glass` (`#292929B3`), `backdrop-filter:
  blur(32px)`, border 1 px `--color-border`, radius `--radius-lg`.
- Title: `--text-label` 16 / 19 / 600 white, centred. Subtitle: `--text-body`
  14 / 18 / 400 `#EBEBEB`, centred.
- Seen on: 03 Sign in.

### Step screen and step marks (stepper)

The onboarding flow shows progress as a vertical text list, not as dots or a
bar.

- Anatomy, top to bottom:
  1. Glow and app icon tile at the top.
  2. Done steps: a list of rows. Each row is a 16 × 16 check icon
     (`#EBEBEB`, stroke 1.5, opacity 0.6), gap 8, then the step name at
     16 / 19 / 600 `#EBEBEB`, opacity 0.6. Rows have a 16 px gap (09).
  3. Current step block: 48 × 48 step icon, gap 16, then title 28 / 36 / 600
     white, gap 8, then body 16 / 19 / 400 `#EBEBEB`.
  4. Next steps: step names only, 16 / 19 / 600 `#EBEBEB`, opacity 0.6, no
     icon. Gap 24 between them (04).
  5. Primary button at the bottom.
- Positions on 04, 06, 09: current block at top 464, left 36. Next steps at
  top 650. Done steps at top 405 (06) or 370 (09). Button at top 791 or 792.
- Done and next steps use the same colour and opacity. Only the check icon
  tells them apart.
- On 09 the block is different: the step name is a small heading
  (16 / 19 / 600 white) above a 28 px identity name, then the body. There is
  no separate next-steps list because this is the last step.
- Do: keep the step order fixed: Device key, Connect account, Accept
  credentials.
- Do: colour only the 48 px icon of the current step.
- Do not: use a coloured bar, a filled number badge, or a left edge marker for
  the current step.

### Alert (dialog)

- Anatomy: a dim overlay over the whole screen; a centred card with a title,
  a message and two buttons.
- Size: width 298, left 52 on a 402 frame; padding 16; gap 16 between text and
  buttons; text block gap 8 and inline padding 4.
- Tokens: `--color-scrim` (`#28283066`) overlay; `--color-alert-surface`
  (`#CDCDD0EB`), radius `--radius-alert` (34); title 17 / 22 / 600 and message
  17 / 22 / 400 in `#000000`; [Alert buttons](#alert-buttons).
- Seen on: 05 (biometric prompt), 07 (camera permission).
- The alert copies the look of the iOS system alert. On iOS the real system
  alert appears for permission prompts. See Open points.
- Do: use it only for a yes/no question that blocks the flow.
- Do not: put more than two buttons in it.

### Bottom sheet (modal)

- Anatomy: a card at the bottom of the screen with a 48 px icon, a title, a
  body and a primary button.
- Size: width 343, left 30, top 510 on a 402 × 874 frame; padding 24; gap 48
  between content and button; gap 16 between icon and text, and between title
  and body.
- Tokens: fill `--color-surface` (`#292929`), border 1 px `--color-border`,
  radius `--radius-lg` (24) on all four corners; title 28 / 36 / 600 white;
  body 14 / 18 / 400 white; icon 48 px `--color-success`.
- Background: the blurred background described under
  [Shadows, blur and depth](#shadows-blur-and-depth).
- The sheet floats: it does not touch the screen edges or the bottom. It has
  no drag handle.
- Seen on: 10 Key accepted.

### Card (welcome card)

- Anatomy: 48 px icon, title, body, primary button.
- Size: width 361, padding 24, gap 48 between content and button, gap 16
  between icon and text and between title and body.
- Tokens: fill `--color-surface-card` (`#1F1F1F`), border 1 px
  `--color-border`, radius `--radius-lg`; title 28 / 34 / 600; body
  14 / 18 / 400 white; button width 313.
- Seen on: 11 Home, top 144.
- Do: use a card only for a message that the user can dismiss.

### Action card

- Anatomy: icon disc at the top, title and description at the bottom
  (`justify-content: space-between`).
- Size: 173 × 154, padding 16, title-to-description gap 8. Grid: two columns,
  gap 16, width 362.
- Tokens: fill `--color-fill-subtle` (`#00000052`), border 1 px
  `--color-border`, radius `--radius-lg`; disc 32 × 32 in the category colour;
  title `--text-label` 16 / 19 / 600 white; description `--text-caption`
  12 / 15 / 400 white.
- Seen on: Crypto and Money (Receive, Transfer, Buy, Sell).
- Do: give each action its own category colour.
- Do not: let the description run past three lines. The Receive description
  is cut with an ellipsis ("use…") in the design.

### List row (activity row)

- Anatomy: 40 × 40 avatar, gap 12, a text block: title on line 1, meta text
  and time on line 2 (`justify-content: space-between`).
- Size: width 361, height 72. Padding: top 16, left 16, right 24; the bottom
  16 comes from the avatar margin and the text block padding.
- Tokens: fill `--color-fill-subtle` (`#00000052`), radius `--radius-lg`, no
  border; title 16 / 19 / 600 white; meta and time 12 / 15 / 400 `#EBEBEB`.
- Section header above the list: 24 px icon, gap 8, label 16 / 19 / 600 white
  ("Activity" at top 510, row at top 542, so 8 px below the header).
- Seen on: 11 Home. Only one row exists. Row-to-row spacing is not defined.

### Asset row

- Anatomy: 32 × 32 asset disc, gap 12, asset name on the left, amount on the
  right.
- Size: width 321, height 32.
- Tokens: name 16 / 19 / 600 white; amount 12 / 15 / 400 `#EBEBEB`. Zero
  amount: opacity 0.4.
- Seen on: Crypto and Money, top 265.

### Balance display

- Anatomy: label "Total Balance" (13 / 16 / 600 white) with an optional 16 px
  link icon at its right; below it the amount at 48 / 58 / 600 white.
- Position: label at top 155, left 16; amount at top 180, left 14.
- Zero state: currency sign white, digits `#FFFFFF66`.
- With a balance: all digits white; the link icon (`#90F993`) appears next to
  the label (left 109, top 156).
- Do: keep the amount on one line (`white-space: pre`).
- Do not: add a currency code or a change percentage; the designs have none.

### Navigation bar (top)

The designs have no title bar and no back button. The top area holds only:

- Onboarding: the system status bar over the glow.
- Home: two icon buttons (Scan left, Settings right) at top 67.
- Crypto and Money: nothing above the balance label.

See Open points for back navigation.

### Tab bar

- Anatomy: a floating pill with four tabs: Home, Credentials, Money, Agents.
  Each tab has a 24 px icon and a label.
- Size: 350 × 62, left 22, top 770 on a 393 × 852 frame (bottom gap 20).
  Inline padding 4.
- Tokens: fill `--color-tabbar` (`#3C3C3CB3`), border 1 px
  `--color-border-subtle` (`#FFFFFF14`), radius `--radius-full` (31).
- Inactive tab: `flex: 1`, icon 24 px white stroke 1.5, gap 1, label
  10 / 12 / 600 `#EBEBEB`.
- Active tab: a 90 × 54 pill, fill `--color-tab-active` (`#3F3F3F`), radius 27,
  label in `--color-accent` (`#1F89FA`). The icon colour differs: blue on
  Home (11), white on Crypto and Money (see Open points).
- Do: keep four tabs.
- Do not: add a top border line or a solid full-width bar.

### Camera scanner

- Background `#3D3D3D` (stands in for the camera image).
- Scrim: black at 50 % with a square cutout.
- Four corner marks: 18 × 18, 3 px white, radius 4, at (92, 328), (292, 328),
  (92, 528), (292, 528). The marked square is 218 × 218.
- No title, no hint text, no close button in the design.

## Token table (Tailwind v4 theme proposal)

This block is a proposal. It is not in the Paper file and not in the app.

```css
@theme {
  /* Neutral surfaces */
  --color-surface: #292929;
  --color-surface-card: #1F1F1F;
  --color-surface-raised: #3D3D3D;
  --color-surface-glass: #292929B3;
  --color-fill-subtle: #00000052;
  --color-fill-field: #0000000F;
  --color-fill-icon-button: #FFFFFF1A;
  --color-tabbar: #3C3C3CB3;
  --color-tab-active: #3F3F3F;
  --color-backdrop: #26272A;

  /* Text and lines */
  --color-text: #FFFFFF;
  --color-text-secondary: #EBEBEB;
  --color-text-muted: #737373;
  --color-text-placeholder: #FFFFFF66;
  --color-text-on-primary: #3D3D3D;
  --color-border: #000000;
  --color-border-subtle: #FFFFFF14;

  /* Brand and accent */
  --color-primary: #FAFAFA;
  --color-accent: #1F89FA;
  --color-success: #42DF5E;
  --color-success-soft: #90F993;
  --color-highlight: #FFD56F;

  /* Categories */
  --color-action-receive: #1F89FA;
  --color-action-transfer: #F153AB;
  --color-action-buy: #899BFF;
  --color-action-sell: #5DB9BA;
  --color-asset-vrsc: #3165D4;

  /* Alert and overlays */
  --color-scrim: #28283066;
  --color-alert-surface: #CDCDD0EB;
  --color-alert-text: #000000;
  --color-alert-button: #78788052;
  --color-alert-confirm: #0A72EA;
  --color-scanner-scrim: #00000080;

  /* Brand gradient stops */
  --color-brand-mint: #B1FFCA;
  --color-brand-green-light: #7BFEA4;
  --color-brand-green: #45FC7E;
  --color-brand-teal: #33E4BF;
  --color-brand-cyan: #21CBFF;
  --color-brand-blue: #51A4FD;
  --color-brand-sky: #81D2E4;

  /* Opacity */
  --opacity-step: 60%;
  --opacity-placeholder: 40%;

  /* Type */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --tracking-normal: 0em;
  --text-display: 48px;   --leading-display: 58px;
  --text-title: 28px;     --leading-title: 36px;
  --text-alert: 17px;     --leading-alert: 22px;
  --text-label: 16px;     --leading-label: 19px;
  --text-body-lg: 16px;   --leading-body-lg: 19px;
  --text-body: 14px;      --leading-body: 18px;
  --text-label-sm: 13px;  --leading-label-sm: 16px;
  --text-caption: 12px;   --leading-caption: 15px;
  --text-tab: 10px;       --leading-tab: 12px;

  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-9: 36px;
  --spacing-10: 40px;
  --spacing-12: 48px;

  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 12px;
  --radius-lg: 24px;
  --radius-field: 30px;
  --radius-icon-tile: 32px;
  --radius-alert: 34px;
  --radius-full: 9999px;

  /* Containers (component widths seen in the designs) */
  --container-tab-content: 361px;
  --container-onboarding: 362px;
  --container-step: 330px;
  --container-panel-content: 298px;
  --container-tabbar: 350px;

  /* Reference frames (not responsive breakpoints) */
  --breakpoint-phone: 393px;
  --breakpoint-phone-pro: 402px;
}
```

`--color-scanner-scrim` is the design's black path at `opacity="0.5"`, written
as `#00000080`.

Component sizes that are not tokens: primary button height 50; text button
and alert button height 48; icon button 44; tab bar height 62; active tab
90 × 54; app icon tile 96 in a 112 frame; avatar 40; icon disc 32; step and
hero icon 48; tab icon 24; done-step icon 16.

## How to apply in React Native

Proposal only. No app code is written by this document.

### What the app does now

- `App.js` builds the Paper theme from `MD2LightTheme` with
  `primary: Colors.primaryColor` (`#00a3ce`) and `accent:
  Colors.verusGreenColor`, and sets `version: 2`.
- `src/globals/colors.js` holds the legacy palette (`Colors`).
- `ios/verusMobile/Info.plist` sets `UIUserInterfaceStyle` to `Light`.
  `App.js` sets `StatusBar barStyle="dark-content"`.
- Bundled text fonts are Source Sans Pro and Avenir
  (`android/app/src/main/assets/fonts`, `UIAppFonts`). Inter is not bundled.
- `src/containers/RootStack/HomeTabScreens/HomeTabScreens.js` defines six tabs
  (Wallet, Services, Identity, Settings, Convert, Scan) with Feather icons.
- `package.json` has `react-native-svg` 15.12.1 and `react-native-paper`
  5.12.5. It has no gradient library and no blur library.

### Where the theme should live

```
src/theme/
  tokens.js        // raw values from the token table, plain JS object
  paperTheme.js    // MD3 dark theme built from tokens
  typography.js    // text roles as StyleSheet-ready objects
  index.js         // re-exports
```

- `tokens.js` is the one source of values. Components import tokens, not hex
  literals.
- Keep `src/globals/colors.js` for legacy screens. Do not change legacy
  screens to the new tokens unless the screen is redesigned.
- Switch `App.js` to the new theme only when the first redesigned screen
  ships, and only with a decision from Max, because the change reaches every
  Paper component in the app.

### Token to React Native Paper 5 (MD3) mapping

Build the theme from `MD3DarkTheme` with `version: 3`.

| MD3 key | Token | Value | Why |
| --- | --- | --- | --- |
| `colors.primary` | `--color-accent` | `#1F89FA` | Paper uses `primary` for focus outline, active tab and selection. That is the blue role in the designs. |
| `colors.onPrimary` | `--color-text` | `#FFFFFF` | |
| `colors.background` | `--color-surface` | `#292929` | |
| `colors.surface` | `--color-surface` | `#292929` | Sheets and dialogs |
| `colors.surfaceVariant` | `--color-surface-card` | `#1F1F1F` | Cards |
| `colors.onSurface`, `onBackground` | `--color-text` | `#FFFFFF` | |
| `colors.onSurfaceVariant` | `--color-text-secondary` | `#EBEBEB` | |
| `colors.outline` | `--color-border` | `#000000` | |
| `colors.outlineVariant` | `--color-border-subtle` | `#FFFFFF14` | |
| `colors.secondaryContainer` | `--color-tab-active` | `#3F3F3F` | Active pill in Paper `BottomNavigation` |
| `colors.backdrop` | `--color-scrim` | `#28283066` | `Modal` and `Dialog` backdrop |
| `colors.elevation.level0`–`level5` | `--color-surface` | `#292929` | The designs have no elevation tint. |
| `roundness` | — | (do not rely on it) | Paper derives component radii from `roundness` with its own multipliers. Set each radius from the radius tokens in the shared component. |

The primary button is white (`#FAFAFA`) with a dark label, which is not the
Paper `primary` role. Build it as one shared component (for example
`ValuButton`) that reads `--color-primary`, `--color-text-on-primary`,
`--color-border` and `--radius-lg`. Paper `Button` with `buttonColor` and
`textColor` can be its base.

### Typography in Paper

Use `configureFonts({ config: { ... } })` with MD3 variants:

| MD3 variant | Role | Values |
| --- | --- | --- |
| `displaySmall` | Display (balance) | Inter 600, 48 / 58 |
| `headlineMedium` | Title | Inter 600, 28 / 36 |
| `titleLarge` | Alert title | Inter 600, 17 / 22 |
| `titleMedium` | Label large | Inter 600, 16 / 19 |
| `bodyLarge` | Body large | Inter 400, 16 / 19 |
| `bodyMedium` | Body | Inter 400, 14 / 18 |
| `labelMedium` | Label small | Inter 600, 13 / 16 |
| `bodySmall` | Caption | Inter 400, 12 / 15 |
| `labelSmall` | Tab label | Inter 600, 10 / 12 |

Set `letterSpacing: 0` on every variant. MD3 defaults have non-zero
letter spacing.

Inter must be bundled before this works. On Android, a custom font weight
needs its own file and family name (for example `Inter-Regular`,
`Inter-SemiBold`), because `fontWeight` alone does not select the file. This
is an asset change, so it needs a decision.

### Other mappings

- Status bar: `light-content` on every redesigned screen (all designs are
  dark).
- Gradient glow: copy the four PNG files from the Paper file into
  `src/images/` and render them with `Image` inside an absolutely positioned,
  rotated `View` (`transform: [{ rotate: '-21.57deg' }]`). `react-native-svg`
  cannot reproduce the grain.
- Glass panel and sheet background blur: there is no blur library. Without
  one, use the solid fallback (`#292929B3` without blur, or `#292929`).
  Adding a blur library is a dependency change.
- Conic gradient avatar: `react-native-svg` has no conic gradient. Export the
  avatar as an image, or approximate it. Needs a decision.
- Tab bar: React Navigation 6 bottom tabs with a custom `tabBar` component.
  Make the tab bar absolutely positioned and add bottom padding to each tab
  screen so content does not hide under it.
- Alert: on iOS, use the system alert (`Alert.alert`) for permission
  prompts. The design copies it. For an in-app question, build one shared
  alert component from the alert tokens.
- Safe areas: the designs place content by absolute `top` values on a fixed
  frame. In code, use `react-native-safe-area-context` insets plus the
  spacing tokens. Do not hard-code `top: 67`.

## Open points

### Values that differ between artboards

1. Two frame sizes. Onboarding artboards are 402 × 874; Home, Crypto and Money
   are 393 × 852. Layout values are not comparable one to one.
2. Page gutters differ: 16 (tab screens), 20 (02, 03), 36 (step screens
   04–09), 30 (sheet on 10). The step text block on 04 and 06 is 342 wide and
   ends 24 px from the right edge, while the button is 330 wide with 36 px on
   both sides. Decide one gutter per screen type.
3. Balance digits and the action grid start at left 14; the label and the
   asset row start at left 16.
4. Title line height: 28 / 36 on screens and sheet, 28 / 34 on the welcome
   card.
5. Title-to-body gap: 8 on step screens, 16 in the welcome card and the
   sheet. Body size: 16 / 19 on step screens, 14 / 18 in the card and the
   sheet.
6. Active tab icon: Home (11) uses an inline 22 px SVG with a 2 px blue
   (`#1F89FA`) stroke and a 3 px icon-to-label gap. The active Money tab
   (Crypto, Money) uses the same 24 px white icon file as the inactive state,
   1.5 px stroke, 1 px gap. Only its label is blue.
7. Icon strokes vary: 1, 1.33, 1.5, 1.6 and 2 px. A single icon set needs one
   rule (proposal: 1.5 px at 24 px).
8. Four different glow images and three glow positions. The rule "glow hue
   follows the step colour" is an inference.
9. Hex overlay is on 02, 04, 06, 09 but not on 03, 05, 07, and its position
   changes per screen.
10. Artboard "Crypto - Empty balance" is named Crypto, but its tab bar shows
    "Money" as active.
11. Scanner (08): the QR preview image (196 × 196 at left 62, top 375) does
    not line up with the corner marks (218 × 218 at left 92, top 328). This
    looks like an import error.

### Things the designs do not define

1. Light mode. All artboards are dark. The app currently forces light mode.
2. Pressed, disabled, loading and error states for every component: buttons,
   text fields, rows, cards, tabs.
3. Text field label, helper text, error text, filled value and secure-entry
   (password) toggle.
4. Small screens (iPhone SE, 375 × 667; small Android). The step screens use
   absolute positions on an 874 px high frame; content will overlap on short
   screens. Scroll behaviour is not defined.
5. Android: status bar, navigation bar, the alert (iOS style only) and the
   keyboard.
6. Back navigation and a top bar with a title for any screen.
7. Lists with more than one row (row gap, dividers, empty list, loading).
8. Toasts, snackbars, inline banners, progress indicators and skeletons.
9. Focus order, minimum touch size for the 16 px balance link icon, and
   Dynamic Type / font scaling.
10. Contrast: opacity 0.6 on `#EBEBEB` over `#292929` and the 40 %
    placeholder are low. Not measured in this document.
11. Motion: transitions between steps, sheet entry, glow change.
12. Real icon set name. The icons are exported SVG paths, not a named
    library.

### Places where the designs assume something the app does not do

1. Tabs: the designs show four tabs (Home, Credentials, Money, Agents). The
   app has six (Wallet, Services, Identity, Settings, Convert, Scan). Scan
   and Settings move to icon buttons on Home in the design.
2. Onboarding: the designs sign in with Valu email and password, then a
   device key (Face ID), then connect an account by QR scan, then accept
   credentials into a "valuid@" identity. The app creates a local profile and
   wallet from a seed. A source search found no email sign-in, "Recover
   vault", "Agents" or "Credentials" tab. Product names in copy also differ:
   "Valu Vault", "ValuMe", "Valu Verse".
3. Fonts: the designs use Inter. The app bundles Source Sans Pro and Avenir.
4. Theme: the app uses an MD2 light theme with a cyan primary (`#00a3ce`).
5. Blur and conic gradients need libraries or images that the app does not
   have.
6. The alert on 05 asks to enable biometrics with app-styled copy; on iOS the
   Face ID permission prompt is a system alert with its own copy.

## Maintenance

- When the Paper file changes, re-read the changed values with
  `get_computed_styles` and update the tables here in the same change.
- When Max decides an open point, move the decision into the relevant section
  and delete the open point.
