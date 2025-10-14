<!-- 97305403-e30a-4f63-98db-16eac567054d 272390a3-61d8-40a2-9292-faa6539e14a2 -->
# Separate Prime Sets from PrimeParts Component

## Goal

Clean up component responsibilities by removing prime sets display from `PrimeParts.tsx` and ensuring the missing parts market price functionality works correctly in `PrimeSetsSection.tsx`.

## Changes Required

### 1. Update HomePage.tsx - Remove Prime Sets from Prime Parts Filter

**File**: `src/pages/HomePage.tsx`

**Current Issue**: Lines 140-166 include logic to generate prime_sets items and add them to `displayedPrimeParts` when `primePartsFilter === 'sets'`.

**Action**: Remove the `'sets'` case from the switch statement so `displayedPrimeParts` only contains actual prime parts, never prime sets.

```typescript
// Remove this entire case block (lines ~158-166):
case 'sets':
  return validParts.concat(primeSetsData.map(setProgress => ({
    id: `set-${setProgress.set.name}`,
    name: setProgress.set.name,
    category: 'prime_sets',
    quantity: 1,
    price: setProgress.individualPartsValue || 0,
    status: 'loaded' as const,
    setData: setProgress
  })));
```

### 2. Update PrimeParts.tsx - Remove All Prime Sets Logic

**File**: `src/components/PrimeParts.tsx`

**Actions**:

- Remove `setProgressData` prop from `PrimePartsProps` interface (line 39)
- Remove prime_sets image handling from `getItemImageUrl` (lines 62-65)
- Remove prime_sets from sort field logic if any (check `handleSort` and sorting logic)
- Remove prime_sets specific display logic:
  - Lines 341-389: Set Analysis Info for Prime Sets
  - Lines 445-508: Prime sets price display in grid
  - Lines 582-691: Toggle Button & Expandable Details for Prime Sets
- Simplify the price display grid to always use 3 columns (Current/Avg, Ducats, Total) since we won't have prime_sets anymore
- Remove `'prime_sets'` from any conditional checks

### 3. Verify PrimeSetsSection.tsx Has Missing Parts Pricing

**File**: `src/components/PrimeSetsSection.tsx`

**Current State**: The component already uses `refreshIndividualSetMarketData` which we recently updated to fetch missing parts prices.

**Verification Needed**:

- Confirm that the display shows missing parts investment cost (missingCost)
- Lines 880-920 should already display "Parts Value / Investment" correctly
- Ensure "—" is shown when missingCost is unavailable

### 4. Update HomePage Filter UI - Remove "Sets" Option

**File**: `src/pages/HomePage.tsx`

**Action**: Find the filter buttons for Prime Parts (likely "All", "Parts", "Sets", "Has Buyers") and remove the "Sets" button since sets are now exclusively in the Prime Sets section.

### 5. Clean Up Types (Optional)

**File**: `src/types/index.ts`

**Consideration**: Review if `PrimeSetItem` interface is still needed or if it's only used in inventory storage. If it's only for inventory, keep it. If it was primarily for PrimeParts display, we may be able to simplify.

## Expected Outcome

After these changes:

- `PrimeParts` component only displays individual prime parts
- Prime sets are exclusively shown in `PrimeSetsSection`
- No duplicate display of prime sets across different views
- Missing parts market prices are fetched and displayed in Prime Sets section
- Cleaner separation of concerns between components

### To-dos

- [ ] Remove 'sets' case from displayedPrimeParts filter logic in HomePage.tsx
- [ ] Remove all prime_sets display logic from PrimeParts.tsx component
- [ ] Remove 'Sets' filter button from Prime Parts UI in HomePage.tsx
- [ ] Verify PrimeSetsSection displays missing parts investment correctly
- [ ] Test that prime parts and prime sets display correctly in their respective sections