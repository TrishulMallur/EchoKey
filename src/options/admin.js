/**
 * EchoKey — Admin Panel Logic
 * ==========================================
 * PIN authentication, managed snippet CRUD, snippet builder wizard,
 * analytics dashboard, snippet pack distribution, team settings.
 *
 * PRIVACY: All data stored locally via chrome.storage.local.
 *          No network requests. No external data transmission.
 */

(function () {
    "use strict";

    // ═══════════════════════════════════════════════════════════
    // DOM REFERENCES
    // ═══════════════════════════════════════════════════════════

    // PIN Gate
    const pinOverlay = document.getElementById("pinOverlay");
    const pinTitle = document.getElementById("pinTitle");
    const pinSubtitle = document.getElementById("pinSubtitle");
    const pinInput = document.getElementById("pinInput");
    const pinError = document.getElementById("pinError");
    const pinHint = document.getElementById("pinHint");
    const pinSubmitBtn = document.getElementById("pinSubmitBtn");
    const pinTypeToggle = document.getElementById("pinTypeToggle");

    // Header
    const snippetCountHeader = document.getElementById("snippetCountHeader");
    const lockBtn = document.getElementById("lockBtn");

    // Snippets
    const adminSearch = document.getElementById("adminSearch");
    const snippetTableBody = document.getElementById("snippetTableBody");
    const addSnippetBtn = document.getElementById("addSnippetBtn");

    // Edit Modal
    const editModal = document.getElementById("editModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalCode = document.getElementById("modalCode");
    const modalExpansion = document.getElementById("modalExpansion");
    const modalError = document.getElementById("modalError");
    const modalSaveBtn = document.getElementById("modalSaveBtn");
    const modalCancelBtn = document.getElementById("modalCancelBtn");

    // Wizard
    const wizRemed = document.getElementById("wizRemed");
    const wizField = document.getElementById("wizField");
    const wizSource = document.getElementById("wizSource");
    const wizStep2Label = document.getElementById("wizStep2Label");
    const wizStep3Label = document.getElementById("wizStep3Label");
    const wizPreview = document.getElementById("wizPreview");
    const wizAddBtn = document.getElementById("wizAddBtn");
    const wizResetBtn = document.getElementById("wizResetBtn");
    const wizStatus = document.getElementById("wizStatus");

    // Analytics
    const anTotalExp = document.getElementById("anTotalExp");
    const anTodayCount = document.getElementById("anTodayCount");
    const anActiveCount = document.getElementById("anActiveCount");
    const anUnusedCount = document.getElementById("anUnusedCount");
    const anTop10 = document.getElementById("anTop10");
    const anBottom10 = document.getElementById("anBottom10");
    const anByCategory = document.getElementById("anByCategory");
    const anExportStatsBtn = document.getElementById("anExportStatsBtn");
    const anResetStatsBtn = document.getElementById("anResetStatsBtn");

    // Distribution
    const distExportBtn = document.getElementById("distExportBtn");
    const distImportBtn = document.getElementById("distImportBtn");
    const importPackFile = document.getElementById("importPackFile");

    // Settings
    const settingAcMinChars = document.getElementById("settingAcMinChars");
    const settingFeedbackFlash = document.getElementById("settingFeedbackFlash");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const changePinBtn = document.getElementById("changePinBtn");
    const currentPinType = document.getElementById("currentPinType");

    // Toast
    const toast = document.getElementById("toast");

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    let managedSnippets = {};
    let userSnippets = {};
    let activeFilter = "all";
    let searchQuery = "";
    let editingCode = null; // null = adding new, string = editing existing
    let pinType = "numeric"; // "numeric" or "alphanumeric"
    let isSetupMode = true;  // true = first-time PIN setup, false = unlock mode

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    function showToast(msg, type = "success") {
        toast.textContent = (type === "success" ? "✅ " : type === "error" ? "❌ " : "ℹ️ ") + msg;
        toast.className = "toast show " + type;
        setTimeout(() => { toast.className = "toast"; }, 2500);
    }

    function getCatBadgeClass(cat) {
        return "cat-badge cat-badge-" + cat.toLowerCase();
    }

    function getCatLabel(cat) {
        const labels = {
            "4B": "4B", "5": "5", "7": "7", "8B": "8B", "9": "9", "Other": "Other"
        };
        return labels[cat] || cat;
    }

    function getCatFillClass(cat) {
        return "chart-fill cat-" + cat.toLowerCase();
    }

    // ═══════════════════════════════════════════════════════════
    // PIN AUTHENTICATION (Web Crypto API — SHA-256)
    // ═══════════════════════════════════════════════════════════

    async function hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    function validatePinFormat(pin) {
        if (pinType === "numeric") {
            if (!/^\d{4,6}$/.test(pin)) {
                return "Numeric PIN must be 4-6 digits";
            }
        } else {
            if (pin.length < 4 || pin.length > 20) {
                return "Passcode must be 4-20 characters";
            }
            if (!/[a-zA-Z]/.test(pin) || !/\d/.test(pin)) {
                return "Passcode must contain both letters and numbers";
            }
        }
        return null;
    }

    function initPinGate() {
        chrome.storage.local.get(["adminPinHash", "adminPinType"], (data) => {
            if (data.adminPinHash) {
                // Existing PIN — show unlock mode
                isSetupMode = false;
                pinType = data.adminPinType || "numeric";
                pinTitle.textContent = "Admin Panel Locked";
                pinSubtitle.textContent = "Enter your PIN to access the admin panel";
                pinSubmitBtn.textContent = "Unlock";
                pinTypeToggle.style.display = "none";
                pinHint.textContent = pinType === "numeric" ? "Enter your numeric PIN" : "Enter your alphanumeric passcode";
                pinInput.type = "password";
                pinInput.maxLength = pinType === "numeric" ? 6 : 20;
                pinInput.placeholder = pinType === "numeric" ? "••••" : "••••••••";
            } else {
                // No PIN set — setup mode
                isSetupMode = true;
                pinTypeToggle.style.display = "flex";
                updatePinTypeUI();
            }
            pinOverlay.classList.remove("hidden");
            pinInput.focus();
        });
    }

    function updatePinTypeUI() {
        pinTypeToggle.querySelectorAll(".pin-type-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.type === pinType);
        });
        if (pinType === "numeric") {
            pinInput.maxLength = 6;
            pinInput.placeholder = "••••";
            pinInput.inputMode = "numeric";
            pinHint.textContent = "4-6 digits";
        } else {
            pinInput.maxLength = 20;
            pinInput.placeholder = "••••••••";
            pinInput.inputMode = "text";
            pinHint.textContent = "4-20 characters (letters + numbers)";
        }
        pinInput.value = "";
        pinError.innerHTML = "&nbsp;";
    }

    // PIN type toggle
    pinTypeToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".pin-type-btn");
        if (!btn || !isSetupMode) return;
        pinType = btn.dataset.type;
        updatePinTypeUI();
    });

    // PIN submit
    pinSubmitBtn.addEventListener("click", async () => {
        const val = pinInput.value;
        const validationError = validatePinFormat(val);

        if (validationError) {
            pinError.textContent = validationError;
            pinInput.classList.add("error");
            setTimeout(() => pinInput.classList.remove("error"), 800);
            return;
        }

        const hash = await hashPin(val);

        if (isSetupMode) {
            // Save new PIN
            chrome.storage.local.set({
                adminPinHash: hash,
                adminPinType: pinType
            }, () => {
                pinOverlay.classList.add("hidden");
                showToast("Admin PIN set successfully");
                loadData();
            });
        } else {
            // Verify PIN
            chrome.storage.local.get(["adminPinHash"], async (data) => {
                if (data.adminPinHash === hash) {
                    pinOverlay.classList.add("hidden");
                    loadData();
                } else {
                    pinError.textContent = "Incorrect PIN. Please try again.";
                    pinInput.classList.add("error");
                    pinInput.value = "";
                    setTimeout(() => pinInput.classList.remove("error"), 800);
                }
            });
        }
    });

    // Enter key on PIN input
    pinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") pinSubmitBtn.click();
    });

    // Lock button
    lockBtn.addEventListener("click", () => {
        pinOverlay.classList.remove("hidden");
        isSetupMode = false;
        pinTitle.textContent = "Admin Panel Locked";
        pinSubtitle.textContent = "Enter your PIN to access the admin panel";
        pinSubmitBtn.textContent = "Unlock";
        pinTypeToggle.style.display = "none";
        pinInput.value = "";
        pinError.innerHTML = "&nbsp;";
        chrome.storage.local.get(["adminPinType"], (data) => {
            pinType = data.adminPinType || "numeric";
            pinHint.textContent = pinType === "numeric" ? "Enter your numeric PIN" : "Enter your alphanumeric passcode";
            pinInput.maxLength = pinType === "numeric" ? 6 : 20;
            pinInput.placeholder = pinType === "numeric" ? "••••" : "••••••••";
            pinInput.focus();
        });
    });

    // Change PIN button (in settings)
    changePinBtn.addEventListener("click", () => {
        isSetupMode = true;
        pinTitle.textContent = "Change Admin PIN";
        pinSubtitle.textContent = "Set a new PIN for the admin panel";
        pinSubmitBtn.textContent = "Set New PIN";
        pinTypeToggle.style.display = "flex";
        pinInput.value = "";
        pinError.innerHTML = "&nbsp;";
        chrome.storage.local.get(["adminPinType"], (data) => {
            pinType = data.adminPinType || "numeric";
            updatePinTypeUI();
            pinOverlay.classList.remove("hidden");
            pinInput.focus();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════

    function loadData() {
        chrome.storage.local.get(
            ["managedSnippets", "userSnippets", "teamSettings", "adminPinType", "schemaVersion", "snippets"],
            (data) => {
                if (data.schemaVersion >= 2) {
                    managedSnippets = data.managedSnippets || {};
                    userSnippets = data.userSnippets || {};
                } else {
                    // v1 fallback — snippets key is the single flat store
                    managedSnippets = data.snippets || {};
                    userSnippets = {};
                }

                // Load settings
                const settings = data.teamSettings || {};
                settingAcMinChars.value = settings.autocompleteMinChars || 2;
                if (settings.showFeedbackFlash === false) {
                    settingFeedbackFlash.classList.remove("on");
                } else {
                    settingFeedbackFlash.classList.add("on");
                }

                // PIN type display
                currentPinType.textContent = (data.adminPinType || "numeric") === "numeric"
                    ? "Numeric PIN" : "Alphanumeric Passcode";

                renderSnippets();
                updateHeaderCount();
            }
        );
    }

    function saveManagedSnippets(callback) {
        chrome.storage.local.set({ managedSnippets }, () => {
            updateHeaderCount();
            if (callback) callback();
        });
    }

    function updateHeaderCount() {
        const count = Object.keys(managedSnippets).length;
        snippetCountHeader.textContent = `${count} managed snippet${count !== 1 ? "s" : ""}`;
    }

    // ═══════════════════════════════════════════════════════════
    // NAV TABS
    // ═══════════════════════════════════════════════════════════

    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const target = tab.dataset.section;
            document.querySelectorAll(".section").forEach(s => s.classList.remove("visible"));
            document.getElementById("sec-" + target).classList.add("visible");

            // Trigger data refresh for analytics
            if (target === "analytics") renderAnalytics();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // MANAGED SNIPPETS TABLE
    // ═══════════════════════════════════════════════════════════

    function renderSnippets() {
        snippetTableBody.innerHTML = "";
        const entries = Object.entries(managedSnippets)
            .filter(([code, expansion]) => {
                // Category filter
                if (activeFilter !== "all" && EchoKeyShared.getCategory(code).toLowerCase() !== activeFilter) return false;
                // Search filter
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    if (!code.toLowerCase().includes(q) && !expansion.toLowerCase().includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) => a[0].localeCompare(b[0]));

        if (entries.length === 0) {
            snippetTableBody.innerHTML = `<tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          No snippets match your filters
        </div>
      </td></tr>`;
            return;
        }

        for (const [code, expansion] of entries) {
            const cat = EchoKeyShared.getCategory(code);
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td><span class="${getCatBadgeClass(cat)}">${getCatLabel(cat)}</span></td>
        <td class="code-cell">${EchoKeyShared.escHtml(code)}</td>
        <td>${EchoKeyShared.escHtml(expansion)}</td>
        <td class="actions-cell">
          <button class="tbl-btn tbl-btn-edit" data-code="${EchoKeyShared.escHtml(code)}" title="Edit">✏️</button>
          <button class="tbl-btn tbl-btn-delete" data-code="${EchoKeyShared.escHtml(code)}" title="Delete">🗑️</button>
        </td>
      `;
            snippetTableBody.appendChild(tr);
        }
    }

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.dataset.cat;
            renderSnippets();
        });
    });

    // Search
    adminSearch.addEventListener("input", () => {
        searchQuery = adminSearch.value.trim();
        renderSnippets();
    });

    // Table action clicks (edit/delete)
    snippetTableBody.addEventListener("click", (e) => {
        const btn = e.target.closest(".tbl-btn");
        if (!btn) return;
        const code = btn.dataset.code;

        if (btn.classList.contains("tbl-btn-edit")) {
            openEditModal(code);
        } else if (btn.classList.contains("tbl-btn-delete")) {
            if (confirm(`Delete managed snippet "${code}"?\n\nThis will remove it for all team members on next reset.`)) {
                delete managedSnippets[code];
                saveManagedSnippets(() => {
                    renderSnippets();
                    showToast(`Deleted ${code}`);
                });
            }
        }
    });

    // Add snippet button
    addSnippetBtn.addEventListener("click", () => openEditModal(null));

    // ═══════════════════════════════════════════════════════════
    // EDIT / ADD MODAL
    // ═══════════════════════════════════════════════════════════

    function openEditModal(code) {
        editingCode = code;
        if (code) {
            modalTitle.textContent = "Edit Managed Snippet";
            modalCode.value = code;
            modalCode.disabled = true;
            modalExpansion.value = managedSnippets[code] || "";
        } else {
            modalTitle.textContent = "Add Managed Snippet";
            modalCode.value = ";";
            modalCode.disabled = false;
            modalExpansion.value = "";
        }
        modalError.innerHTML = "&nbsp;";
        editModal.classList.add("visible");
        if (code) {
            modalExpansion.focus();
        } else {
            modalCode.focus();
        }
    }

    modalCancelBtn.addEventListener("click", () => {
        editModal.classList.remove("visible");
        editingCode = null;
    });

    editModal.addEventListener("click", (e) => {
        if (e.target === editModal) {
            editModal.classList.remove("visible");
            editingCode = null;
        }
    });

    modalSaveBtn.addEventListener("click", () => {
        const code = modalCode.value.trim().toLowerCase();
        const expansion = modalExpansion.value.trim();

        if (!code.startsWith(";") || code.length < 3) {
            modalError.textContent = "Shortcode must start with ';' and be at least 3 characters.";
            return;
        }
        if (/\s/.test(code)) {
            modalError.textContent = "Shortcode cannot contain spaces.";
            return;
        }
        if (!expansion) {
            modalError.textContent = "Expansion text cannot be empty.";
            return;
        }
        if (!editingCode && managedSnippets[code]) {
            modalError.textContent = `Shortcode "${code}" already exists in managed snippets.`;
            return;
        }

        if (editingCode) {
            managedSnippets[editingCode] = expansion;
        } else {
            managedSnippets[code] = expansion;
        }

        saveManagedSnippets(() => {
            editModal.classList.remove("visible");
            renderSnippets();
            showToast(editingCode ? `Updated ${editingCode}` : `Added ${code}`);
            editingCode = null;
        });
    });

    // ═══════════════════════════════════════════════════════════
    // SNIPPET BUILDER WIZARD
    // ═══════════════════════════════════════════════════════════

    const WIZARD_DATA = {
        fields: {
            "4b": [
                { value: "pc", label: "Postal Code" },
                { value: "st", label: "State" },
                { value: "ad", label: "Address" },
                { value: "ct", label: "City" },
                { value: "cy", label: "Country" },
                { value: "pr", label: "Province" },
                { value: "in", label: "Institution Name" }
            ],
            "5": [
                { value: "bic", label: "BIC" },
                { value: "fw", label: "FW ABA#" },
                { value: "pc", label: "Postal Code" },
                { value: "rn", label: "Routing Number" }
            ],
            "7": [
                { value: "opc", label: "Postal Code" },
                { value: "oad", label: "Address" },
                { value: "ost", label: "State" },
                { value: "opr", label: "Province" },
                { value: "oct", label: "City" },
                { value: "obic", label: "BIC" }
            ],
            "8b": [
                { value: "vos", label: "Enterprise VOSTRO Procedure" },
                { value: "wmf", label: "Waterhouse & Managed Fund" },
                { value: "btv", label: "BTV Code & BV#" }
            ],
            "9": [
                { value: "pr", label: "Province" },
                { value: "st", label: "State" },
                { value: "ct", label: "City" },
                { value: "cy", label: "Country" }
            ]
        },
        sources: {
            standard: [
                { value: "mt", label: "MT103" },
                { value: "go", label: "Google" },
                { value: "ho", label: "HOST" },
                { value: "sr", label: "SwiftRef" },
                { value: "ds", label: "DSS" },
                { value: "pac", label: "pacs008" }
            ],
            reasons: [
                { value: "id", label: "Incomplete Data" },
                { value: "du", label: "Data Unavailable" },
                { value: "na", label: "Not Applicable" }
            ]
        },
        expansionTemplates: {
            "4b": (field, source) => `4B: Updated ${field} using ${source}`,
            "5": (field, source) => `5: Updated ${field} using ${source}`,
            "7": (field, reason) => `7: Omitted ${field} due to ${reason}`,
            "8b": (field) => {
                const map = {
                    "Enterprise VOSTRO Procedure": "8B: Followed Enterprise VOSTRO procedure",
                    "Waterhouse & Managed Fund": "8B: Waterhouse & Managed Fund accounts",
                    "BTV Code & BV#": "8B: Updated BTV code & BV#"
                };
                return map[field] || `8B: ${field}`;
            },
            "9": (field, source) => `9: Updated ${field} using ${source}`
        }
    };

    wizRemed.addEventListener("change", () => {
        const remed = wizRemed.value;
        wizField.innerHTML = "";
        wizSource.innerHTML = "";
        wizSource.disabled = true;
        wizAddBtn.disabled = true;

        if (!remed) {
            wizField.disabled = true;
            wizField.innerHTML = '<option value="">Select remediation code first...</option>';
            wizSource.innerHTML = '<option value="">Select field first...</option>';
            updateWizardPreview();
            return;
        }

        wizField.disabled = false;
        const fields = WIZARD_DATA.fields[remed] || [];

        // Update Step 2 label
        if (remed === "7") {
            wizStep2Label.textContent = "Omitted Field";
        } else if (remed === "8b") {
            wizStep2Label.textContent = "Procedure";
        } else {
            wizStep2Label.textContent = "Field";
        }

        // Update Step 3 label
        if (remed === "7") {
            wizStep3Label.textContent = "Reason";
        } else if (remed === "8b") {
            wizStep3Label.textContent = "Source (N/A)";
        } else {
            wizStep3Label.textContent = "Source";
        }

        wizField.innerHTML = '<option value="">Select...</option>';
        for (const f of fields) {
            wizField.innerHTML += `<option value="${f.value}" data-label="${EchoKeyShared.escHtml(f.label)}">${f.label}</option>`;
        }

        // 8B codes don't need source
        if (remed === "8b") {
            wizSource.innerHTML = '<option value="none">N/A (auto-generated)</option>';
            wizSource.disabled = true;
        } else {
            wizSource.innerHTML = '<option value="">Select field first...</option>';
        }

        updateWizardPreview();
    });

    wizField.addEventListener("change", () => {
        const remed = wizRemed.value;

        if (remed === "8b") {
            // 8B auto-completes — no source needed
            updateWizardPreview();
            return;
        }

        wizSource.innerHTML = "";
        wizSource.disabled = false;

        const sources = remed === "7"
            ? WIZARD_DATA.sources.reasons
            : WIZARD_DATA.sources.standard;

        wizSource.innerHTML = '<option value="">Select...</option>';
        for (const s of sources) {
            wizSource.innerHTML += `<option value="${s.value}" data-label="${EchoKeyShared.escHtml(s.label)}">${s.label}</option>`;
        }

        updateWizardPreview();
    });

    wizSource.addEventListener("change", updateWizardPreview);

    function updateWizardPreview() {
        const remed = wizRemed.value;
        const fieldVal = wizField.value;
        const sourceVal = wizSource.value;

        const fieldOpt = wizField.selectedOptions[0];
        const sourceOpt = wizSource.selectedOptions[0];
        const fieldLabel = fieldOpt ? fieldOpt.dataset.label || fieldOpt.textContent : "";
        const sourceLabel = sourceOpt ? sourceOpt.dataset.label || sourceOpt.textContent : "";

        if (!remed || !fieldVal || (remed !== "8b" && !sourceVal)) {
            wizPreview.innerHTML = '<span class="wizard-preview-empty">Select all options above to preview the generated snippet</span>';
            wizAddBtn.disabled = true;
            wizStatus.textContent = "";
            return;
        }

        // Generate shortcode
        const shortcode = remed === "8b"
            ? `;${remed}${fieldVal}`
            : `;${remed}${fieldVal}${sourceVal}`;

        // Generate expansion
        const template = WIZARD_DATA.expansionTemplates[remed];
        let expansion = "";
        if (remed === "8b") {
            expansion = template(fieldLabel);
        } else if (remed === "7") {
            // Field label for 7 is the omitted thing
            const cleanField = fieldLabel;
            const reasonLabel = sourceLabel.toLowerCase();
            expansion = template(cleanField, reasonLabel);
        } else {
            expansion = template(fieldLabel, sourceLabel);
        }

        wizPreview.innerHTML = `
      <span class="wizard-preview-label">Shortcode</span>
      <span class="wizard-preview-code">${EchoKeyShared.escHtml(shortcode)}</span>
      <span class="wizard-preview-label" style="margin-left:16px">Expansion</span>
      <span class="wizard-preview-expansion">${EchoKeyShared.escHtml(expansion)}</span>
    `;

        // Check for duplicate
        if (managedSnippets[shortcode]) {
            wizStatus.className = "wizard-status warning";
            wizStatus.textContent = `⚠️ "${shortcode}" already exists — adding will overwrite it`;
            wizAddBtn.disabled = false;
        } else if (userSnippets[shortcode]) {
            wizStatus.className = "wizard-status warning";
            wizStatus.textContent = `⚠️ "${shortcode}" exists as a user snippet — managed will override`;
            wizAddBtn.disabled = false;
        } else {
            wizStatus.className = "wizard-status";
            wizStatus.textContent = "";
            wizAddBtn.disabled = false;
        }
    }

    wizAddBtn.addEventListener("click", () => {
        const remed = wizRemed.value;
        const fieldVal = wizField.value;
        const sourceVal = wizSource.value;
        const fieldOpt = wizField.selectedOptions[0];
        const sourceOpt = wizSource.selectedOptions[0];
        const fieldLabel = fieldOpt ? fieldOpt.dataset.label || fieldOpt.textContent : "";
        const sourceLabel = sourceOpt ? sourceOpt.dataset.label || sourceOpt.textContent : "";

        if (!remed || !fieldVal) return;

        const shortcode = remed === "8b"
            ? `;${remed}${fieldVal}`
            : `;${remed}${fieldVal}${sourceVal}`;

        const template = WIZARD_DATA.expansionTemplates[remed];
        let expansion = "";
        if (remed === "8b") {
            expansion = template(fieldLabel);
        } else if (remed === "7") {
            expansion = template(fieldLabel, sourceLabel.toLowerCase());
        } else {
            expansion = template(fieldLabel, sourceLabel);
        }

        managedSnippets[shortcode] = expansion;
        saveManagedSnippets(() => {
            wizStatus.className = "wizard-status success";
            wizStatus.textContent = `✅ Added ${shortcode} to managed snippets`;
            showToast(`Added ${shortcode}`);
            renderSnippets();
        });
    });

    wizResetBtn.addEventListener("click", () => {
        wizRemed.value = "";
        wizField.innerHTML = '<option value="">Select remediation code first...</option>';
        wizField.disabled = true;
        wizSource.innerHTML = '<option value="">Select field first...</option>';
        wizSource.disabled = true;
        wizStep2Label.textContent = "Field";
        wizStep3Label.textContent = "Source";
        wizPreview.innerHTML = '<span class="wizard-preview-empty">Select all options above to preview the generated snippet</span>';
        wizAddBtn.disabled = true;
        wizStatus.textContent = "";
    });

    // ═══════════════════════════════════════════════════════════
    // ANALYTICS
    // ═══════════════════════════════════════════════════════════

    function renderAnalytics() {
        chrome.storage.local.get(["stats", "dailyStats", "managedSnippets", "userSnippets"], (data) => {
            const stats = data.stats || { expansions: 0, lastUsed: null, perSnippet: {} };
            const perSnippet = stats.perSnippet || {};
            const allSnippets = Object.assign({}, data.managedSnippets || {}, data.userSnippets || {});
            const allCodes = Object.keys(allSnippets);

            // Summary cards
            anTotalExp.textContent = (stats.expansions || 0).toLocaleString();

            const daily = data.dailyStats || { date: "", count: 0 };
            const today = new Date().toISOString().slice(0, 10);
            anTodayCount.textContent = (daily.date === today ? daily.count : 0).toLocaleString();

            const activeCodes = allCodes.filter(c => perSnippet[c] && perSnippet[c].count > 0);
            anActiveCount.textContent = activeCodes.length;

            const unusedCodes = allCodes.filter(c => !perSnippet[c] || perSnippet[c].count === 0);
            anUnusedCount.textContent = unusedCodes.length;

            // Top 10 / Bottom 10
            const entries = Object.entries(perSnippet)
                .map(([code, info]) => ({ code, count: info.count || 0 }))
                .filter(e => e.count > 0)
                .sort((a, b) => b.count - a.count);

            renderChartBars(anTop10, entries.slice(0, 10), "top");

            const bottom = entries.slice(-10).sort((a, b) => a.count - b.count);
            renderChartBars(anBottom10, bottom, "bottom");

            // Category distribution
            const catCounts = {};
            for (const [code, info] of Object.entries(perSnippet)) {
                if (info.count > 0) {
                    const cat = EchoKeyShared.getCategory(code);
                    catCounts[cat] = (catCounts[cat] || 0) + info.count;
                }
            }
            const catEntries = Object.entries(catCounts)
                .map(([cat, count]) => ({ code: getCatLabel(cat), count, cat }))
                .sort((a, b) => b.count - a.count);
            renderCategoryBars(anByCategory, catEntries);
        });
    }

    function renderChartBars(container, items, type) {
        container.innerHTML = "";
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:16px">No usage data yet</div>';
            return;
        }
        const maxCount = Math.max(...items.map(i => i.count), 1);
        for (const item of items) {
            const pct = Math.round((item.count / maxCount) * 100);
            const row = document.createElement("div");
            row.className = "chart-row";
            row.innerHTML = `
        <span class="chart-label">${EchoKeyShared.escHtml(item.code)}</span>
        <div class="chart-track">
          <div class="chart-fill ${type}" style="width:${pct}%"></div>
        </div>
        <span class="chart-count">${item.count}</span>
      `;
            container.appendChild(row);
        }
    }

    function renderCategoryBars(container, items) {
        container.innerHTML = "";
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:16px">No usage data yet</div>';
            return;
        }
        const maxCount = Math.max(...items.map(i => i.count), 1);
        for (const item of items) {
            const pct = Math.round((item.count / maxCount) * 100);
            const row = document.createElement("div");
            row.className = "chart-row";
            row.innerHTML = `
        <span class="chart-label">${EchoKeyShared.escHtml(item.code)}</span>
        <div class="chart-track">
          <div class="${getCatFillClass(item.cat)}" style="width:${pct}%;height:100%;border-radius:4px;transition:width 0.5s ease"></div>
        </div>
        <span class="chart-count">${item.count}</span>
      `;
            container.appendChild(row);
        }
    }

    anExportStatsBtn.addEventListener("click", () => {
        chrome.storage.local.get(["stats", "dailyStats"], (data) => {
            const exportData = {
                meta: {
                    exportedAt: new Date().toISOString(),
                    source: "EchoKey Admin Panel",
                    type: "stats"
                },
                stats: data.stats || {},
                dailyStats: data.dailyStats || {}
            };
            EchoKeyShared.downloadJSON(exportData, `echokey-stats-${new Date().toISOString().slice(0, 10)}.json`);
            showToast("Stats exported");
        });
    });

    anResetStatsBtn.addEventListener("click", () => {
        if (confirm("Reset ALL usage statistics? This cannot be undone.")) {
            chrome.storage.local.set({
                stats: { expansions: 0, lastUsed: null, perSnippet: {} },
                dailyStats: { date: new Date().toISOString().slice(0, 10), count: 0 }
            }, () => {
                renderAnalytics();
                showToast("All stats reset");
            });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // DISTRIBUTION (SNIPPET PACK EXPORT / IMPORT)
    // ═══════════════════════════════════════════════════════════

    distExportBtn.addEventListener("click", () => {
        const pack = {
            meta: {
                exportedAt: new Date().toISOString(),
                snippetCount: Object.keys(managedSnippets).length,
                source: "EchoKey Admin Panel"
            },
            managedSnippets: { ...managedSnippets }
        };
        EchoKeyShared.downloadJSON(pack, `echokey-snippet-pack-${new Date().toISOString().slice(0, 10)}.json`);
        showToast("Snippet pack exported");
    });

    distImportBtn.addEventListener("click", () => importPackFile.click());

    importPackFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                let snippetsToMerge = {};

                // Handle pack format (with meta + managedSnippets)
                if (imported.meta && imported.managedSnippets) {
                    snippetsToMerge = imported.managedSnippets;
                }
                // Handle flat format (legacy)
                else if (typeof imported === "object" && !Array.isArray(imported)) {
                    snippetsToMerge = imported;
                } else {
                    throw new Error("Unrecognized format");
                }

                let added = 0;
                let updated = 0;
                for (const [code, expansion] of Object.entries(snippetsToMerge)) {
                    if (typeof code === "string" && typeof expansion === "string" && code.startsWith(";")) {
                        const codeLower = code.toLowerCase();
                        if (managedSnippets[codeLower]) {
                            updated++;
                        } else {
                            added++;
                        }
                        managedSnippets[codeLower] = expansion;
                    }
                }

                saveManagedSnippets(() => {
                    renderSnippets();
                    showToast(`Imported: ${added} new, ${updated} updated`);
                });
            } catch (err) {
                showToast("Invalid JSON file", "error");
                console.error("[EchoKey Admin] Import error:", err);
            }
        };
        reader.readAsText(file);
        importPackFile.value = "";
    });

    // ═══════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════

    settingFeedbackFlash.addEventListener("click", () => {
        settingFeedbackFlash.classList.toggle("on");
    });

    saveSettingsBtn.addEventListener("click", () => {
        const minChars = parseInt(settingAcMinChars.value, 10);
        if (isNaN(minChars) || minChars < 1 || minChars > 5) {
            showToast("Min characters must be between 1 and 5", "error");
            return;
        }

        const teamSettings = {
            autocompleteMinChars: minChars,
            showFeedbackFlash: settingFeedbackFlash.classList.contains("on")
        };

        chrome.storage.local.set({ teamSettings }, () => {
            showToast("Settings saved");
        });
    });

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════

    initPinGate();
})();
