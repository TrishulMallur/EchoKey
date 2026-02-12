# EchoKey — Enterprise Text Expander
> **Status:** Production Stable
> **License:** MIT License
> **Security Grade:** Financial Compliance Ready

## What It Does

Type a short code like `;4bpcmt` in **any text field** on any web page (CMS, Excel Online, etc.), press **Space**, and it instantly expands to the full standardized comment:

```
;4bpcmt  →  4B: Updated Postal Code using MT103
;5bicsr  →  5: Updated BIC using SwiftRef
;7pcgo   →  7: Updated Postal Code using Google
;8btpv   →  8B: Enterprise Vostro Procedure Followed
```

Ships with **10 pre-loaded managed snippets** covering all common enterprise remediation comments, plus support for unlimited custom user snippets.

---

## Key Features

✅ **Core Expansion Engine** — Works in `<input>`, `<textarea>`, `contenteditable`, Excel Online, React apps
✅ **Autocomplete Overlay** — Type `;` + 1 char to see real-time suggestions (Shadow DOM dropdown)
✅ **Usage Analytics** — Track total expansions, per-snippet counts, daily stats with CSS bar charts
✅ **Managed/User Tiers** — 10 locked factory snippets + unlimited personal additions
✅ **Import/Export** — JSON format support
✅ **Admin Panel** — Team settings, bulk operations, analytics dashboard, PIN gate
✅ **Crash-Safe Stats** — Survives rapid tab closes and browser crashes
✅ **React/Angular Compatible** — Uses native property descriptor setter pattern

---

## Installation

### For Individual Users
1. Open Chrome → navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)
5. The 📋 icon appears in your toolbar — click it to manage snippets

### For Team-Wide Deployment
### For Team-Wide Deployment
IT can package this as a `.crx` and distribute via Group Policy. See [DEVELOPMENT.md](DEVELOPMENT.md) for governance requirements.

---

## Usage

### Expanding Comments
1. Click into any text field (Navaera comment box, Excel cell, React form, etc.)
2. Type a shortcode: `;4bpcmt`
3. Press **Space**, **Tab**, or **Enter**
4. The shortcode is replaced with the full comment text
5. A brief green flash confirms the expansion

### Using Autocomplete
1. Type `;` followed by at least 1 character (e.g., `;4b`)
2. A dropdown appears near your cursor with matching suggestions
3. Use **Arrow Up/Down** to highlight options
4. Press **Tab** or **Enter** to accept, **Escape** to dismiss
5. Continue typing to filter suggestions in real-time

### Shortcode Convention

```
;{remed_code}{field_abbrev}{source_abbrev}
```

| Abbreviation | Meaning |
|---|---|
| **Codes:** `4b`, `5`, `7`, `8b`, `9` | Remediation codes |
| **Fields:** `pc`=Postal Code, `st`=State, `ad`=Address, `ct`=City, `cy`=Country, `pr`=Province, `bic`=BIC, `fw`=FW ABA#, `rn`=Routing Number, `in`=Institution Name, `btv`=BTV code |
| **Sources:** `mt`=MT103, `go`=Google, `ho`=HOST, `sr`=SwiftRef, `ds`=DSS, `pac`=pacs008 |
| **Reasons (7 code):** `id`=incomplete data, `du`=data unavailable, `na`=not applicable |
| **Special (8B):** `vos`=VOSTRO, `wmf`=Waterhouse & Managed Fund, `btv`=BTV code & BV# |

### Managing Snippets

**Popup UI (click extension icon):**
- **📋 Snippets tab** — View all managed (🔒) and user (✏️) snippets, search by code or text
- **+ Add New tab** — Create custom snippets with full text editor
- **📊 Stats tab** — View total expansions, top 5 most used, daily counts, bar charts
- **Toggle button** — Turn expansion on/off without uninstalling
- **Import/Export** — Backup or share snippets as JSON
- **Reset Defaults** — Restore factory snippets (preserves user additions)

**Admin Panel (click "⚙️ Admin Panel" in popup footer):**
- Team settings configuration (autocomplete min chars, feedback flash)
- Analytics dashboard with category breakdowns
- Bulk import/export for managed snippets
- Builder wizard for creating snippet packs
- PIN gate (cosmetic only — bypassable via DevTools)

---

## Pre-loaded Snippets (10)

### 4B — Beneficiary Information
`;4bpcmt` `;4bpcgo` `;4bstmt` `;4bstgo`

### 5 — BIC / Routing
`;5fwds` `;5bicsr` `;5bicnr`

### 7 — Data Updates
`;7pcgo`

### 8B — Special Procedures
`;8btpv` `;8bntpv`

---

## Adding New Snippets

**Option A:** Click the extension icon → "+ Add New" tab → enter shortcode and expansion → Save

**Option B:** Export current user snippets → edit the JSON file → Import

**Option C:** (Team deployment) Use admin panel to bulk import a shared snippet pack

---

## Security & Compliance

- ✅ **Zero network requests.** All data stays in chrome.storage.local on the user's machine.
- ✅ **No PII.** Only comment templates are stored — no case data, account numbers, or personal info.
- ✅ **No third-party dependencies.** Pure Chrome Extension APIs only (vanilla JS).
- ✅ **Fully auditable.** All source code is human-readable JavaScript — IT can review every line.
- ✅ **Manifest V3.** Uses Chrome's latest, most secure extension architecture.
- ✅ **Minimal permissions.** Only `storage` permission (no `tabs`, `webRequest`, `cookies`, etc.).
- ✅ **V3 best practices.** All callbacks check `chrome.runtime.lastError` for service worker termination.
- ✅ **React/Angular compatible.** Uses native property descriptor setter to trigger framework change detection.

---

## File Structure

```
EchoKey/
├── manifest.json              ← Chrome extension config (Manifest V3)
├── src/
│   ├── background/
│   │   └── background.js      ← Service worker: lifecycle, defaults, reset handler
│   ├── content/
│   │   └── content.js         ← Core expansion engine (runs on every page)
│   ├── popup/
│   │   ├── popup.html         ← Snippet management UI shell + CSS
│   │   └── popup.js           ← Popup logic: CRUD, search, import/export, stats
│   ├── options/
│   │   ├── admin.html         ← Admin panel UI shell + CSS
│   │   └── admin.js           ← Admin logic: team settings, analytics, wizard
│   ├── shared/
│   │   └── shared.js          ← Shared utilities (escaping, category detection, download)
│   └── assets/
│       └── icons/             ← Extension icons (16, 48, 128)
├── docs/                      ← Project documentation and ADRs
├── DEVELOPMENT.md             ← Full project spec, architecture, coding standards
├── CONTRIBUTING.md            ← Contribution guidelines & setup
├── CHANGELOG.md               ← Version history
├── LICENSE                    ← MIT license
├── SECURITY.md                ← Security policy
└── PRIVACY.md                 ← Privacy policy
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Shortcode not expanding | Check the extension is enabled (click icon → toggle should be ON) |
| Expansion in wrong field | Click into the target field first, then type the shortcode |
| New snippet not working | Shortcodes must start with `;` and be lowercase |
| Doesn't work on a specific site | Some sites use custom input frameworks. Try right-clicking → "Inspect" to confirm the field is a standard input/textarea/contenteditable |
| Stats not persisting on crash | Fixed — uses `statsPending` key for crash-safe writes |
| Can't delete user override of managed snippet | Fixed — delete button now appears for overrides (🔄 icon) |
| React app doesn't detect expansion | Fixed — uses native property descriptor setter |

---

## Roadmap

### Next Priority: Accessibility
**Effort:** 1-2 weeks
**Status:** Planned (see `docs/FEATURE_ACCESSIBILITY_WCAG.md`)

**What's Being Added:**
- ARIA attributes for all interactive elements (tabs, buttons, inputs, autocomplete)
- Screen reader support (tested with NVDA on Windows, VoiceOver on macOS)
- Keyboard navigation improvements (tab lists, radio groups, listbox patterns)
- Color contrast audit (4.5:1 minimum for WCAG AA)
- Textual alternatives for visual-only content (charts)

**Why It's Important:**
- Enterprise accessibility compliance requirement
- AODA (Canada) / ADA (US) regulatory risk mitigation
- Ensures tool is usable by all employees regardless of disability

### Future Enhancements
- Import must handle the JSON format.
- Add snippet count display in popup footer.
- Undo support (Ctrl+Z within 3s window after expansion)
- Reduced motion support (respect `prefers-reduced-motion`)

---

## Contributing

## Contributing

EchoKey was originally developed for a specific enterprise workflow, so the core logic is tailored to standard remediation protocols. However, the architecture is modular and can be adapted for any text expansion use case.

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for full coding standards and architecture
2. Fork the repository
3. Submit a Pull Request with your feature or fix
4. Ensure all changes adhere to the zero-dependency, local-storage-only philosophy

---

## Support

**For Users:**
- Click the extension icon → "?" help button (future feature)
- Contact your team lead or IT ServiceDesk

**For Developers:**
- Review [DEVELOPMENT.md](DEVELOPMENT.md) for architecture and standards
- See `docs/` for audit documentation

---

## License

MIT License. See [LICENSE](LICENSE) for details.

*Originally designed for high-compliance financial workflows.*
