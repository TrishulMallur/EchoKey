# EchoKey — Storage Schema

## chrome.storage.local Keys

| Key | Type | Writer(s) | Reader(s) | Initialized on Install? |
|-----|------|-----------|-----------|------------------------|
| `managedSnippets` | Object<string, string> | background.js, admin.js | background.js, content.js, popup.js, admin.js | Yes |
| `userSnippets` | Object<string, string> | background.js, popup.js | background.js, content.js, popup.js, admin.js | Yes |
| `enabled` | boolean | background.js, popup.js | content.js, popup.js | Yes |
| `schemaVersion` | number | background.js | background.js, content.js, popup.js | Yes |
| `stats` | StatsObject | content.js, popup.js, admin.js | content.js, popup.js, admin.js | Partial |
| `dailyStats` | DailyStatsObject | content.js, popup.js, admin.js | content.js, popup.js, admin.js | No |
| `teamSettings` | TeamSettingsObject | admin.js | content.js, admin.js | No |
| `adminPinHash` | string (hex SHA-256) | admin.js | admin.js | No |
| `adminPinType` | "numeric" \| "alphanumeric" | admin.js | admin.js | No |
| `snippets` (legacy) | Object<string, string> | - | background.js, content.js, popup.js | - |

## Type Definitions

### StatsObject
```typescript
interface StatsObject {
    expansions: number;
    lastUsed: string | null;  // ISO 8601 timestamp or null
    perSnippet?: {
        [shortcode: string]: {
            count: number;
            lastUsed: string;  // ISO 8601 timestamp
        }
    }
}
```

### DailyStatsObject
```typescript
interface DailyStatsObject {
    date: string;  // ISO date "YYYY-MM-DD" (UTC)
    count: number;
}
```

### TeamSettingsObject
```typescript
interface TeamSettingsObject {
    autocompleteMinChars: number;  // 1-5, default 2
    showFeedbackFlash: boolean;    // default true
}
```

## Storage Quota

**Chrome Extension Storage Limits:**
- `chrome.storage.local`: 10MB
- Individual key size: ~8KB recommended maximum

**Typical Usage:**
- `managedSnippets`: ~3KB (55 snippets × ~50 chars)
- `userSnippets`: 0-10KB (user-dependent)
- `stats`: 2-5KB (depends on perSnippet size)
- `dailyStats`: <1KB (rolling 30 days)
- `teamSettings`: <100B
- Other keys: <1KB total

**Total:** 8-20KB / 10MB quota = 0.08-0.2% utilization

## Schema Evolution

### Initial Version (Legacy)
- Single `snippets` object containing all snippets
- No tier separation
- Minimal stats tracking

### Second Iteration
- Split `snippets` into `managedSnippets` and `userSnippets`
- Added `schemaVersion` tracking
- Enhanced stats with `perSnippet` tracking
- Migration logic in `background.js`

### Current Version
- Added `dailyStats` for day-specific tracking
- Added `teamSettings` for configurable behavior
- Added `adminPinHash` and `adminPinType` for admin panel security
- All keys documented here

## Migration Notes

When `background.js` detects a schema version change:
1. Reads existing data from old schema
2. Transforms to new schema structure
3. Writes new schema keys
4. Sets `schemaVersion` to current version
5. Preserves all user data (never deletes)

## Security & Privacy

**PII Storage:** NONE. The extension stores only:
- Comment templates (no case data)
- Shortcode strings
- Numeric usage counts
- Timestamps
- Configuration flags

**Network Access:** ZERO. All data stays local to `chrome.storage.local`.

---

**Last Updated:** 2026-02-12
**Schema Version:** 2
