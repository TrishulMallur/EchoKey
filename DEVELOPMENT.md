# DEVELOPMENT.md — EchoKey (Chrome Extension)

## PROJECT IDENTITY

**Name:** EchoKey
**Type:** Chrome Extension (Manifest V3)
**Classification:** Open Source / Enterprise Utility
**Domain:** High-volume text expansion & compliance
**Current Version:** Stable
**Target Environment:** Chrome 120+, Edge, Brave

---

## WHAT THIS PROJECT DOES

A Chrome extension that expands short typed codes (e.g., `;4bpcmt`) into standardized comments (e.g., "4B: Updated Postal Code using MT103") inside any text field on any web page. The primary targets are CMS tools, Excel Online, and data entry forms.

The tool exists to eliminate comment inconsistencies across teams, reduce keystroke overhead, and create audit-friendly uniformity in case notes.

---

## ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Chrome Extension                            │
├──────────────┬──────────────┬────────────────────┬──────────────────┤
│ background.js│  content.js  │ popup.html/popup.js│ admin.html/      │
│ (service     │  (injected   │ (management UI)    │ admin.js         │
│  worker)     │   into every │                    │ (admin panel)    │
│              │   page)      │                    │                  │
│ • Lifecycle  │ • Keystroke  │ • CRUD snippets    │ • Team settings  │
│ • Install/   │   buffer     │ • Search/filter    │ • Analytics      │
│   update     │ • Pattern    │ • Import/export    │ • Bulk ops       │
│ • Default    │   matching   │ • Toggle on/off    │ • PIN gate       │
│   snippet    │ • Text       │ • Usage stats      │                  │
│   seeding    │   replacement│                    │                  │
│ • Reset      │ • Visual     │                    │                  │
│   handler    │   feedback   │                    │                  │
├──────────────┴──────────────┼────────────────────┴──────────────────┤
│                              │          shared.js                    │
│                              │          (utilities)                  │
│                              │  • escHtml, escAttr                   │
│                              │  • getCategory, downloadJSON          │
│                              │  Used by: popup.js, admin.js          │
├──────────────────────────────┴──────────────────────────────────────┤
│                       chrome.storage.local                           │
│  Keys: managedSnippets{}, userSnippets{}, enabled:bool, stats{},     │
│        teamSettings{}, statsPending{}                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. `background.js` seeds default snippets into `chrome.storage.local` on first install
2. `content.js` loads snippets from storage, listens for keystrokes on every page
3. User types shortcode + trigger key (Space/Tab/Enter) → content.js replaces inline
4. `popup.js` provides CRUD UI, reads/writes to same storage
5. `chrome.storage.onChanged` keeps content.js in sync when popup modifies data

### File Roles

| File | Role | Runs In |
|---|---|---|
| `manifest.json` | Extension config, permissions, content script registration | Chrome runtime |
| `src/background/background.js` | Service worker: install/update lifecycle, default snippet seeding, reset handler | Background (ephemeral) |
| `src/content/content.js` | Core expansion engine: keystroke buffer, pattern matching, text replacement | Every web page |
| `src/popup/popup.html` | Management UI shell and styles | Extension popup |
| `src/popup/popup.js` | Popup logic: CRUD, search, import/export, toggle | Extension popup |
| `src/options/admin.html` / `.js` | Admin panel: team settings, analytics, bulk ops, PIN gate | Extension tab (opened via `chrome.runtime.getURL()` from popup.js) |
| `src/shared/shared.js` | Shared utilities: `escHtml`, `escAttr`, `getCategory`, `downloadJSON` | Extension popup, admin panel |

---

## SHORTCODE CONVENTION

```
;{remed_code}{field_abbrev}{source_abbrev}
```

### Remediation Codes
- `4b` — Beneficiary Information Updates
- `5` — BIC / Routing Updates
- `7` — Data Omissions (uses reason suffixes instead of source)
- `8b` — Special Procedures & Account Types
- `9` — Geographic / Regional Updates

### Field Abbreviations
`pc`=Postal Code, `st`=State, `ad`=Address, `ct`=City, `cy`=Country, `pr`=Province, `bic`=BIC, `fw`=FW ABA#, `rn`=Routing Number, `in`=Institution Name, `btv`=BTV code

### Source Abbreviations
`mt`=MT103, `go`=Google, `ho`=HOST, `sr`=SwiftRef, `ds`=DSS, `pac`=pacs008

### Reason Suffixes (7-code only)
`id`=incomplete data, `du`=data unavailable, `na`=not applicable

### Special (8B)
`vos`=VOSTRO procedure, `wmf`=Waterhouse & Managed Fund, `btv`=BTV code & BV#

---

## CODING STANDARDS

### General
- **Pure vanilla JS only.** No frameworks, no build tools, no npm. This must stay zero-dependency for governance approval.
- **IIFE pattern** for content.js and popup.js to avoid global scope pollution.
- **`"use strict"`** in all JS files.
- **Manifest V3** only — no Manifest V2 APIs (no `chrome.browserAction`, no persistent background pages).
- All user-facing strings should be clear and professional — this is an internal bank tool.

### Naming
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS custom properties: `--kebab-case`
- Shortcodes: always lowercase, always prefixed with `;`
- Storage keys: lowercase descriptive (`snippets`, `enabled`, `stats`, `managedSnippets`, `userSnippets`)

### Code Organization
- Use section comment banners (the `// ═══...` style) to separate logical blocks within files.
- Every exported/public function gets a JSDoc comment.
- Keep `content.js` lean — it runs on every page. Avoid heavy DOM operations.
- `popup.js` can be heavier since it only runs when the popup is open.

### Security Constraints (NON-NEGOTIABLE)
- **ZERO network requests.** No fetch, no XMLHttpRequest, no WebSocket, no external scripts.
- **No PII storage.** Snippets contain only comment templates — never case data, account numbers, or personal info.
- **No eval(), no Function(), no dynamic code execution.**
- **No third-party libraries.** Everything is built with Chrome Extension APIs and vanilla DOM APIs.
- **No `<all_urls>` permission beyond content_scripts** (already scoped correctly in manifest).
- **Clipboard permission** (`clipboardWrite`) is used only for export-related copy operations.
- If any feature would require a new permission in `manifest.json`, flag it explicitly — new permissions require governance review.

### CSS
- All styles live inline in `popup.html` within a `<style>` block — no external CSS files.
- Use CSS custom properties (the `:root` vars) for theming consistency.
- Bank-professional color palette: slate/blue/green. No playful colors.
- Responsive within the popup's fixed dimensions (420px wide, 300–560px tall).

### Error Handling
- Never let errors surface to the user as raw stack traces.
- Use `console.warn` / `console.error` with the `[EchoKey]` prefix for debugging.
- All `chrome.storage` callbacks should handle missing/undefined data gracefully.
- JSON import must validate structure before processing — never trust file contents.

---

## STORAGE SCHEMA

> **Full schema documentation:** See [docs/STORAGE_SCHEMA.md](docs/STORAGE_SCHEMA.md) for the complete, authoritative storage key reference including all 9 keys, type definitions, and migration history.

### Documentation & Schema References
```

### Current Architecture
```js
{
  "managedSnippets": {   // Locked base set — controlled by team leads / IT
    ";4bpcmt": "4B: Updated Postal Code using MT103",
    // ...
  },
  "userSnippets": {      // Personal additions — editable by individual user
    ";custom1": "Custom comment...",
  },
  "enabled": true,
### Core Architecture
```

When upgrading storage schema, `background.js` handles the transformation to ensure data preservation.

---

## FEATURE IMPLEMENTATION ROADMAP

✅ Core Expansion Engine
✅ Usage Analytics & Stats Dashboard
✅ Autocomplete / Suggestion Overlay
✅ Multi-Field Combo Expansions
✅ Managed vs. User Snippet Tiers
✅ Shortcode Conflict Detection
✅ Enhanced Export with Metadata

---

### Next Priority Feature

## 🎯 FEATURE: Accessibility Improvements
**Priority:** HIGH — Enterprise compliance requirement
**Effort:** 1-2 weeks (10-14 days)
**Status:** Ready for implementation

---

### Completed Features (Archive)

#### FEATURE: Usage Analytics & Stats Dashboard
**Priority:** HIGH — Required for ROI proof at team pitch
**Files Modified:** `content.js`, `popup.html`, `popup.js`, `background.js`
**New Storage Keys:** `stats.perSnippet`

#### Requirements
- In `content.js` → `tryExpand()`: after successful expansion, increment `stats.expansions` and update `stats.perSnippet[matchedCode]` with `{ count, lastUsed }`.
- Batch storage writes — don't call `chrome.storage.local.set` on every single expansion. Buffer stats updates and flush every 10 seconds or on page unload (`beforeunload`).
- In `popup.html`/`popup.js`: add a third tab "📊 Stats" after "+ Add New".
- Stats tab displays:
  - Total expansions (all time)
  - Today's expansion count
  - Top 5 most-used snippets (with count and code)
  - Bottom 5 least-used snippets (to identify candidates for removal)
  - Last expansion timestamp
- Add a "Reset Stats" button in the stats tab footer.
- Stats data must never include PII — only shortcode strings and numeric counts.

#### Implementation Notes
- Use a simple in-memory counter object in content.js that periodically syncs to storage.
- The stats tab should render clean bar charts using pure CSS (no chart libraries). Horizontal bars with percentage widths relative to the max count.
- Handle the case where stats object doesn't exist yet (fresh install / migration).

---

#### FEATURE: Autocomplete / Suggestion Overlay
**Priority:** HIGH — Best demo feature, lowers onboarding friction
**Files Modified:** `content.js`, inject new CSS into pages
**New Permissions:** None

#### Requirements
- After the user types `;` followed by at least 1 character, show a floating dropdown near the text cursor with matching snippet suggestions.
- Filter in real-time as the user continues typing. Match against both shortcode and expansion text.
- Show max 6 suggestions at a time, sorted by relevance (shortcode prefix match first, then expansion text match).
- Each suggestion row shows: shortcode (monospace, highlighted) + expansion text (truncated).
- Navigation: Arrow Up/Down to highlight, Tab/Enter to accept, Escape to dismiss.
- Accepting a suggestion replaces the typed prefix with the full expansion (same replacement logic as current trigger-key flow).
- The dropdown must be a Shadow DOM element to avoid CSS conflicts with host pages.
- Dropdown positioning: calculate caret position using a mirrored offscreen div (for input/textarea) or `getSelection().getRangeAt(0).getBoundingClientRect()` (for contenteditable).
- Dismiss the dropdown when: user clicks elsewhere, presses Escape, types a non-matching sequence, or the buffer is cleared.
- Must not interfere with the existing trigger-key expansion — if the user types a full shortcode and hits Space without using the dropdown, the original flow still works.

#### Implementation Notes
- Create the overlay as a custom element or Shadow DOM container injected once per page.
- Style it inline within the Shadow DOM — cannot rely on host page styles.
- Use `position: fixed` with coordinates derived from caret position.
- Debounce the filter operation by ~50ms to avoid jank on fast typists.
- Consider accessibility: the dropdown should have `role="listbox"` and items should have `role="option"` with `aria-selected`.
- Z-index should be very high (999999) to float above all page content.
- Test on: standard `<input>`, `<textarea>`, `contenteditable`, and Navaera-specific fields if possible.

---

#### FEATURE: Multi-Field Combo Expansions
**Priority:** MEDIUM — Significant time savings for bulk updates
**Files Modified:** `content.js`, `popup.js`, `popup.html`, `background.js`
**New Storage Pattern:** Expansion values containing `\n` for multi-line

#### Requirements
- Allow expansion values to contain newline characters (`\n`).
- In `content.js`, handle newlines differently per element type:
  - `<textarea>`: Insert literal newlines.
  - `<input>`: Replace `\n` with ` | ` (pipe-delimited, since inputs are single-line).
  - `contenteditable`: Insert `<br>` elements or use `insertText` with newlines depending on what the host app expects.
- Add combo shortcodes to DEFAULT_SNIPPETS, e.g.:
  - `;4ballmt` → "4B: Updated Postal Code using MT103\n4B: Updated City using MT103\n4B: Updated State using MT103"
  - `;5allsr` → "5: Updated BIC using SwiftRef\n5: Updated Routing Number using SwiftRef"
- In the popup add form, replace the single-line expansion input with a `<textarea>` when the user toggles a "Multi-line" checkbox.
- Display multi-line expansions in the snippet list with a visual indicator (e.g., a "⧉" icon or "[multi]" badge).

#### Implementation Notes
- The popup's expansion display should show `↵` symbols where newlines are, since the row view is single-line.
- Export/import must preserve newlines correctly in JSON (they serialize naturally as `\n`).
- Combo shortcodes follow convention: `;{remed_code}all{source_abbrev}` for "all fields" combos.

---

#### FEATURE: Undo Support
**Priority:** MEDIUM — Quality of life, prevents accidental expansions
**Files Modified:** `content.js`
**New Storage Keys:** None (in-memory only)

#### Requirements
- After an expansion, store the undo state: `{ element, previousValue, cursorPosition, timestamp }`.
- Within a 3-second window after expansion, if the user presses `Ctrl+Z`, revert to the pre-expansion state.
- For `<input>`/`<textarea>`: restore `.value` and cursor position.
- For `contenteditable`: use `document.execCommand('undo')` which should work if the expansion used `execCommand('insertText')`.
- Only store the most recent expansion for undo (not a full history).
- After the 3-second window expires, clear the undo state and let native browser undo take over.
- Show a subtle toast/indicator near the field: "Ctrl+Z to undo" that fades after 2 seconds.

#### Implementation Notes
- The undo toast should be injected as a Shadow DOM element (same as autocomplete overlay).
- Be careful not to break native undo for non-expansion edits — only intercept Ctrl+Z when there's an active undo state within the time window.
- For `<input>`/`<textarea>`, consider switching from direct `.value` assignment to `document.execCommand('insertText')` via a temporary `contenteditable` proxy to preserve browser undo stack. Research feasibility before implementing.

---

#### FEATURE: Managed vs. User Snippet Tiers
**Priority:** MEDIUM-HIGH — Required for team governance
**Files Modified:** `background.js`, `content.js`, `popup.html`, `popup.js`
**Storage Schema Change:** Split `snippets` → `managedSnippets` + `userSnippets`

#### Requirements
- **Managed snippets:** Ship with the extension, controlled via `DEFAULT_SNIPPETS` in `background.js`. Cannot be edited or deleted by users via the popup. Displayed with a 🔒 icon.
- **User snippets:** Custom additions by the individual user. Full CRUD access. Displayed with a ✏️ icon.
- In `content.js`, merge both sets for matching: user snippets take priority if there's a key collision (allows personal overrides of managed expansions).
- In the popup:
  - Snippet list shows both tiers with visual distinction.
  - Edit/delete buttons hidden for managed snippets.
  - "Reset Defaults" only resets managed snippets — preserves user snippets.
  - Filter/search works across both tiers.
- Import/export operates on user snippets only by default, with an "Include managed" checkbox for full export.

#### Migration
- On update:
  1. Read existing snippets
  2. For each entry, check if key exists in defaults → goes to managed
  3. Anything not in defaults → goes to user
  4. Delete old snippets key after successful migration
  5. Set a schema flag to prevent re-migration

---

#### FEATURE: Shortcode Conflict Detection
**Priority:** LOW — Polish / safety feature
**Files Modified:** `popup.js`

#### Requirements
- When adding a new snippet, check for prefix conflicts:
  - If the new code is a prefix of an existing code (e.g., adding `;5bic` when `;5bicsr` exists), warn: "This shortcode is a prefix of existing code(s): ;5bicsr, ;5bicmt. The shorter code will take priority."
  - If an existing code is a prefix of the new code, warn similarly.
- Display warning in the add form's error area (yellow/warning style, not red/error).
- Allow the user to proceed despite the warning (it's informational, not blocking).

---

#### FEATURE: Enhanced Export with Metadata
**Priority:** LOW — Nice-to-have for team distribution
**Files Modified:** `popup.js`

#### Requirements
- Export JSON format changes from flat `{ code: expansion }` to:
```json
{
  "meta": {
    "exportedAt": "2025-06-15T14:23:00Z",
    "version": "2.0.0",
    "snippetCount": 58,
    "source": "EchoKey Snippet Manager"
  },
  "managed": { ";4bpcmt": "4B: Updated Postal Code using MT103" },
  "custom": { ";mycode": "My custom expansion" }
}
```
- Import must handle BOTH the old flat format (backward compat) and the new format.
- Add version display in popup footer: "v2.0.0" next to the snippet count.

---

## TESTING GUIDELINES

### Manual Test Matrix
For every change to `content.js`, test expansion in ALL of these:
1. Standard `<input type="text">`
2. Standard `<textarea>`
3. `contenteditable="true"` div
4. Google Sheets cell (uses contenteditable internally)
5. Excel Online cell
6. A React-based input (e.g., any modern SPA — tests synthetic event handling)

### Test Scenarios
- Type shortcode + Space → expands correctly, space appears after expansion
- Type shortcode + Tab → expands correctly, focus moves to next field
- Type shortcode + Enter → expands correctly, newline/submit behavior preserved
- Type partial shortcode + Space → no expansion, text preserved as-is
- Type shortcode with wrong case → still expands (case-insensitive matching)
- Rapid sequential expansions → both expand correctly
- Expansion in the middle of existing text → only shortcode replaced, surrounding text preserved
- Toggle off → no expansions occur
- Toggle back on → expansions resume
- Ctrl+Z after expansion → reverts (once undo feature is implemented)

### Performance
- content.js must not add perceptible input latency. The keystroke handler should return in <1ms for non-matching keystrokes.
- Autocomplete filtering over 100+ snippets should complete in <5ms.
- Storage reads on page load should not block the main thread.

---

## COMMIT CONVENTIONS

Use conventional commits:
```
feat(stats): add per-snippet usage tracking
feat(autocomplete): implement shadow DOM suggestion overlay
fix(content): handle null selection in contenteditable
refactor(storage): split snippets into managed/user tiers
docs(readme): update features
chore(manifest): initial release
```

---

## GOVERNANCE & COMPLIANCE NOTES

## GOVERNANCE & COMPLIANCE NOTES

This tool is designed for high-compliance enterprise environments. Key architectural decisions:

- **Zero network surface:** No fetch, no external scripts, no telemetry. Everything is local.
- **No data exfiltration risk:** The extension writes to active text fields but never reads field contents for storage or transmission.
- **Manifest V3:** Chrome's most restrictive extension architecture. Service worker is ephemeral.
- **Auditability:** 100% human-readable source. No minification, no bundling, no obfuscation.
- **Permission minimalism:** Only `storage` and `clipboardWrite`. No `tabs`, no `webRequest`, no `cookies`.
- **Content Script scope:** Runs at `document_idle` (after page load), doesn't block rendering.

If any feature implementation would compromise any of the above, **stop and flag it** before proceeding.

---

## QUICK REFERENCE: CHROME EXTENSION APIs USED

| API | Purpose |
|---|---|
| `chrome.storage.local.get/set` | Persist snippets, teamSettings, stats |
| `chrome.storage.onChanged` | Sync content.js when popup modifies data |
| `chrome.runtime.onInstalled` | Lifecycle: seed defaults on install, merge on update |
| `chrome.runtime.onMessage` | Message passing between popup ↔ background |
| `chrome.runtime.sendMessage` | Popup → background for reset command |
| `document.execCommand('insertText')` | Contenteditable text insertion with undo support |
| `window.getSelection()` | Caret position detection for contenteditable |
| `Event('input', { bubbles: true })` | Notify frameworks (React, Angular) of programmatic changes |
