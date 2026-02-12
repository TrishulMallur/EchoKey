# Changelog

All notable changes to this project will be documented in this file.

## 2026-02-12
### Added
- **Licensing:** Added MIT License and open source preparation.

## 2026-02-11
### Added
- **Infrastructure:** Created `shared.js` utilities module, `STORAGE_SCHEMA.md` documentation.
### Changed
- **Refactoring:** Eliminated 6 duplicate functions across popup.js and admin.js.
### Fixed
- **Critical Fixes:** Stats race condition, un-deletable overrides, React compatibility, MV3 error handling.
- **Low-Severity Fixes:** 12 edge cases (textarea positioning, email inputs, Shadow DOM detachment, etc.).

## 2026-02-10
### Removed
- `snippets.js` dead file.
- `clipboardWrite` unused permission.
### Fixed
- Autocomplete positioning bug, toast unreachable code, search bar layout.

## 2026-02-09
### Added
- Implemented stats dashboard with CSS bar charts.
- Added Shadow DOM autocomplete overlay.
- Created admin panel with PIN gate, analytics, wizard.
### Changed
- Migrated storage schema (managed/user tier split).

## 2026-02-08
### Added
- Core expansion engine.
- Basic popup UI with CRUD operations.
- Import/export JSON.
