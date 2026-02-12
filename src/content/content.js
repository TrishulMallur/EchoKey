/**
 * EchoKey — Content Script
 * =======================================
 * Monitors text input across all web pages. When a registered shortcode
 * is detected (e.g., ";4bpcmt"), it replaces the shortcode with the
 * full comment text inline.
 *
 * Works with: <input>, <textarea>, and contenteditable elements.
 * Trigger: Shortcode expands immediately on Space, Tab, or Enter.
 *
 * PRIVACY: All data stored locally via chrome.storage.local.
 *          No network requests. No external data transmission.
 */

(function () {
  "use strict";

  // ── State ──
  let snippets = {};      // { ";4bpcmt": "4B: Updated Postal Code using MT103", ... }
  let buffer = "";        // Keystroke accumulator
  let enabled = true;     // Global on/off toggle
  const PREFIX = ";";     // Shortcode prefix character
  const MAX_BUFFER = 20;  // Max buffer length (longest shortcode + margin)

  // ── Stats tracking (buffered writes) ──
  let pendingStats = {};       // { ";code": incrementCount, ... } — pending increments
  let pendingTotalInc = 0;     // pending total expansion increment
  let statsFlushTimer = null;  // setInterval ID for periodic flush
  let isFlushing = false;      // Guard flag to prevent concurrent flushStats() calls
  const STATS_FLUSH_INTERVAL = 10000; // 10 seconds

  // ── Autocomplete state ──
  let acMinChars = 2;              // Configurable via teamSettings
  const AC_MAX_ITEMS = 6;       // Max suggestions shown
  const AC_DEBOUNCE_MS = 50;    // Debounce filter updates
  let feedbackFlashEnabled = true; // Configurable via teamSettings
  let acContainer = null;       // Shadow DOM host element
  let acShadowRoot = null;      // Shadow root
  let acListEl = null;          // The <ul> inside shadow DOM
  let acVisible = false;        // Is overlay currently showing?
  let acItems = [];             // Current filtered suggestions [{code, expansion, score}]
  let acSelectedIdx = -1;       // Currently highlighted index
  let acDebounceTimer = null;   // Debounce timer ID

  // ── Trigger keys: these finalize a shortcode and trigger expansion ──
  const TRIGGER_KEYS = new Set(["Space", "Tab", "Enter"]);

  // ── Keys that reset the buffer (cursor movement, etc.) ──
  const RESET_KEYS = new Set([
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown",
    "Escape", "Delete"
  ]);

  // ═══════════════════════════════════════════════════════════
  // SNIPPET LOADING
  // ═══════════════════════════════════════════════════════════

  function loadSnippets() {
    chrome.storage.local.get(
      ["snippets", "managedSnippets", "userSnippets", "enabled", "schemaVersion", "teamSettings"],
      (data) => {
        if (data.schemaVersion >= 2) {
          const managed = data.managedSnippets || {};
          const user = data.userSnippets || {};
          snippets = Object.assign({}, managed, user);
        } else {
          snippets = data.snippets || {};
        }

        if (typeof data.enabled === "boolean") {
          enabled = data.enabled;
        }

        // Apply team settings (NO $)
        if (data.teamSettings) {
          const ts = data.teamSettings;
          if (typeof ts.autocompleteMinChars === "number") {
            acMinChars = Math.max(1, Math.min(5, ts.autocompleteMinChars));
          }
          if (typeof ts.showFeedbackFlash === "boolean") {
            feedbackFlashEnabled = ts.showFeedbackFlash;
          }
        }

        console.log(
          `[EchoKey] Loaded ${Object.keys(snippets).length} snippets. ` +
          `Status: ${enabled ? "ON" : "OFF"} | AC min: ${acMinChars} | Flash: ${feedbackFlashEnabled}`
        );

        // After loading snippets, check for pending stats left by beforeunload.
        // The beforeunload handler writes perSnippet as {code: {count, lastUsed}}.
        // We merge these back into the in-memory pendingStats (which are simple
        // integer counts) and pendingTotalInc, then flush to persistent storage.
        chrome.storage.local.get(["statsPending"], (pending) => {
          if (pending.statsPending && pending.statsPending.totalInc > 0) {
            const p = pending.statsPending;
            pendingTotalInc += p.totalInc;
            for (const [code, data] of Object.entries(p.perSnippet || {})) {
              if (!pendingStats[code]) pendingStats[code] = 0;
              pendingStats[code] += data.count;
            }
            chrome.storage.local.remove(["statsPending"]);
            flushStats();
          }
        });
      }
    );
  }

  // Listen for storage changes (user edits snippets in popup)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.managedSnippets || changes.userSnippets || changes.snippets || changes.teamSettings) {
      loadSnippets();
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue;
      console.log(`[EchoKey] ${enabled ? "Enabled" : "Disabled"}`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // EXPANSION ENGINE
  // ═══════════════════════════════════════════════════════════

  /**
   * Check buffer for a matching shortcode and expand it.
   * Returns true if expansion occurred.
   */
  function tryExpand(target) {
    if (!enabled || !buffer.includes(PREFIX)) return false;

    // Normalize to lowercase for matching
    const bufferLower = buffer.toLowerCase();

    // Find the longest matching shortcode at the END of the buffer
    let matchedCode = null;
    let matchedExpansion = null;

    for (const [code, expansion] of Object.entries(snippets)) {
      const codeLower = code.toLowerCase();
      if (bufferLower.endsWith(codeLower)) {
        if (!matchedCode || code.length > matchedCode.length) {
          matchedCode = code;
          matchedExpansion = expansion;
        }
      }
    }

    if (!matchedCode) return false;

    // Perform the replacement
    if (isContentEditable(target)) {
      replaceInContentEditable(target, matchedCode.length, matchedExpansion);
    } else {
      replaceInInput(target, matchedCode.length, matchedExpansion);
    }

    buffer = "";
    showFeedback(target);
    recordExpansion(matchedCode);
    return true;
  }

  /**
   * Replace text in a standard input or textarea.
   * Uses native property descriptor setter to ensure React/Angular state tracking.
   */
  function replaceInInput(el, codeLength, expansion) {
    // Guard: selectionStart throws on <input type="email"> in some browsers
    let pos;
    try {
      pos = el.selectionStart;
    } catch (err) {
      console.warn("[EchoKey] selectionStart not supported on this input type");
      return;
    }
    const val = el.value;

    // The shortcode ends at the cursor position
    const before = val.substring(0, pos - codeLength);
    const after = val.substring(pos);
    const newValue = before + expansion + after;

    // Use native setter to trigger React's internal _valueTracker
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(el, newValue);

    // Set cursor to end of expansion
    const newPos = before.length + expansion.length;
    el.selectionStart = newPos;
    el.selectionEnd = newPos;

    // Dispatch input event so frameworks (React, Angular, etc.) detect the change
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Replace text in a contenteditable element.
   * Uses execCommand for undo compatibility where possible.
   */
  function replaceInContentEditable(el, codeLength, expansion) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    // Move selection back by codeLength to select the shortcode
    try {
      // Use modify() for reliable backward selection
      for (let i = 0; i < codeLength; i++) {
        sel.modify("extend", "backward", "character");
      }

      // Delete selected shortcode and insert expansion
      // execCommand is deprecated but still the most compatible way
      // to insert text with undo support in contenteditable
      document.execCommand("insertText", false, expansion);
    } catch (err) {
      // Fallback: direct DOM manipulation.
      // Get a fresh range since sel.modify() in the try block may have
      // mutated the original range, leaving it in an inconsistent state.
      console.warn("[EchoKey] execCommand fallback:", err);
      const freshRange = sel.rangeCount ? sel.getRangeAt(0) : range;
      freshRange.setStart(freshRange.startContainer, Math.max(0, freshRange.startOffset - codeLength));
      freshRange.deleteContents();
      freshRange.insertNode(document.createTextNode(expansion));
      freshRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(freshRange);
    }

    // Dispatch input event
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ═══════════════════════════════════════════════════════════
  // VISUAL FEEDBACK
  // ═══════════════════════════════════════════════════════════

  function showFeedback(target) {
    // Respect team setting for feedback flash
    if (!feedbackFlashEnabled) return;
    // Brief green flash on the field border
    const origOutline = target.style.outline;
    const origTransition = target.style.transition;
    target.style.transition = "outline-color 0.2s";
    target.style.outline = "2px solid #16A34A";
    setTimeout(() => {
      target.style.outline = origOutline;
      target.style.transition = origTransition;
    }, 600);
  }

  // ═══════════════════════════════════════════════════════════
  // STATS TRACKING
  // ═══════════════════════════════════════════════════════════

  /**
   * Record a successful expansion for stats. Buffers in memory;
   * flushed to storage periodically or on page unload.
   * @param {string} code - The matched shortcode (e.g., ";4bpcmt")
   */
  function recordExpansion(code) {
    pendingTotalInc++;
    if (!pendingStats[code]) {
      pendingStats[code] = 0;
    }
    pendingStats[code]++;
  }

  /**
   * Flush buffered stats to chrome.storage.local.
   * Reads current stats, merges pending increments, writes back.
   * Resets pending counters after successful write.
   * Uses a guard flag to prevent race conditions from concurrent calls.
   */
  function flushStats() {
    // Early exit if no pending stats
    if (pendingTotalInc === 0) return;

    // Guard: prevent concurrent flushes from overwriting each other
    if (isFlushing) {
      console.log("[EchoKey] Stats flush already in progress, skipping duplicate call");
      return;
    }

    // Set guard flag immediately
    isFlushing = true;

    // Capture pending increments to local variables BEFORE async operations
    const incTotal = pendingTotalInc;
    const incPerSnippet = { ...pendingStats };

    // Clear pending counters immediately (before async call) to capture new expansions
    // that occur during the async storage operation
    pendingTotalInc = 0;
    pendingStats = {};

    chrome.storage.local.get(["stats", "dailyStats"], (data) => {
      const stats = data.stats || { expansions: 0, lastUsed: null, perSnippet: {} };
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      stats.expansions = (stats.expansions || 0) + incTotal;
      stats.lastUsed = now;

      if (!stats.perSnippet) {
        stats.perSnippet = {};
      }

      for (const [code, inc] of Object.entries(incPerSnippet)) {
        if (!stats.perSnippet[code]) {
          stats.perSnippet[code] = { count: 0, lastUsed: null };
        }
        stats.perSnippet[code].count += inc;
        stats.perSnippet[code].lastUsed = now;
      }

      // Daily stats
      let daily = data.dailyStats || { date: today, count: 0 };
      if (daily.date !== today) {
        daily = { date: today, count: 0 };
      }
      daily.count += incTotal;

      chrome.storage.local.set({ stats, dailyStats: daily }, () => {
        // Reset guard flag only after storage write completes
        isFlushing = false;
      });
    });
  }

  // Start periodic flush timer
  statsFlushTimer = setInterval(flushStats, STATS_FLUSH_INTERVAL);

  // Flush on page unload to avoid losing pending stats.
  // Uses a synchronous-safe direct write of pending deltas (no read-modify-write)
  // since the async flushStats() callback may not complete before page teardown.
  window.addEventListener("beforeunload", () => {
    if (pendingTotalInc === 0) return;
    // Convert raw increment counts to {count, lastUsed} format for merge
    const now = new Date().toISOString();
    const perSnippetData = {};
    for (const [code, count] of Object.entries(pendingStats)) {
      perSnippetData[code] = { count, lastUsed: now };
    }
    // Write pending deltas directly without reading first (synchronous-safe)
    chrome.storage.local.set({
      statsPending: {
        totalInc: pendingTotalInc,
        perSnippet: perSnippetData,
        timestamp: Date.now()
      }
    });
    pendingTotalInc = 0;
    pendingStats = {};
  });

  // ═══════════════════════════════════════════════════════════
  // AUTOCOMPLETE OVERLAY
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize the Shadow DOM container for the autocomplete dropdown.
   * Called once on first use (lazy init).
   */
  function initAutocomplete() {
    if (acContainer && acContainer.isConnected) return;
    // If container exists but is detached (SPA replaced document.body), null it
    // out so the rest of initAutocomplete() recreates everything fresh.
    if (acContainer && !acContainer.isConnected) {
      acContainer = null;
      acShadowRoot = null;
      acListEl = null;
    }

    acContainer = document.createElement("div");
    acContainer.id = "echokey-autocomplete-host";
    acContainer.style.cssText = "position:fixed;z-index:999999;pointer-events:none;top:0;left:0;width:0;height:0;";
    document.body.appendChild(acContainer);

    acShadowRoot = acContainer.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .ac-dropdown {
        position: fixed;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        max-width: 380px;
        min-width: 240px;
        overflow: hidden;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        pointer-events: auto;
        display: none;
      }
      .ac-dropdown.visible { display: block; }
      .ac-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        cursor: pointer;
        border-bottom: 1px solid #F1F5F9;
        transition: background 0.08s;
      }
      .ac-item:last-child { border-bottom: none; }
      .ac-item:hover, .ac-item.selected {
        background: #DBEAFE;
      }
      .ac-code {
        font-family: 'Consolas', 'Courier New', monospace;
        font-weight: 700;
        color: #2563EB;
        background: #EFF6FF;
        padding: 1px 5px;
        border-radius: 3px;
        white-space: nowrap;
        font-size: 11px;
      }
      .ac-text {
        color: #1E293B;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ac-hint {
        font-size: 10px;
        color: #94A3B8;
        padding: 4px 10px;
        background: #F8FAFC;
        border-top: 1px solid #E2E8F0;
      }
    `;
    acShadowRoot.appendChild(style);

    const dropdown = document.createElement("div");
    dropdown.className = "ac-dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.id = "echokey-ac-list";
    acShadowRoot.appendChild(dropdown);

    acListEl = dropdown;
  }

  /**
   * Filter snippets matching the current buffer prefix.
   * Returns up to AC_MAX_ITEMS sorted by relevance.
   */
  function filterSuggestions(query) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [code, expansion] of Object.entries(snippets)) {
      const codeLower = code.toLowerCase();
      const expansionLower = expansion.toLowerCase();
      let score = 0;

      // Prefix match on shortcode (highest relevance)
      if (codeLower.startsWith(queryLower)) {
        score = 10000 - codeLower.length; // shorter = more relevant
      }
      // Partial match on shortcode
      else if (codeLower.includes(queryLower)) {
        score = 5000 - codeLower.length;
      }
      // Match in expansion text
      else if (expansionLower.includes(queryLower)) {
        score = 1000;
      }
      else {
        continue;
      }

      results.push({ code, expansion, score });
    }

    results.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    return results.slice(0, AC_MAX_ITEMS);
  }

  /**
   * Calculate approximate caret position for dropdown positioning.
   */
  function getCaretPosition(el) {
    if (isContentEditable(el)) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          // Collapsed range at start - use element position
          const elRect = el.getBoundingClientRect();
          return { x: elRect.left + 4, y: elRect.bottom + 2 };
        }
        return { x: rect.left, y: rect.bottom + 2 };
      }
      const elRect = el.getBoundingClientRect();
      return { x: elRect.left, y: elRect.bottom + 2 };
    }

    // For input/textarea: use mirror div technique
    const mirror = document.createElement("div");
    const computed = window.getComputedStyle(el);

    mirror.style.cssText = [
      "position:absolute", "visibility:hidden", "white-space:pre-wrap",
      "word-wrap:break-word", "overflow:hidden",
      `width:${computed.width}`,
      `font:${computed.font}`,
      `padding:${computed.padding}`,
      `border:${computed.border}`,
      `letter-spacing:${computed.letterSpacing}`,
      `line-height:${computed.lineHeight}`,
    ].join(";");

    document.body.appendChild(mirror);

    const pos = el.selectionStart || 0;
    const textBefore = el.value.substring(0, pos);

    mirror.textContent = textBefore;

    const span = document.createElement("span");
    span.textContent = "|";
    mirror.appendChild(span);

    const spanRect = span.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    document.body.removeChild(mirror);

    // Approximate position using element's top-left + mirror offset
    const x = elRect.left + Math.min(
      spanRect.left - mirrorRect.left,
      elRect.width - 20
    );
    // Use mirror div's vertical offset to position near the caret's actual line,
    // rather than always placing at the bottom of the element
    const lineHeight = parseInt(computed.lineHeight, 10) || 20;
    const y = elRect.top + (spanRect.top - mirrorRect.top) + lineHeight + 2;

    return { x: Math.max(x, elRect.left), y };
  }

  /**
   * Show/update the autocomplete dropdown.
   */
  function showAutocomplete(el) {
    initAutocomplete();

    // Extract the typed prefix starting from ";"
    const bufferLower = buffer.toLowerCase();
    const semiIdx = bufferLower.lastIndexOf(";");
    if (semiIdx < 0) { hideAutocomplete(); return; }

    const query = bufferLower.substring(semiIdx);
    if (query.length < acMinChars) { hideAutocomplete(); return; }

    const items = filterSuggestions(query);
    if (items.length === 0) { hideAutocomplete(); return; }

    acItems = items;
    acSelectedIdx = 0;

    // Position dropdown near caret
    const pos = getCaretPosition(el);
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let x = pos.x;
    let y = pos.y;

    // Prevent overflow right
    if (x + 380 > vpW) x = vpW - 390;
    if (x < 4) x = 4;

    // Prevent overflow bottom (show above if needed)
    if (y + 200 > vpH) {
      y = pos.y - 200 - 20; // above the caret
      if (y < 4) y = 4;
    }

    acListEl.style.left = x + "px";
    acListEl.style.top = y + "px";

    // Render items
    acListEl.innerHTML = "";
    items.forEach((item, i) => {
      const div = document.createElement("div");
      div.className = "ac-item" + (i === 0 ? " selected" : "");
      div.setAttribute("role", "option");
      div.setAttribute("aria-selected", i === 0 ? "true" : "false");
      div.innerHTML = `
        <span class="ac-code">${escapeHtml(item.code)}</span>
        <span class="ac-text">${escapeHtml(item.expansion)}</span>
      `;
      div.addEventListener("mousedown", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        acceptSuggestion(el, i);
      });
      div.addEventListener("mouseenter", () => {
        updateSelection(i);
      });
      acListEl.appendChild(div);
    });

    // Add hint row
    const hint = document.createElement("div");
    hint.className = "ac-hint";
    hint.textContent = "\u2191\u2193 Navigate \u00B7 Tab/Enter Accept \u00B7 Esc Dismiss";
    acListEl.appendChild(hint);

    acListEl.classList.add("visible");
    acVisible = true;
  }

  /** Update visual selection */
  function updateSelection(idx) {
    if (!acListEl) return;
    const items = acListEl.querySelectorAll(".ac-item");
    items.forEach((el, i) => {
      el.classList.toggle("selected", i === idx);
      el.setAttribute("aria-selected", i === idx ? "true" : "false");
    });
    acSelectedIdx = idx;
  }

  /** Accept the currently selected suggestion */
  function acceptSuggestion(el, idx) {
    if (idx < 0 || idx >= acItems.length) return;

    const item = acItems[idx];
    const bufferLower = buffer.toLowerCase();
    const semiIdx = bufferLower.lastIndexOf(";");
    const typedLen = buffer.length - semiIdx; // how many chars typed since ";"

    // Replace the typed prefix with the full expansion
    if (isContentEditable(el)) {
      replaceInContentEditable(el, typedLen, item.expansion);
    } else {
      replaceInInput(el, typedLen, item.expansion);
    }

    buffer = "";
    showFeedback(el);
    recordExpansion(item.code);
    hideAutocomplete();
  }

  /** Hide the autocomplete dropdown */
  function hideAutocomplete() {
    if (acListEl) {
      acListEl.classList.remove("visible");
      acListEl.innerHTML = "";
    }
    acVisible = false;
    acItems = [];
    acSelectedIdx = -1;
  }

  /** HTML escape for autocomplete display */
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  function isContentEditable(el) {
    return el.isContentEditable || el.getAttribute("contenteditable") === "true";
  }

  function isTextField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      return ["text", "search", "url", "email", ""].includes(type);
    }
    if (isContentEditable(el)) return true;
    return false;
  }

  /**
   * Main keydown handler — manages buffer and triggers expansion.
   */
  function onKeyDown(e) {
    if (!enabled) return;

    const target = e.target;
    if (!isTextField(target)) return;

    // ── Autocomplete navigation keys (when overlay is visible) ──
    if (acVisible) {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const next = (acSelectedIdx + 1) % acItems.length;
        updateSelection(next);
        return;
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const prev = (acSelectedIdx - 1 + acItems.length) % acItems.length;
        updateSelection(prev);
        return;
      }
      if (e.code === "Tab" || e.code === "Enter") {
        if (acSelectedIdx >= 0 && acItems.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          acceptSuggestion(target, acSelectedIdx);
          return;
        }
      }
      if (e.code === "Escape") {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }

    // ── Trigger keys: try expanding before the character is inserted ──
    if (TRIGGER_KEYS.has(e.code)) {
      hideAutocomplete();
      if (tryExpand(target)) {
        return;
      }
      buffer = "";
      return;
    }

    // ── Reset keys ──
    if (RESET_KEYS.has(e.code)) {
      buffer = "";
      hideAutocomplete();
      return;
    }

    // ── Backspace: trim buffer ──
    if (e.code === "Backspace") {
      buffer = buffer.slice(0, -1);
      scheduleAutocomplete(target);
      return;
    }

    // ── Modifier combos (Ctrl+C, etc.): ignore ──
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // ── Regular character: append to buffer ──
    if (e.key.length === 1) {
      buffer += e.key;

      // Trim buffer if it exceeds max length
      if (buffer.length > MAX_BUFFER) {
        buffer = buffer.slice(-MAX_BUFFER);
      }

      scheduleAutocomplete(target);
    }
  }

  /**
   * Schedule a debounced autocomplete update.
   */
  function scheduleAutocomplete(el) {
    if (acDebounceTimer) clearTimeout(acDebounceTimer);
    acDebounceTimer = setTimeout(() => {
      if (buffer.includes(PREFIX) && enabled) {
        showAutocomplete(el);
      } else {
        hideAutocomplete();
      }
    }, AC_DEBOUNCE_MS);
  }

  /**
   * Reset buffer on focus change, mouse click, etc.
   */
  function onFocusOrClick() {
    buffer = "";
    hideAutocomplete();
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  // Load snippets from storage
  loadSnippets();

  // Attach global event listeners (capture phase for reliability)
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onFocusOrClick, true);
  document.addEventListener("focusin", onFocusOrClick, true);

  console.log("[EchoKey] Content script loaded. Waiting for snippets...");
})();
