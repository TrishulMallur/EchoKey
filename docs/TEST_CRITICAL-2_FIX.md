# Test Plan: CRITICAL-2 Fix - User Override of Managed Snippet Is Un-Deletable

## Issue Description
When a user creates a snippet with the same shortcode as a managed snippet (an intentional override), the UI was hiding edit/delete buttons because `isManaged()` returned true.

## Fix Applied
Modified `popup.js` lines 67-69 and 130-148 to:
1. Update `isManaged()` to return `false` for overrides: `return code in managedSnippets && !(code in userSnippets);`
2. Add override detection in render: `const isOverride = (code in managedSnippets) && (code in userSnippets);`
3. Show distinct icon (🔄) for overrides with tooltip "User override of managed snippet"
4. Keep edit/delete buttons visible for overrides

## Test Scenarios

### Test 1: Create User Override
**Steps:**
1. Open popup
2. Note a managed snippet, e.g., `;4bpcmt` with icon 🔒
3. Click "+ Add New" tab
4. Enter `;4bpcmt` as shortcode
5. Enter custom expansion: "4B: My custom postal code comment"
6. Click "Save Snippet"

**Expected Result:**
- Snippet is saved successfully
- Icon changes from 🔒 to 🔄
- Tooltip shows "User override of managed snippet"
- Edit and Delete buttons are VISIBLE and ENABLED
- Bulk checkbox is ENABLED (not disabled)

### Test 2: Edit User Override
**Steps:**
1. After Test 1, click the Edit button (✏️) on the override
2. Modify expansion to: "4B: Updated override comment"
3. Click "Update"

**Expected Result:**
- Edit panel opens successfully
- Shortcode field is disabled (normal edit behavior)
- Expansion can be modified
- Changes save successfully
- Override persists with 🔄 icon

### Test 3: Delete User Override
**Steps:**
1. After Test 2, click the Delete button (🗑️) on the override
2. Confirm deletion

**Expected Result:**
- Confirmation dialog appears
- After confirming, override is deleted from `userSnippets`
- Managed snippet with same code reappears
- Icon reverts to 🔒 (managed)
- Edit/Delete buttons are HIDDEN
- Expansion shows original managed text

### Test 4: Bulk Operations with Override
**Steps:**
1. Create override (Test 1)
2. Enable bulk mode
3. Select the override checkbox
4. Click "Export Selected"

**Expected Result:**
- Override checkbox is ENABLED (not disabled like managed snippets)
- Checkbox can be selected
- Bulk export includes the user override expansion
- Bulk delete removes the override (restores managed)

### Test 5: Export with Override
**Steps:**
1. Create override (Test 1)
2. Click Export button
3. Uncheck "Include managed snippets"
4. Export

**Expected Result:**
- Export includes the override in custom tier
- JSON contains: `{";4bpcmt": "4B: My custom postal code comment"}`

**Steps (continued):**
5. Check "Include managed snippets"
6. Export again

**Expected Result:**
- Export includes override, NOT the original managed snippet
- User override takes priority (per `mergeSnippets()` logic)

### Test 6: Reset Defaults with Override
**Steps:**
1. Create override (Test 1)
2. Click "Reset Defaults" button
3. Confirm reset

**Expected Result:**
- Managed snippets reset to factory defaults
- User override PERSISTS (still in `userSnippets`)
- Override still shows 🔄 icon
- Edit/Delete still available

### Test 7: Pure Managed Snippet (No Override)
**Steps:**
1. Ensure no override exists for `;5bicsr`
2. View the snippet in list

**Expected Result:**
- Icon shows 🔒 with tooltip "Managed snippet"
- Edit/Delete buttons are HIDDEN
- Bulk checkbox is DISABLED
- Row has "managed" class styling

### Test 8: Pure Custom Snippet (Not in Managed)
**Steps:**
1. Create a custom snippet: `;mycustom` → "My custom comment"

**Expected Result:**
- Icon shows ✏️ with tooltip "Custom snippet"
- Edit/Delete buttons are VISIBLE
- Bulk checkbox is ENABLED
- No "managed" class on row

## Code Flow Verification

### isManaged() Logic
```javascript
// Before fix:
return code in managedSnippets; // ❌ Returns true for overrides

// After fix:
return code in managedSnippets && !(code in userSnippets); // ✅ Returns false for overrides
```

### Render Logic
```javascript
const managed = isManaged(code); // false for overrides
const isOverride = (code in managedSnippets) && (code in userSnippets); // true for overrides
const icon = isOverride ? "🔄" : (managed ? "🔒" : "✏️");
```

### Edit/Delete Handlers
```javascript
if (isManaged(code)) { // ✅ Now returns false for overrides
  showToast("Cannot edit/delete managed snippets");
  return;
}
// ✅ Proceeds to allow edit/delete for overrides
```

## Edge Cases

### EC1: Override Then Delete Then Recreate
**Steps:**
1. Create override
2. Delete override
3. Create same override again

**Expected:** Should work identically to first creation

### EC2: Managed Snippet Doesn't Exist in Factory
**Steps:**
1. User creates `;custom` → "Comment A"
2. Admin adds `;custom` to managed defaults (manually)
3. Extension updates

**Expected:** User's existing custom snippet persists as override

### EC3: Empty userSnippets
**Steps:**
1. Fresh install
2. View all snippets

**Expected:** All show as managed (🔒), no overrides

## Regression Checks
- Verify all other snippet operations still work:
  - Add pure custom snippet
  - Edit custom snippet
  - Delete custom snippet
  - Search/filter
  - Import/export
  - Toggle enable/disable
  - Stats tracking

## Success Criteria
All 8 test scenarios pass without errors
Override icon (🔄) displays correctly with tooltip
Edit/Delete buttons visible for overrides
Bulk operations work with overrides
No regression in existing functionality
