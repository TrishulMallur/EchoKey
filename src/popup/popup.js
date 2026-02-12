/**
 * EchoKey — Popup Logic
 * ====================================
 * Manages snippets: view, search, add, edit, delete, import/export.
 */

(function () {
  "use strict";

  // ── DOM refs ──
  const snippetList = document.getElementById("snippetList");
  const searchInput = document.getElementById("search");
  const countBadge = document.getElementById("count");
  const footerCount = document.getElementById("footerCount");
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleLabel = document.getElementById("toggleLabel");
  const addPanel = document.getElementById("addPanel");
  const addCode = document.getElementById("addCode");
  const addExpansion = document.getElementById("addExpansion");
  const addError = document.getElementById("addError");
  const addWarning = document.getElementById("addWarning");
  const addSaveBtn = document.getElementById("addSaveBtn");
  const addCancelBtn = document.getElementById("addCancelBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  const resetBtn = document.getElementById("resetBtn");
  const toast = document.getElementById("toast");
  const exportPanel = document.getElementById("exportPanel");
  const exportIncludeManaged = document.getElementById("exportIncludeManaged");
  const exportConfirmBtn = document.getElementById("exportConfirmBtn");
  const exportCancelBtn = document.getElementById("exportCancelBtn");
  const statsPanel = document.getElementById("statsPanel");
  const statTotalExp = document.getElementById("statTotalExpansions");
  const statTodayCount = document.getElementById("statTodayCount");
  const statLastUsed = document.getElementById("statLastUsed");
  const statsTop5 = document.getElementById("statsTop5");
  const statsBottom5 = document.getElementById("statsBottom5");
  const resetStatsBtn = document.getElementById("resetStatsBtn");

  // Bulk ops
  const bulkToggle = document.getElementById("bulkToggle");
  const bulkBar = document.getElementById("bulkBar");
  const bulkCount = document.getElementById("bulkCount");
  const bulkSelectAll = document.getElementById("bulkSelectAll");
  const bulkDeselectAll = document.getElementById("bulkDeselectAll");
  const bulkExportBtn = document.getElementById("bulkExportBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");

  // Admin
  const adminBtn = document.getElementById("adminBtn");

  let snippets = {};
  let bulkMode = false;
  let enabled = true;
  let editingCode = null; // track if we're editing vs adding
  let managedSnippets = {};  // Locked tier -- from DEFAULT_SNIPPETS
  let userSnippets = {};     // User-editable tier
  let schemaVersion = 1;     // Track which schema we are on

  /** Recompute merged snippets from both tiers. User overrides managed on collision. */
  function mergeSnippets() {
    snippets = Object.assign({}, managedSnippets, userSnippets);
  }

  /** Check if a shortcode belongs to the managed tier and is NOT overridden by user. */
  function isManaged(code) {
    return code in managedSnippets && !(code in userSnippets);
  }

  const CATEGORY_LABELS = {
    "4B": "4B — Beneficiary Information",
    "5": "5 — BIC / Routing",
    "7": "7 — Data Omissions",
    "8B": "8B — Special Procedures",
    "9": "9 — Geographic / Regional",
    "Other": "Other",
  };

  const CATEGORY_ORDER = ["4B", "5", "7", "8B", "9", "Other"];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  function render(filter = "") {
    snippetList.innerHTML = "";
    const filterLower = filter.toLowerCase();

    // Group by category
    const groups = {};
    for (const [code, expansion] of Object.entries(snippets)) {
      if (filter && !code.toLowerCase().includes(filterLower) &&
        !expansion.toLowerCase().includes(filterLower)) {
        continue;
      }
      const cat = EchoKeyShared.getCategory(code);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ code, expansion });
    }

    // Sort within each group
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => a.code.localeCompare(b.code));
    }

    let totalShown = 0;

    for (const cat of CATEGORY_ORDER) {
      if (!groups[cat] || groups[cat].length === 0) continue;

      const header = document.createElement("div");
      header.className = "category-header";
      header.textContent = `${CATEGORY_LABELS[cat] || cat}  (${groups[cat].length})`;
      snippetList.appendChild(header);

      for (const { code, expansion } of groups[cat]) {
        const managed = isManaged(code);
        const isOverride = (code in managedSnippets) && (code in userSnippets);
        const icon = isOverride ? "&#128260;" : (managed ? "&#128274;" : "&#9999;&#65039;");
        const iconTitle = isOverride ? "User override of managed snippet" : (managed ? "Managed snippet" : "Custom snippet");
        const row = document.createElement("div");
        row.className = "snippet-row" + (managed ? " managed" : "");
        row.innerHTML = `
          <input type="checkbox" class="bulk-check" data-code="${EchoKeyShared.escAttr(code)}"${managed ? ' disabled' : ''}>
          <span class="tier-icon" title="${iconTitle}">${icon}</span>
          <span class="snippet-code">${EchoKeyShared.escHtml(code)}</span>
          <span class="snippet-text" title="${EchoKeyShared.escHtml(expansion)}">${EchoKeyShared.escHtml(expansion)}</span>
          <div class="snippet-actions">
            <button class="icon-btn edit" title="Edit" data-code="${EchoKeyShared.escAttr(code)}">&#9999;&#65039;</button>
            <button class="icon-btn delete" title="Delete" data-code="${EchoKeyShared.escAttr(code)}">&#128465;&#65039;</button>
          </div>
        `;
        snippetList.appendChild(row);
        totalShown++;
      }
    }

    if (totalShown === 0) {
      snippetList.innerHTML = `<div class="empty-state">${filter ? "No snippets match your search." : "No snippets. Click '+ Add New' to create one."
        }</div>`;
    }

    // Update counts
    const total = Object.keys(snippets).length;
    countBadge.textContent = total;
    footerCount.textContent = `${total} snippet${total !== 1 ? "s" : ""} loaded`;
  }

  // ═══════════════════════════════════════════════════════════
  // STATS RENDERING
  // ═══════════════════════════════════════════════════════════

  function renderStats() {
    chrome.storage.local.get(["stats", "dailyStats"], (data) => {
      const stats = data.stats || { expansions: 0, lastUsed: null, perSnippet: {} };
      const perSnippet = stats.perSnippet || {};

      statTotalExp.textContent = (stats.expansions || 0).toLocaleString();

      const daily = data.dailyStats || { date: "", count: 0 };
      const today = new Date().toISOString().slice(0, 10);
      statTodayCount.textContent = (daily.date === today ? daily.count : 0).toLocaleString();

      if (stats.lastUsed) {
        const d = new Date(stats.lastUsed);
        statLastUsed.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        statLastUsed.textContent = "Never";
      }

      const entries = Object.entries(perSnippet)
        .map(([code, info]) => ({ code, count: info.count, lastUsed: info.lastUsed }))
        .sort((a, b) => b.count - a.count);

      renderBarChart(statsTop5, entries.slice(0, 5), "top");

      const nonZero = entries.filter(e => e.count > 0);
      const bottom = nonZero.slice(-5).reverse();
      renderBarChart(statsBottom5, bottom, "bottom");
    });
  }

  function renderBarChart(container, items, type) {
    container.innerHTML = "";

    if (items.length === 0) {
      container.innerHTML = '<div class="stats-empty">No usage data yet</div>';
      return;
    }

    const maxCount = Math.max(...items.map(i => i.count), 1);

    for (const item of items) {
      const pct = Math.round((item.count / maxCount) * 100);
      const row = document.createElement("div");
      row.className = "stat-bar-row";
      row.innerHTML = `
        <span class="stat-bar-code">${EchoKeyShared.escHtml(item.code)}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill ${type}" style="width:${pct}%"></div>
        </div>
        <span class="stat-bar-count">${item.count}</span>
      `;
      container.appendChild(row);
    }
  }

  resetStatsBtn.addEventListener("click", () => {
    if (confirm("Reset all usage statistics? This cannot be undone.")) {
      chrome.storage.local.set({
        stats: { expansions: 0, lastUsed: null, perSnippet: {} },
        dailyStats: { date: new Date().toISOString().slice(0, 10), count: 0 }
      }, () => {
        renderStats();
        showToast("Stats reset");
      });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════

  function load() {
    chrome.storage.local.get(
      ["snippets", "managedSnippets", "userSnippets", "enabled", "schemaVersion"],
      (data) => {
        schemaVersion = data.schemaVersion || 1;
        if (schemaVersion >= 2) {
          managedSnippets = data.managedSnippets || {};
          userSnippets = data.userSnippets || {};
        } else {
          // v1 fallback: treat all as managed, none as user
          managedSnippets = data.snippets || {};
          userSnippets = {};
        }
        mergeSnippets();
        enabled = data.enabled !== false;
        updateToggle();
        render();
      }
    );
  }

  function save(callback) {
    chrome.storage.local.set(
      { managedSnippets, userSnippets },
      () => { mergeSnippets(); if (callback) callback(); }
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TOGGLE
  // ═══════════════════════════════════════════════════════════

  function updateToggle() {
    toggleBtn.classList.toggle("on", enabled);
    toggleLabel.textContent = enabled ? "ON" : "OFF";
  }

  toggleBtn.addEventListener("click", () => {
    enabled = !enabled;
    chrome.storage.local.set({ enabled });
    updateToggle();
    showToast(enabled ? "Expander enabled" : "Expander paused");
  });

  // ═══════════════════════════════════════════════════════════
  // TABS
  // ═══════════════════════════════════════════════════════════

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.tab;

      // Hide all panels
      addPanel.classList.remove("visible");
      editingCode = null;
      statsPanel.classList.remove("visible");
      document.querySelector(".search-bar").style.display = "flex";
      snippetList.style.display = "";

      if (target === "add") {
        showAddPanel();
      } else if (target === "stats") {
        document.querySelector(".search-bar").style.display = "none";
        snippetList.style.display = "none";
        statsPanel.classList.add("visible");
        renderStats();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════

  searchInput.addEventListener("input", () => {
    render(searchInput.value.trim());
  });

  // ═══════════════════════════════════════════════════════════
  // ADD / EDIT
  // ═══════════════════════════════════════════════════════════

  function showAddPanel(codeToEdit) {
    exportPanel.classList.remove("visible"); // Close export panel if open
    addPanel.classList.add("visible");
    addError.classList.remove("visible");
    addWarning.classList.remove("visible");
    editingCode = codeToEdit || null;

    if (codeToEdit) {
      addCode.value = codeToEdit;
      addExpansion.value = userSnippets[codeToEdit] || "";
      addCode.disabled = true;
      addSaveBtn.textContent = "Update";
    } else {
      addCode.value = ";";
      addExpansion.value = "";
      addCode.disabled = false;
      addSaveBtn.textContent = "Save Snippet";
    }
    addCode.focus();
  }

  function hideAddPanel() {
    addPanel.classList.remove("visible");
    editingCode = null;
    addWarning.classList.remove("visible");
    // Reset tab selection
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-tab="snippets"]').classList.add("active");
  }

  addSaveBtn.addEventListener("click", () => {
    const code = addCode.value.trim().toLowerCase();
    const expansion = addExpansion.value.trim();

    // Validate
    if (!code.startsWith(";") || code.length < 3) {
      showError("Shortcode must start with ';' and be at least 3 characters.");
      return;
    }
    if (/\s/.test(code)) {
      showError("Shortcode cannot contain spaces.");
      return;
    }
    if (!expansion) {
      showError("Expansion text cannot be empty.");
      return;
    }
    // Check for duplicate in user snippets (managed collisions are allowed as overrides)
    if (!editingCode && userSnippets[code]) {
      showError(`Shortcode "${code}" already exists in your custom snippets.`);
      return;
    }

    userSnippets[code] = expansion;

    // ── Feature 6: Shortcode Conflict Detection (non-blocking) ──
    let hasConflicts = false;
    if (code.length >= 3) {
      const conflicts = checkConflicts(code);
      if (conflicts.length > 0) {
        hasConflicts = true;
        addWarning.innerHTML = conflicts.join("<br>");
        addWarning.classList.add("visible");
      }
    }

    const wasEditing = !!editingCode;
    save(() => {
      render(searchInput.value.trim());
      if (hasConflicts) {
        // Keep panel open so user can read the yellow warning
        showToast(`Added ${code} — see warning below`);
      } else {
        const msg = wasEditing ? "Snippet updated" : `Added ${code}`;
        hideAddPanel();
        showToast(msg);
      }
    });
  });

  addCancelBtn.addEventListener("click", hideAddPanel);

  // Escape key: dismiss warning and close add panel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (addWarning.classList.contains("visible")) {
        addWarning.classList.remove("visible");
      }
      if (addPanel.classList.contains("visible")) {
        hideAddPanel();
      }
    }
  });

  function showError(msg) {
    addError.textContent = msg;
    addError.classList.add("visible");
  }

  // ═══════════════════════════════════════════════════════════
  // SHORTCODE CONFLICT DETECTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Check for prefix conflicts between a new shortcode and all existing snippets.
   * Returns an array of warning message strings (empty if no conflicts).
   * @param {string} newCode - The shortcode being added/saved.
   */
  function checkConflicts(newCode) {
    const warnings = [];
    const newLower = newCode.toLowerCase();
    const allCodes = Object.keys(Object.assign({}, managedSnippets, userSnippets));

    for (const existing of allCodes) {
      const existLower = existing.toLowerCase();
      if (existLower === newLower) continue; // skip self / exact dup — handled by other validation

      if (existLower.startsWith(newLower)) {
        // New code is a prefix of existing — new code will trigger first, shadowing the longer code
        warnings.push(`⚠️ <b>${EchoKeyShared.escHtml(newCode)}</b> is a prefix of <b>${EchoKeyShared.escHtml(existing)}</b> — the shorter code will always trigger first.`);
      } else if (newLower.startsWith(existLower)) {
        // Existing code is a prefix of new — existing will trigger first, shadowing this new code
        warnings.push(`⚠️ Existing <b>${EchoKeyShared.escHtml(existing)}</b> is a prefix — it will trigger before <b>${EchoKeyShared.escHtml(newCode)}</b> can be typed.`);
      }
    }

    return warnings;
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE / EDIT CLICKS
  // ═══════════════════════════════════════════════════════════

  snippetList.addEventListener("click", (e) => {
    const btn = e.target.closest(".icon-btn");
    if (!btn) return;

    const code = btn.dataset.code;
    if (!code) return;

    if (btn.classList.contains("delete")) {
      if (isManaged(code)) {
        showToast("Cannot delete managed snippets");
        return;
      }
      if (confirm(`Delete shortcode "${code}"?`)) {
        delete userSnippets[code];
        save(() => {
          render(searchInput.value.trim());
          showToast(`Deleted ${code}`);
        });
      }
    }

    if (btn.classList.contains("edit")) {
      if (isManaged(code)) {
        showToast("Cannot edit managed snippets");
        return;
      }
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelector('[data-tab="add"]').classList.add("active");
      showAddPanel(code);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // EXPORT / IMPORT / RESET
  // ═══════════════════════════════════════════════════════════

  exportBtn.addEventListener("click", () => {
    addPanel.classList.remove("visible");    // Close add panel if open
    editingCode = null;
    exportPanel.classList.add("visible");
    exportIncludeManaged.checked = false;
  });

  exportCancelBtn.addEventListener("click", () => {
    exportPanel.classList.remove("visible");
  });

  exportConfirmBtn.addEventListener("click", () => {
    const dataToExport = exportIncludeManaged.checked
      ? Object.assign({}, managedSnippets, userSnippets)
      : { ...userSnippets };

    EchoKeyShared.downloadJSON(dataToExport, `echokey-snippets-${new Date().toISOString().slice(0, 10)}.json`);
    exportPanel.classList.remove("visible");
    showToast("Exported to JSON");
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== "object" || Array.isArray(imported)) {
          throw new Error("Invalid format");
        }

        // Check for enhanced format (Feature 7: meta + managed/custom keys)
        let snippetsToProcess = imported;
        if (imported.meta && (imported.managed || imported.custom)) {
          snippetsToProcess = { ...imported.managed, ...imported.custom };
        }

        let added = 0;
        for (const [code, expansion] of Object.entries(snippetsToProcess)) {
          if (typeof code === "string" && typeof expansion === "string" && code.startsWith(";")) {
            userSnippets[code.toLowerCase()] = expansion;
            added++;
          }
        }

        save(() => {
          render();
          showToast(`Imported ${added} snippets to custom tier`);
        });
      } catch (err) {
        alert("Invalid JSON file. Expected format:\n{\"shortcode\": \"expansion\", ...}");
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  resetBtn.addEventListener("click", () => {
    if (confirm("Reset managed snippets to factory defaults? Your custom snippets will be preserved.")) {
      chrome.runtime.sendMessage({ action: "resetDefaults" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[EchoKey Popup] Reset failed:", chrome.runtime.lastError.message);
          showToast("Reset failed — try again");
          return;
        }
        if (!response || !response.ok) {
          showToast("Reset failed — unknown error");
          return;
        }
        load();
        showToast("Managed snippets reset to defaults");
      });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════

  function getSelectedCodes() {
    return Array.from(snippetList.querySelectorAll(".bulk-check:checked:not(:disabled)"))
      .map(cb => cb.dataset.code);
  }

  function updateBulkCount() {
    const count = getSelectedCodes().length;
    bulkCount.textContent = `${count} selected`;
  }

  bulkToggle.addEventListener("click", () => {
    bulkMode = !bulkMode;
    bulkToggle.classList.toggle("active", bulkMode);
    snippetList.classList.toggle("bulk-mode", bulkMode);
    bulkBar.classList.toggle("visible", bulkMode);
    if (!bulkMode) {
      // Clear all selections when exiting
      snippetList.querySelectorAll(".bulk-check").forEach(cb => cb.checked = false);
      updateBulkCount();
    }
  });

  snippetList.addEventListener("change", (e) => {
    if (e.target.classList.contains("bulk-check")) updateBulkCount();
  });

  bulkSelectAll.addEventListener("click", () => {
    snippetList.querySelectorAll(".bulk-check:not(:disabled)").forEach(cb => cb.checked = true);
    updateBulkCount();
  });

  bulkDeselectAll.addEventListener("click", () => {
    snippetList.querySelectorAll(".bulk-check").forEach(cb => cb.checked = false);
    updateBulkCount();
  });

  bulkDeleteBtn.addEventListener("click", () => {
    const codes = getSelectedCodes();
    if (codes.length === 0) { showToast("No snippets selected"); return; }
    if (!confirm(`Delete ${codes.length} user snippet${codes.length > 1 ? 's' : ''}?`)) return;
    for (const code of codes) {
      delete userSnippets[code];
    }
    save(() => {
      render(searchInput.value.trim());
      snippetList.classList.toggle("bulk-mode", bulkMode);
      updateBulkCount();
      showToast(`Deleted ${codes.length} snippet${codes.length > 1 ? 's' : ''}`);
    });
  });

  bulkExportBtn.addEventListener("click", () => {
    const codes = getSelectedCodes();
    if (codes.length === 0) { showToast("No snippets selected"); return; }
    const exportData = {};
    for (const code of codes) {
      exportData[code] = userSnippets[code];
    }
    EchoKeyShared.downloadJSON(exportData, `echokey-selected-${new Date().toISOString().slice(0, 10)}.json`);
    showToast(`Exported ${codes.length} snippet${codes.length > 1 ? 's' : ''}`);
  });

  // ═══════════════════════════════════════════════════════════
  // ADMIN PANEL LINK
  // ═══════════════════════════════════════════════════════════

  adminBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/admin.html") });
  });

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════

  function showToast(msg, duration = 1800) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), duration);
  }

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════

  load();
})();
