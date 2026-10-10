# Prompt: Unified Button & Control System for CO Explorer

## Role & Goal
You are a senior front-end engineer working in the **CO Explorer** repo (`index.html`, `assets/styles.css`, `assets/core.js`, `assets/pages.js`). Replace the dashboard's ad-hoc buttons with **one reusable, themeable button component**. It needs polished, performance-safe interaction states, applied consistently to every clickable control on every page. The site must still look like the same calm, data-first dashboard: these are refinements, not a redesign.

## Context (already decided — do not change)
- **Stack:** plain HTML/CSS/JS. There's no build step and no framework, and the site is served statically from GitHub Pages. Do **not** add Tailwind, React or any new library.
- **Style:** modern minimal, analytical. Neutral surfaces with one blue accent. No glassmorphism, neon, gradients on large surfaces, or bouncy motion.
- **Theme tokens:** these already exist in `:root` in `assets/styles.css`: `--accent`, `--surface`, `--surface-2`, `--border`, `--text-1/2/3`, `--link`, `--focus`. Dark mode is handled by `:root[data-theme="dark"]` **and** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`. Every new token must be defined in all three places.
- **Chart colors are off-limits.** The `--jt-*`, `--ft-*`, `--s-*` and `--seq*` tokens are color-blind-validated data colors. Buttons must never reuse them.
- **Background:** both light and dark.

## Current controls to migrate (inventory)
| Control | Where | Today | Target variant |
|---|---|---|---|
| `.btn` | Filter bar (Reset, Copy link), Explorer (Columns, Export CSV), Compare | Bordered, hover changes background only | **secondary** |
| `.btn.primary` | Compare "Add", empty-state "Reset filters" | Solid `--accent` | **primary** |
| `a.btn` with inline `style="line-height:28px"` (8 places in `pages.js`) | "Open rows in Explorer", "Compare with similar", Prev/Next certificate, building "Compare…" | Inline-style workaround | **secondary**, rendered as `<a>`. Remove every inline `line-height` |
| `.icon-btn` | Nav toggle ☰, theme toggle ◐ | 34×34 | **ghost, icon-only** |
| `.search-btn` | Top bar ⌘K trigger | Input-styled button | Keep its look, adopt the shared focus and press states only |
| `.linkbtn` | "View as table" toggles, "Clear filters" | Text link | **ghost, small** (`aria-expanded` already present — keep it) |
| `.chip button` (×) | Active filter chips | Tiny 14px target | **ghost, icon-only, small**, with an enlarged hit area |
| `.vt-head button` | Explorer and list column sort headers | Plain | Shared focus ring and hover tint only — no lift, no shadow |
| `.fb-toggle` | Mobile "Filters" button | `.btn` | **secondary** |
| `a.kpi` tiles | KPI cards that link | Border turns blue on hover | Card-level hover: lift plus shadow, using the same easing tokens |

## Variants & sizes
- **Variants:** `primary`, `secondary`, `outline`, `ghost`, `destructive`. Use `destructive` for **Reset filters** in the filter bar, because it clears all of the user's state. Keep it quiet: red text and border, not a solid red fill.
- **Sizes:** `sm` (28px visual height: chips, card tools), `md` (32px: toolbars, the default), `lg` (40px: empty-state CTAs).
- **Options:** `icon-left`, `icon-right`, `icon-only` (needs an `aria-label`), `full-width` (used for mobile filter actions).
- Add a JS helper in `core.js` that every page uses, so markup is consistent and no inline styles remain:
  `btn({ label, variant = 'secondary', size = 'md', href, icon, iconOnly, attrs })` → returns an HTML string. It returns an `<a class="btn …">` when `href` is given and `<button type="button" class="btn …">` otherwise.

## Interaction states (design each one deliberately)
1. **Hover** (only inside `@media (hover: hover) and (pointer: fine)`): background or border tint shift, `translateY(-1px)` and a soft shadow that grows. Use **−1px, not −2px**: these buttons sit in dense toolbars. Duration 160ms, `--ease-out: cubic-bezier(.2,.8,.2,1)`. No shine sweep. A ripple is allowed on `primary` only, and only if it costs zero layout.
2. **Focus-visible:** a 2px `--focus` ring with a 2px offset (`outline` plus `outline-offset`, never `box-shadow`, so Windows forced-colors mode still shows it). Keyboard users only. Mouse clicks must not show the ring (`:focus:not(:focus-visible)`).
3. **Active/pressed:** `scale(.97)`, reduced shadow, 90ms. Toggle buttons that use `aria-pressed` or `aria-expanded` ("View as table", Columns menu, theme toggle) also need a persistent *on* style.
4. **Disabled:** apply this to both `[disabled]` and `[aria-disabled="true"]`. Lower opacity (keep text ≥ 3:1), no hover or press transforms, `cursor: not-allowed`. Compare's "Add" button is already disabled at 4 items.
5. **Loading:** add an inline spinner to **Export CSV** while the CSV is built. Also show a brief "Copied ✓" success state on **Copy link**, then revert after 1.5s and keep the toast. Overlay the label rather than replacing it, so the button width never changes. Set `aria-busy="true"`, block clicks while busy, and announce completion through the existing `#toast` live region.

## Performance requirements
- Animate **only `transform` and `opacity`**. Draw the shadow on a `::after` pseudo-element and fade its `opacity`, rather than transitioning `box-shadow`. Never animate width, height, margin, padding, top or left.
- No `will-change` by default. Use it only on an element that is actively animating, and only if measurements prove a benefit.
- Effects are pure CSS. JavaScript is used only for the loading/success states and the optional ripple position.
- **Zero layout shift:** no state may change border width, padding or font weight. Reserve the border on every variant, using a transparent border on ghost buttons.
- Put everything in CSS custom properties: `--btn-radius`, `--btn-h-sm/md/lg`, `--btn-pad-x`, `--dur-fast: 90ms`, `--dur: 160ms`, `--ease-out`, plus per-variant bg, fg, border and hover colors, for both themes.
- Must not regress the measured page render times (currently about 30–200 ms per route; check the "Rendered in … ms" figure in the footer).

## Accessibility
- Use semantic `<button type="button">` for actions and `<a>` for navigation. A link that only looks like a button keeps `href` and needs no ARIA role.
- **Contrast (WCAG AA) — fix these known failures:**
  - White on `--accent` `#2a78d6` is **4.42:1**. That fails AA for the 13px label, so use a darker primary fill such as `#256abf` (5.39:1) or `#1c5cab` (6.63:1).
  - In dark mode, white on `#3987e5` is **3.64:1**, which also fails. Choose a dark-mode primary that passes. Either use a darker fill with white text, or a light fill like `#86b6ef` with dark text.
  - Outline and secondary borders: `--border` `#e2e1dc` on the surface is only 1.28:1. Give `outline` buttons a border of at least 3:1 (WCAG 1.4.11).
  - Verify every variant × state × theme and list the measured ratios in your notes.
- **Touch targets:** at least 44×44px under `@media (pointer: coarse)`. Keep the dense visual size on desktop. On touch screens, grow the *hit area* with a transparent `::before` (inset −6px) or with padding, not by enlarging the visible pill. This matters most for chip × buttons and sort headers.
- Under `@media (prefers-reduced-motion: reduce)`, remove all transforms and spinner rotation (use a pulsing opacity or static dots instead), and keep color changes only.
- Under `@media (forced-colors: active)`, buttons use `ButtonText`/`ButtonFace`/`Highlight` and borders stay visible.
- Don't remove any existing `aria-label`, `aria-expanded` or `aria-sort` attributes.

## Deliverables
1. Updated `assets/styles.css`: one `/* ---------- buttons */` section that replaces `.btn`, `.btn.primary`, `.icon-btn`, `.linkbtn` and `.chip button` styles, with no leftover dead CSS.
2. A `btn()` helper in `assets/core.js`. Every button in `pages.js`, `core.js` and `index.html` is migrated to it or to its classes, and **all 8 inline `line-height:28px` styles are removed**.
3. Loading and success behavior wired to **Export CSV** and **Copy link**.
4. `buttons.html`: a standalone style-guide page in the repo, using the same stylesheet. It shows every variant × size × state (default, hover, focus, active, disabled, loading) side by side, with a theme toggle. Force hover, focus and active previews using demo-only classes such as `.is-hover`.
5. A short **"Design notes"** section appended to `README.md`. It should explain each performance choice in one line, list the contrast ratios, and show how to re-theme through the CSS variables.

## Constraints
- No external libraries. Clean, commented code with no unused CSS.
- Must work in current Chrome, Safari, Firefox and Edge, from both `file://` and GitHub Pages.
- Don't change chart colors, chart interactions, routing, filters or data logic.
- Keep the look consistent with the existing type scale (13–14px UI text) and 6–10px radii.

## Acceptance checklist
- [ ] `grep -c "line-height:28px" assets/pages.js` returns **0**.
- [ ] Every interactive control shows the same focus ring when tabbed to, and none shows it on mouse click.
- [ ] Primary, destructive and outline variants pass AA in light **and** dark mode (measured ratios listed).
- [ ] On a touch device, or with `pointer: coarse` emulated, chip × and sort headers have hit areas of at least 44×44px, with no change to desktop density.
- [ ] Hovering or pressing any button causes zero layout shift (Chrome DevTools Performance → Layout Shift = 0).
- [ ] Export CSV shows the loading state and doesn't change width; Copy link shows "Copied ✓", then reverts.
- [ ] With reduced motion enabled, no element moves or scales.
- [ ] No horizontal scroll at 375px width, and dark mode stays legible.
- [ ] Every route still renders with no console errors, at render times within ±10% of before.
- [ ] After review, commit and push to `main` so the live site (https://tush95ar.github.io/co-explorer/) updates.
