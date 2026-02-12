/**
 * EchoKey — Shared Utilities Module
 * ===============================================
 * Common utility functions shared across popup.js, admin.js, and content.js.
 * This module is loaded via <script> tag before the main scripts.
 *
 *
 * SECURITY: All functions are pure, side-effect-free utilities. No storage access, no network calls.
 */

const EchoKeyShared = (function () {
    "use strict";

    /**
     * Escape HTML special characters for safe innerHTML insertion.
     * @param {string} s - The string to escape.
     * @returns {string} - HTML-escaped string.
     */
    function escHtml(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    /**
     * Escape HTML attribute special characters.
     * @param {string} s - The string to escape.
     * @returns {string} - Attribute-escaped string.
     */
    function escAttr(s) {
        return s.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    /**
     * Extract category from shortcode.
     * @param {string} code - The shortcode (e.g., ";4bpcmt", ";5bicsr").
     * @returns {string} - Category identifier ("4B", "5", "7", "8B", "9", "Other").
     */
    function getCategory(code) {
        const body = code.replace(/^;/, "");
        if (body.startsWith("8b")) return "8B";
        if (body.startsWith("4b")) return "4B";
        if (body.startsWith("5")) return "5";
        if (body.startsWith("7")) return "7";
        if (body.startsWith("9")) return "9";
        return "Other";
    }

    /**
     * Download data as a JSON file.
     * @param {Object} data - The data object to export.
     * @param {string} filename - The filename for the download.
     */
    function downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Public API
    return { escHtml, escAttr, getCategory, downloadJSON };
})();
