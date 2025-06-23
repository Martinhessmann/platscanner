// Purpose: Data Export/Import Service - Export and import all user data for sharing and backup
// Features: Complete inventory, build plans, and mastery status transfer

interface ExportData {
  version: string;
  exportDate: string;
  data: {
    inventory: any; // platscanner_inventory
    buildPlans: any; // platscanner_build_plans
    mastery: string[]; // platscanner_mastery
    lastScan: string; // platscanner_last_scan
  };
  metadata: {
    totalItems: number;
    totalValue: number;
    plannedSets: number;
    masteredSets: number;
  };
}

const EXPORT_VERSION = '1.0.0';

/**
 * Export all user data to JSON format
 */
export const exportUserData = (): ExportData | null => {
  try {
    // Get all localStorage data
    const inventory = localStorage.getItem('platscanner_inventory');
    const buildPlans = localStorage.getItem('platscanner_build_plans');
    const mastery = localStorage.getItem('platscanner_mastery');
    const lastScan = localStorage.getItem('platscanner_last_scan');

    // Parse the data
    const inventoryData = inventory ? JSON.parse(inventory) : null;
    const buildPlansData = buildPlans ? JSON.parse(buildPlans) : { buildPlans: [], reservedItems: [], version: 1 };
    const masteryData = mastery ? JSON.parse(mastery) : [];
    const lastScanData = lastScan || new Date().toISOString();

    // Calculate metadata
    const totalItems = inventoryData?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0;
    const totalValue = inventoryData?.items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0) || 0;
    const plannedSets = buildPlansData.buildPlans?.length || 0;
    const masteredSets = masteryData.length || 0;

    const exportData: ExportData = {
      version: EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      data: {
        inventory: inventoryData,
        buildPlans: buildPlansData,
        mastery: masteryData,
        lastScan: lastScanData
      },
      metadata: {
        totalItems,
        totalValue: Math.round(totalValue),
        plannedSets,
        masteredSets
      }
    };

    return exportData;
  } catch (error) {
    console.error('Failed to export user data:', error);
    return null;
  }
};

/**
 * Import user data from JSON format
 */
export const importUserData = (jsonData: string, options: {
  overwrite: boolean;
} = { overwrite: false }): {
  success: boolean;
  error?: string;
  imported: {
    inventory: boolean;
    buildPlans: boolean;
    mastery: boolean;
  };
} => {
  try {
    const importData: ExportData = JSON.parse(jsonData);

    // Validate import data structure
    if (!importData.version || !importData.data) {
      return {
        success: false,
        error: 'Invalid export format - missing version or data',
        imported: { inventory: false, buildPlans: false, mastery: false }
      };
    }

    const imported = { inventory: false, buildPlans: false, mastery: false };

    // Import inventory data
    if (importData.data.inventory) {
      if (options.overwrite) {
        localStorage.setItem('platscanner_inventory', JSON.stringify(importData.data.inventory));
        localStorage.setItem('platscanner_last_scan', importData.data.lastScan);
      } else {
        // Merge with existing inventory
        const existing = localStorage.getItem('platscanner_inventory');
        if (existing) {
          const existingData = JSON.parse(existing);
          const mergedItems = [...existingData.items];

          // Add imported items that don't already exist
          importData.data.inventory.items.forEach((importedItem: any) => {
            const exists = mergedItems.find(item => item.name === importedItem.name);
            if (!exists) {
              mergedItems.push(importedItem);
            }
          });

          const mergedInventory = {
            ...importData.data.inventory,
            items: mergedItems,
            lastScanDate: new Date().toISOString()
          };

          localStorage.setItem('platscanner_inventory', JSON.stringify(mergedInventory));
        } else {
          localStorage.setItem('platscanner_inventory', JSON.stringify(importData.data.inventory));
        }
      }
      imported.inventory = true;
    }

    // Import build plans
    if (importData.data.buildPlans) {
      if (options.overwrite) {
        localStorage.setItem('platscanner_build_plans', JSON.stringify(importData.data.buildPlans));
      } else {
        // Merge with existing build plans
        const existing = localStorage.getItem('platscanner_build_plans');
        if (existing) {
          const existingData = JSON.parse(existing);
          const mergedPlans = [...existingData.buildPlans];
          const mergedReservations = [...existingData.reservedItems];

          // Add imported plans that don't already exist
          importData.data.buildPlans.buildPlans.forEach((plan: any) => {
            const exists = mergedPlans.find(p => p.setName === plan.setName);
            if (!exists) {
              mergedPlans.push(plan);
            }
          });

          // Add imported reservations (avoiding duplicates)
          importData.data.buildPlans.reservedItems.forEach((reservation: any) => {
            const exists = mergedReservations.find(r =>
              r.itemName === reservation.itemName && r.category === reservation.category
            );
            if (!exists) {
              mergedReservations.push(reservation);
            } else {
              // Merge reservedFor arrays
              reservation.reservedFor.forEach((setName: string) => {
                if (!exists.reservedFor.includes(setName)) {
                  exists.reservedFor.push(setName);
                }
              });
            }
          });

          const mergedBuildPlans = {
            buildPlans: mergedPlans,
            reservedItems: mergedReservations,
            version: importData.data.buildPlans.version
          };

          localStorage.setItem('platscanner_build_plans', JSON.stringify(mergedBuildPlans));
        } else {
          localStorage.setItem('platscanner_build_plans', JSON.stringify(importData.data.buildPlans));
        }
      }
      imported.buildPlans = true;
    }

    // Import mastery data
    if (importData.data.mastery) {
      if (options.overwrite) {
        localStorage.setItem('platscanner_mastery', JSON.stringify(importData.data.mastery));
      } else {
        // Merge with existing mastery
        const existing = localStorage.getItem('platscanner_mastery');
        if (existing) {
          const existingMastery = JSON.parse(existing);
          const mergedMastery = [...new Set([...existingMastery, ...importData.data.mastery])];
          localStorage.setItem('platscanner_mastery', JSON.stringify(mergedMastery));
        } else {
          localStorage.setItem('platscanner_mastery', JSON.stringify(importData.data.mastery));
        }
      }
      imported.mastery = true;
    }

    return {
      success: true,
      imported
    };

  } catch (error) {
    console.error('Failed to import user data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      imported: { inventory: false, buildPlans: false, mastery: false }
    };
  }
};

/**
 * Download exported data as JSON file
 */
export const downloadExportFile = (exportData: ExportData, filename?: string): void => {
  try {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `platscanner-backup-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download export file:', error);
  }
};

/**
 * Validate export data structure
 */
export const validateExportData = (jsonString: string): {
  valid: boolean;
  error?: string;
  metadata?: ExportData['metadata'];
} => {
  try {
    const data: ExportData = JSON.parse(jsonString);

    if (!data.version) {
      return { valid: false, error: 'Missing version information' };
    }

    if (!data.data) {
      return { valid: false, error: 'Missing data section' };
    }

    return {
      valid: true,
      metadata: data.metadata
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid JSON format'
    };
  }
};