/**
 * EchoKey — Background Service Worker
 * ==================================================
 * Handles extension lifecycle: install, update, and initializing
 * default snippets into chrome.storage.local.
 */

// ── Default snippets (loaded on first install) ──
const DEFAULT_SNIPPETS = {
  // 4B: Beneficiary Information
  ";4bpcmt": "4B: Updated Postal Code using MT103",
  ";4bpcgo": "4B: Updated Postal Code using Google",
  ";4bstmt": "4B: Updated State using MT103",
  ";4bstgo": "4B: Updated State using Google",

  // 5: BIC / FW
  ";5fwds": "5: Updated FW ABA# using DSS",
  ";5bicsr": "5: Updated BIC using SwiftRef",
  ";5bicnr": "5: Unable to locate BIC. Reassigned",

  // 7: Data Updates
  ";7pcgo": "7: Updated Postal Code using Google",

  // 8B: Vostro
  ";8btpv": "8B: Enterprise Vostro Procedure Followed",
  ";8bntpv": "8B: Non-Enterprise Vostro Procedure Followed"
};

// ── On Install: seed default snippets ──
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Fresh install: seed managed snippets, empty user snippets
    chrome.storage.local.set({
      managedSnippets: { ...DEFAULT_SNIPPETS },
      userSnippets: {},
      enabled: true,
      schemaVersion: 2,
      stats: { expansions: 0, lastUsed: null, perSnippet: {} },
      dailyStats: { date: new Date().toISOString().slice(0, 10), count: 0 },
      teamSettings: { autocompleteMinChars: 2, showFeedbackFlash: true }
      // adminPinHash/adminPinType intentionally omitted — created on first admin access
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("[EchoKey Background] Storage write failed:", chrome.runtime.lastError.message);
        return;
      }
      console.log(
        `[EchoKey] Installed with ${Object.keys(DEFAULT_SNIPPETS).length} managed snippets.`
      );
    });
  }

  if (details.reason === "update") {
    // Transition to Test Mode: Clear and Seed New Defaults
    chrome.storage.local.set({
      managedSnippets: { ...DEFAULT_SNIPPETS },
      userSnippets: {},
      schemaVersion: 2
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("[EchoKey Background] Storage write failed:", chrome.runtime.lastError.message);
        return;
      }
      console.log(`[EchoKey] Updated: Seeded ${Object.keys(DEFAULT_SNIPPETS).length} test mode snippets.`);
    });
  }
});

// ── Reset defaults handler (triggered from popup) ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "resetDefaults") {
    // Reset managed snippets to factory defaults; preserve user snippets and enabled state
    chrome.storage.local.get(["enabled"], (data) => {
      chrome.storage.local.set({
        managedSnippets: { ...DEFAULT_SNIPPETS },
        enabled: data.enabled !== false  // Preserve current state, default true if missing
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("[EchoKey Background] Storage write failed:", chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ ok: true });
      });
    });
    return true; // async response
  }
});
