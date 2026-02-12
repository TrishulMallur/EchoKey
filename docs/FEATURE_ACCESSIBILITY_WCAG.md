# Feature Specification — Accessibility Improvements (WCAG 2.1 AA)

**Feature ID:** Enhancement 5.1
**Priority:** HIGH
**Effort Estimate:** 1-2 weeks
**Status:** Planned

---

## Overview

Make the EFTR Comment Expander Chrome Extension fully compliant with WCAG 2.1 Level AA accessibility standards. This will ensure the extension is usable by employees with disabilities, including those who rely on screen readers, keyboard-only navigation, or other assistive technologies.

**Business Value:** Accessibility compliance is increasingly required by enterprise IT governance policies and may become mandatory for internal tools at many financial institutions.

---

## Current Accessibility Gaps

### Popup UI (`popup.html` / `popup.js`)
- ❌ **Tabs:** No `role="tablist"`, `role="tab"`, or `aria-selected` attributes
- ❌ **Toggle button:** No `aria-label` or `aria-pressed` state
- ❌ **Search input:** No `<label>` element (only placeholder text)
- ❌ **Toast notifications:** No `role="alert"` or `aria-live` region
- ❌ **Icon buttons:** Emoji-only content with `title` attribute (not reliable for screen readers)
- ❌ **Stats charts:** Visual bar charts with no textual alternative

### Admin Panel (`admin.html` / `admin.js`)
- ❌ **Wizard steps:** No `role="progressbar"` or step indicators
- ❌ **Category filters:** Button group with no `role="radiogroup"`
- ❌ **PIN input:** No `aria-describedby` for requirements text
- ❌ **Analytics charts:** Visual-only, no data table alternative

### Content Script (`content.js`)
- ❌ **Autocomplete dropdown:** Missing `aria-expanded`, `aria-activedescendant`, `aria-controls`
- ❌ **Visual feedback flash:** No screen reader announcement
- ⚠️ **Keyboard navigation:** Works but not fully ARIA-compliant

---

## WCAG 2.1 AA Success Criteria to Meet

| Criterion | Level | Description | Current Status |
|---|---|---|---|
| **1.1.1** Non-text Content | A | All non-text content has text alternative | ❌ Fail (icon buttons, charts) |
| **1.3.1** Info and Relationships | A | Information conveyed through presentation is programmatically determinable | ❌ Fail (tabs, radiogroups) |
| **1.4.3** Contrast (Minimum) | AA | Text has 4.5:1 contrast ratio | ⚠️ Need audit |
| **2.1.1** Keyboard | A | All functionality available via keyboard | ✅ Pass |
| **2.4.3** Focus Order | A | Keyboard focus order is logical | ✅ Pass |
| **2.4.6** Headings and Labels | AA | Headings and labels describe purpose | ❌ Fail (missing labels) |
| **3.2.2** On Input | A | Input changes don't cause unexpected context change | ✅ Pass |
| **4.1.2** Name, Role, Value | A | All UI components have accessible name/role | ❌ Fail (ARIA missing) |
| **4.1.3** Status Messages | AA | Status messages programmatically determinable | ❌ Fail (toast has no role) |

---

## Implementation Plan

### Phase 1: Popup UI ARIA (3-4 days)

#### 1.1 Tab Navigation
**File:** `popup.html` lines ~100-120

**Current:**
```html
<div class="tabs">
  <div class="tab active" data-tab="snippets">📋 Snippets</div>
  <div class="tab" data-tab="add">+ Add New</div>
  <div class="tab" data-tab="stats">📊 Stats</div>
</div>
```

**Updated:**
```html
<div class="tabs" role="tablist" aria-label="Extension sections">
  <button class="tab active" role="tab" aria-selected="true" aria-controls="panel-snippets" id="tab-snippets" data-tab="snippets">
    <span aria-hidden="true">📋</span> Snippets
  </button>
  <button class="tab" role="tab" aria-selected="false" aria-controls="panel-add" id="tab-add" data-tab="add">
    <span aria-hidden="true">+</span> Add New
  </button>
  <button class="tab" role="tab" aria-selected="false" aria-controls="panel-stats" id="tab-stats" data-tab="stats">
    <span aria-hidden="true">📊</span> Stats
  </button>
</div>

<div class="tab-content" role="tabpanel" id="panel-snippets" aria-labelledby="tab-snippets">
  <!-- Snippets list -->
</div>
<div class="tab-content hidden" role="tabpanel" id="panel-add" aria-labelledby="tab-add" hidden>
  <!-- Add form -->
</div>
<div class="tab-content hidden" role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" hidden>
  <!-- Stats dashboard -->
</div>
```

**JavaScript changes in `popup.js`:**
- Update tab click handler to toggle `aria-selected` attribute
- Add/remove `hidden` attribute on tab panels (not just CSS class)
- Move keyboard focus to newly activated tab panel

---

#### 1.2 Toggle Button
**File:** `popup.html` line ~50

**Current:**
```html
<button class="toggle-btn" id="toggleBtn">ON</button>
```

**Updated:**
```html
<button class="toggle-btn" id="toggleBtn"
        aria-label="Extension status toggle"
        aria-pressed="true">
  ON
</button>
```

**JavaScript changes in `popup.js`:**
- Update toggle handler to set `aria-pressed="true"` or `"false"`
- Update button text to include state: "Extension: ON" / "Extension: OFF"

---

#### 1.3 Search Input Label
**File:** `popup.html` line ~140

**Current:**
```html
<input type="text" id="search" placeholder="Search snippets..." />
```

**Updated:**
```html
<label for="search" class="visually-hidden">Search snippets by code or text</label>
<input type="text" id="search" placeholder="Search snippets..."
       aria-describedby="search-results-count" />
<div id="search-results-count" class="visually-hidden" aria-live="polite"></div>
```

**Add CSS:**
```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

**JavaScript changes in `popup.js`:**
- After filtering, update `#search-results-count`: `"Showing X of Y snippets"`

---

#### 1.4 Toast Notifications
**File:** `popup.js` line ~657

**Current:**
```javascript
function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  // ...
}
```

**Updated:**
```javascript
function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  document.body.appendChild(toast);
  // ...
}
```

---

#### 1.5 Icon Buttons (Edit/Delete)
**File:** `popup.js` line ~130 (render function)

**Current:**
```javascript
<button class="btn-icon" data-code="${escAttr(code)}" title="Edit">✏️</button>
<button class="btn-icon btn-delete" data-code="${escAttr(code)}" title="Delete">🗑️</button>
```

**Updated:**
```javascript
<button class="btn-icon" data-code="${escAttr(code)}" aria-label="Edit snippet ${escAttr(code)}">
  <span aria-hidden="true">✏️</span>
  <span class="visually-hidden">Edit</span>
</button>
<button class="btn-icon btn-delete" data-code="${escAttr(code)}" aria-label="Delete snippet ${escAttr(code)}">
  <span aria-hidden="true">🗑️</span>
  <span class="visually-hidden">Delete</span>
</button>
```

---

#### 1.6 Stats Charts — Textual Alternative
**File:** `popup.js` line ~202 (renderBarChart)

**Add after each chart:**
```html
<details class="chart-data-table">
  <summary>View chart data as table</summary>
  <table>
    <caption>Top 5 most used snippets</caption>
    <thead>
      <tr>
        <th scope="col">Shortcode</th>
        <th scope="col">Expansion</th>
        <th scope="col">Count</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>;4bpcmt</td>
        <td>4B: Updated Postal Code using MT103</td>
        <td>45</td>
      </tr>
      <!-- ... -->
    </tbody>
  </table>
</details>
```

---

### Phase 2: Admin Panel ARIA (2-3 days)

#### 2.1 Category Filter Radio Group
**File:** `admin.html` line ~600

**Current:**
```html
<div class="category-filters">
  <button class="cat-btn active" data-cat="all">All</button>
  <button class="cat-btn" data-cat="4b">4B</button>
  <!-- ... -->
</div>
```

**Updated:**
```html
<div class="category-filters" role="radiogroup" aria-label="Filter snippets by category">
  <button class="cat-btn active" role="radio" aria-checked="true" data-cat="all">All</button>
  <button class="cat-btn" role="radio" aria-checked="false" data-cat="4b">4B</button>
  <!-- ... -->
</div>
```

**JavaScript changes in `admin.js`:**
- Update click handler to toggle `aria-checked`
- Implement keyboard arrow navigation between radio buttons

---

#### 2.2 Wizard Progress Indicator
**File:** `admin.html` line ~800

**Add:**
```html
<div role="progressbar"
     aria-valuemin="1"
     aria-valuemax="3"
     aria-valuenow="1"
     aria-label="Snippet pack builder progress">
  Step 1 of 3: Select Category
</div>
```

**JavaScript changes in `admin.js`:**
- Update `aria-valuenow` when wizard advances
- Update label text to match current step

---

#### 2.3 PIN Input Requirements
**File:** `admin.html` line ~250

**Current:**
```html
<input type="text" id="pinInput" placeholder="Enter PIN" />
<p class="pin-hint">4-6 digits</p>
```

**Updated:**
```html
<label for="pinInput">Admin PIN</label>
<input type="text"
       id="pinInput"
       placeholder="Enter PIN"
       aria-describedby="pin-requirements" />
<p id="pin-requirements" class="pin-hint">Must be 4-6 digits</p>
```

---

### Phase 3: Content Script Autocomplete ARIA (2-3 days)

#### 3.1 Autocomplete Dropdown
**File:** `content.js` line ~380 (initAutocomplete)

**Current Shadow DOM HTML:**
```html
<div class="autocomplete-list" style="...">
  <div class="autocomplete-item">...</div>
  <!-- ... -->
</div>
```

**Updated:**
```html
<div role="listbox"
     id="eftr-autocomplete-list"
     aria-label="Snippet suggestions"
     class="autocomplete-list"
     style="...">
  <div role="option"
       aria-selected="false"
       id="eftr-suggestion-0"
       class="autocomplete-item">...</div>
  <!-- ... -->
</div>
```

**JavaScript changes in `content.js`:**
- Add `aria-expanded="false"` to the input when dropdown is hidden
- Set `aria-expanded="true"` when dropdown is shown
- Add `aria-activedescendant="eftr-suggestion-X"` to the input, pointing to the highlighted option
- Add `aria-selected="true"` to the currently highlighted item (remove from others)

**Input field changes:**
```javascript
// When user types ";" + char
el.setAttribute("aria-expanded", "true");
el.setAttribute("aria-controls", "eftr-autocomplete-list");

// When user navigates with Arrow Down
el.setAttribute("aria-activedescendant", `eftr-suggestion-${selectedIndex}`);

// When dropdown is dismissed
el.removeAttribute("aria-expanded");
el.removeAttribute("aria-controls");
el.removeAttribute("aria-activedescendant");
```

---

#### 3.2 Visual Feedback Announcement
**File:** `content.js` line ~626 (showFeedback)

**Add live region to Shadow DOM on page load:**
```javascript
const liveRegion = document.createElement("div");
liveRegion.setAttribute("role", "status");
liveRegion.setAttribute("aria-live", "polite");
liveRegion.className = "visually-hidden";
liveRegion.id = "eftr-status";
document.body.appendChild(liveRegion);
```

**Update showFeedback:**
```javascript
function showFeedback(el) {
  // Visual flash (existing code)
  // ...

  // Screen reader announcement
  const liveRegion = document.getElementById("eftr-status");
  if (liveRegion) {
    liveRegion.textContent = "Snippet expanded";
    setTimeout(() => {
      liveRegion.textContent = "";
    }, 1000);
  }
}
```

---

### Phase 4: Color Contrast Audit (1 day)

#### 4.1 Contrast Testing
Use browser DevTools or online tools to check all text/background combinations:
- **Minimum ratio:** 4.5:1 for normal text
- **Large text:** 3:1 for 18pt+ or 14pt+ bold

**Areas to check:**
- Popup header (white text on blue/green background)
- Tab active state (blue text on light background)
- Button states (hover, active, disabled)
- Toast notification text
- Stats chart bar colors
- Admin panel dark theme text

**Tools:**
- Chrome DevTools → Accessibility tab → Contrast ratio
- https://webaim.org/resources/contrastchecker/
- https://whocanuse.com/

#### 4.2 Contrast Fixes
If any combinations fail, adjust colors:
- Darken text or lighten background (or vice versa)
- Update CSS custom properties in `:root` definitions
- Test with color blindness simulators

---

### Phase 5: Screen Reader Testing (2-3 days)

#### 5.1 Test Setup
- **Windows:** NVDA (free, open source)
- **macOS:** VoiceOver (built-in)
- **Test browsers:** Chrome on Windows with NVDA, Safari on macOS with VoiceOver

#### 5.2 Test Scenarios

**Popup UI:**
1. Open popup → Tab through all elements → verify all are announced with correct roles
2. Activate tabs with Space/Enter → verify tab panel content is read
3. Search snippets → verify result count is announced
4. Edit a snippet → verify form labels are announced
5. Trigger toast → verify message is announced immediately

**Admin Panel:**
1. Tab through category filters → verify radio group behavior
2. Navigate wizard → verify progress is announced
3. View analytics charts → verify data table is discoverable
4. Enter PIN → verify requirements are announced

**Content Script (on test page):**
1. Type `;4b` in input → verify autocomplete list is announced
2. Press Arrow Down → verify selected option is announced
3. Press Enter to accept → verify "Snippet expanded" is announced
4. No dropdown shown → verify no spurious announcements

#### 5.3 Issues to Fix
- Document any elements that are skipped or incorrectly announced
- Fix missing `aria-label`, `aria-labelledby`, or `aria-describedby`
- Ensure live regions aren't too verbose (balance between informative and annoying)

---

## Testing Checklist

### Automated Testing
- [ ] Run axe DevTools browser extension on popup.html
- [ ] Run axe DevTools on admin.html
- [ ] Run WAVE browser extension for visual indicators
- [ ] Validate HTML with W3C validator

### Manual Testing
- [ ] Navigate entire popup UI with keyboard only (no mouse)
- [ ] Navigate admin panel with keyboard only
- [ ] Test autocomplete with keyboard only (Arrow keys, Tab, Enter, Escape)
- [ ] Verify all interactive elements have visible focus indicator
- [ ] Test with NVDA on Windows Chrome
- [ ] Test with VoiceOver on macOS Safari
- [ ] Test with 200% browser zoom (WCAG 1.4.4 Resize Text)
- [ ] Test with Windows High Contrast Mode
- [ ] Test color contrast with online checkers

---

## Acceptance Criteria

### Must Have (Blocking)
- ✅ All WCAG 2.1 Level A criteria met
- ✅ All WCAG 2.1 Level AA criteria met (except 1.2.x audio/video, not applicable)
- ✅ 0 critical axe DevTools violations
- ✅ 0 serious axe DevTools violations
- ✅ NVDA successfully announces all UI changes
- ✅ All functionality available via keyboard

### Should Have (Non-blocking)
- ✅ 0 moderate axe DevTools violations
- ✅ VoiceOver testing passes on macOS
- ✅ High Contrast Mode renders correctly
- ✅ All colors have 7:1 contrast ratio (AAA, exceeds AA requirement)

---

## Documentation Updates

### CLAUDE.md
Add new section:
```markdown
## ACCESSIBILITY

**WCAG Compliance:** Level AA

### Screen Reader Support
- Tested with NVDA 2025.1 on Windows 11 + Chrome 120
- Tested with VoiceOver on macOS 14 + Safari 17

### Keyboard Navigation
- All features accessible via keyboard
- Tab order follows visual layout
- Focus indicators visible on all interactive elements
- Autocomplete: Arrow Up/Down to navigate, Tab/Enter to accept, Escape to dismiss

### Color Contrast
- All text meets 4.5:1 minimum contrast ratio
- Large text meets 3:1 ratio
- UI components meet 3:1 contrast with adjacent colors
```

### MEMORY.md
Add to "Architecture Notes":
```
- ARIA attributes required for all interactive elements (tabs, buttons, inputs, live regions)
- Screen reader testing is mandatory for any UI changes (NVDA on Windows, VoiceOver on macOS)
- Color contrast must be checked with online tools before committing CSS changes
```

---

## Effort Breakdown

| Phase | Effort | Dependencies |
|---|---|---|
| Phase 1: Popup ARIA | 3-4 days | None |
| Phase 2: Admin ARIA | 2-3 days | None (can run parallel) |
| Phase 3: Content Script ARIA | 2-3 days | Phase 1 (for consistency) |
| Phase 4: Contrast Audit | 1 day | Phases 1-3 complete |
| Phase 5: Screen Reader Testing | 2-3 days | All phases complete |
| **Total** | **10-14 days** | ~2 weeks |

---

## Governance Impact

**Positive:**
- Meets increasing accessibility requirements in enterprise IT policies
- Demonstrates commitment to inclusive design
- May be required for AODA/ADA compliance (Canada/US)
- Reduces risk of accessibility-related complaints

**Neutral:**
- No new permissions required
- No changes to security posture
- No external dependencies

---

## Future Enhancements

- **Reduced Motion:** Respect `prefers-reduced-motion` for animations
- **High Contrast Images:** Provide SVG icons that work in Windows High Contrast Mode
- **Zoom Support:** Test at 400% zoom (WCAG 2.1 Level AAA)
- **Focus Management:** Return focus to trigger element after modal dismissal
- **Skip Links:** Add "Skip to main content" link for complex navigation

---

**Status:** Ready for implementation
**Estimated Release:** Q2 2026
