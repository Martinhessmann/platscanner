// Purpose: Cloud Sync Service - Sync user data across platforms using Supabase
// Uses optional user identifier (hashed API key or generated ID) for cross-platform inventory sync

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface UserInventoryData {
  user_id: string;
  inventory_data: any;
  build_plans: any;
  mastery_data: string[];
  last_scan: string;
  last_sync: string;
  created_at?: string;
  updated_at?: string;
}

interface SyncResult {
  success: boolean;
  error?: string;
  conflictData?: {
    local: UserInventoryData;
    remote: UserInventoryData;
  };
}

interface SyncStatus {
  isEnabled: boolean;
  lastSync?: Date;
  autoSync: boolean;
  conflictResolution: 'ask' | 'local' | 'remote';
}

class CloudSyncService {
  private supabase: any;
  private isConfigured: boolean;
  private isSyncing: boolean = false;
  private pendingSyncTimeout: NodeJS.Timeout | null = null;
  private syncDebounceMs: number = 2000; // Wait 2 seconds after last modification before syncing

  constructor() {
    this.isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    if (this.isConfigured) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  /**
   * Hash the API key to create a consistent user ID
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get current user ID from stored API key or generate a persistent ID
   */
  private async getCurrentUserId(): Promise<string | null> {
    // Try to use API key if available (for backward compatibility)
    const apiKey = localStorage.getItem('platscanner_gemini_api_key');
    if (apiKey) {
      return await this.hashApiKey(apiKey);
    }
    
    // Generate a persistent user ID if no API key exists
    let userId = localStorage.getItem('platscanner_user_id');
    if (!userId) {
      // Generate a random ID and store it
      userId = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem('platscanner_user_id', userId);
    }
    return userId;
  }

  /**
   * Check if cloud sync is available and configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Get sync settings from localStorage
   */
  getSyncSettings(): SyncStatus {
    try {
      const settings = localStorage.getItem('platscanner_sync_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return {
          ...parsed,
          lastSync: parsed.lastSync ? new Date(parsed.lastSync) : undefined
        };
      }
    } catch (error) {
      console.error('Failed to load sync settings:', error);
    }

    return {
      isEnabled: false,
      autoSync: true,
      conflictResolution: 'ask'
    };
  }

  /**
   * Save sync settings to localStorage
   */
  saveSyncSettings(settings: SyncStatus): void {
    try {
      localStorage.setItem('platscanner_sync_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save sync settings:', error);
    }
  }

  /**
   * Get local modification timestamp
   */
  private getLocalModificationTime(): Date {
    try {
      const modTime = localStorage.getItem('platscanner_last_modified');
      return modTime ? new Date(modTime) : new Date(0); // Very old date if never modified
    } catch (error) {
      return new Date(0);
    }
  }

  /**
   * Update local modification timestamp
   */
  private updateLocalModificationTime(): void {
    try {
      localStorage.setItem('platscanner_last_modified', new Date().toISOString());
    } catch (error) {
      console.error('Failed to update modification time:', error);
    }
  }

  /**
   * Get local data for syncing
   */
  private getLocalData(): UserInventoryData | null {
    try {
      const inventory = localStorage.getItem('platscanner_inventory');
      const buildPlans = localStorage.getItem('platscanner_build_plans');
      const mastery = localStorage.getItem('platscanner_mastery');
      const lastScan = localStorage.getItem('platscanner_last_scan');
      const lastModified = this.getLocalModificationTime().toISOString();

      return {
        user_id: '', // Will be set by caller
        inventory_data: inventory ? JSON.parse(inventory) : null,
        build_plans: buildPlans ? JSON.parse(buildPlans) : { buildPlans: [], reservedItems: [], version: 1 },
        mastery_data: mastery ? JSON.parse(mastery) : [],
        last_scan: lastScan || new Date().toISOString(),
        last_sync: lastModified // Use actual modification time instead of current time
      };
    } catch (error) {
      console.error('Failed to get local data:', error);
      return null;
    }
  }

  /**
   * Save remote data to local storage
   * Note: This method is called during sync operations when isSyncing=true,
   * which prevents onLocalDataModified from being triggered, avoiding infinite loops
   */
  private saveLocalData(data: UserInventoryData): void {
    try {
      if (data.inventory_data) {
        localStorage.setItem('platscanner_inventory', JSON.stringify(data.inventory_data));
      }
      if (data.build_plans) {
        localStorage.setItem('platscanner_build_plans', JSON.stringify(data.build_plans));
      }
      if (data.mastery_data) {
        localStorage.setItem('platscanner_mastery', JSON.stringify(data.mastery_data));
      }
      if (data.last_scan) {
        localStorage.setItem('platscanner_last_scan', data.last_scan);
      }

      // Update sync timestamp
      const settings = this.getSyncSettings();
      settings.lastSync = new Date();
      this.saveSyncSettings(settings);
    } catch (error) {
      console.error('Failed to save local data:', error);
      throw error;
    }
  }

  /**
   * Upload local data to cloud
   */
  async uploadToCloud(): Promise<SyncResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    // Prevent concurrent sync operations
    if (this.isSyncing) {
      console.log('>>> [Cloud Sync] Already syncing - skipping upload <<<');
      return { success: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'No API key found' };
      }

      const localData = this.getLocalData();
      if (!localData) {
        return { success: false, error: 'No local data to upload' };
      }

      localData.user_id = userId;
      localData.last_sync = new Date().toISOString();

      const { error } = await this.supabase
        .from('user_inventories')
        .upsert(localData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
      }

      // Update local sync timestamp
      const settings = this.getSyncSettings();
      settings.lastSync = new Date();
      this.saveSyncSettings(settings);

      console.log('>>> [Cloud Sync] Upload successful <<<');
      return { success: true };

    } catch (error) {
      console.error('Failed to upload to cloud:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Mark that data was intentionally deleted locally (prevents cloud from overriding)
   */
  markIntentionalDeletion(dataType: 'inventory' | 'all' = 'all'): void {
    try {
      const deletionRecord = {
        timestamp: new Date().toISOString(),
        dataType,
        deletedBy: 'user_action'
      };
      localStorage.setItem('platscanner_intentional_deletion', JSON.stringify(deletionRecord));
      console.log(`>>> [Cloud Sync] Marked intentional deletion for ${dataType} <<<`);
    } catch (error) {
      console.error('Failed to mark intentional deletion:', error);
    }
  }

  /**
   * Check if data was recently intentionally deleted
   */
  private wasRecentlyDeleted(dataType: 'inventory' | 'all' = 'all'): boolean {
    try {
      const deletionRecord = localStorage.getItem('platscanner_intentional_deletion');
      if (!deletionRecord) return false;

      const record = JSON.parse(deletionRecord);
      const deletionTime = new Date(record.timestamp);
      const now = new Date();
      const hoursSinceDeletion = (now.getTime() - deletionTime.getTime()) / (1000 * 60 * 60);

      // Consider deletion recent if within 24 hours
      const isRecent = hoursSinceDeletion < 24;
      const typeMatches = record.dataType === 'all' || record.dataType === dataType;

      if (isRecent && typeMatches) {
        console.log(`>>> [Cloud Sync] Recent intentional deletion detected for ${dataType} (${hoursSinceDeletion.toFixed(1)} hours ago) <<<`);
        return true;
      }

      // Clean up old deletion records
      if (hoursSinceDeletion >= 24) {
        localStorage.removeItem('platscanner_intentional_deletion');
      }

      return false;
    } catch (error) {
      console.error('Failed to check deletion status:', error);
      return false;
    }
  }

  /**
   * Download data from cloud
   */
  async downloadFromCloud(overwriteLocal: boolean = false): Promise<SyncResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    // Prevent concurrent sync operations
    if (this.isSyncing) {
      console.log('>>> [Cloud Sync] Already syncing - skipping download <<<');
      return { success: false, error: 'Sync already in progress' };
    }

    // Check for recent intentional deletions
    if (!overwriteLocal && this.wasRecentlyDeleted('inventory')) {
      console.log('>>> [Cloud Sync] Skipping download due to recent intentional deletion <<<');
      return { success: false, error: 'Recent intentional deletion detected - not restoring from cloud' };
    }

    this.isSyncing = true;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'No API key found' };
      }

      const { data, error } = await this.supabase
        .from('user_inventories')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found - this is normal for first-time users
          return { success: false, error: 'No cloud data found' };
        }
        console.error('Download error:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'No cloud data found' };
      }

      // Check for conflicts if not overwriting
      if (!overwriteLocal) {
        const localData = this.getLocalData();
        if (localData && localData.inventory_data?.items?.length > 0) {
          const localTime = new Date(localData.last_sync);
          const remoteTime = new Date(data.last_sync);

          if (localTime > remoteTime) {
            // Local data is newer - potential conflict
            return {
              success: false,
              error: 'Conflict detected',
              conflictData: {
                local: localData,
                remote: data
              }
            };
          }
        }
      }

      // Save to local storage (this won't trigger onLocalDataModified due to isSyncing flag)
      this.saveLocalData(data);

      console.log('>>> [Cloud Sync] Download successful <<<');
      return { success: true };

    } catch (error) {
      console.error('Failed to download from cloud:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Notify that local data has been modified (call this whenever inventory changes)
   * Uses debouncing to batch multiple rapid modifications and sync only once
   */
  async onLocalDataModified(): Promise<SyncResult> {
    // Prevent re-entrant sync operations
    if (this.isSyncing) {
      return { success: true };
    }

    const settings = this.getSyncSettings();

    // Update local modification timestamp
    this.updateLocalModificationTime();

    // If sync is not enabled, return early
    if (!settings.isEnabled || !this.isConfigured) {
      return { success: true };
    }

    // Cancel any pending sync
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }

    // Schedule a debounced sync
    this.pendingSyncTimeout = setTimeout(async () => {
      try {
        console.log('>>> [Cloud Sync] Debounced sync triggered - uploading to cloud <<<');
        await this.uploadToCloud();
      } catch (error) {
        console.error('Debounced sync failed:', error);
      } finally {
        this.pendingSyncTimeout = null;
      }
    }, this.syncDebounceMs);

    return { success: true };
  }

  /**
   * Force immediate sync (bypasses debouncing) - used for manual sync operations
   */
  async forceSync(): Promise<SyncResult> {
    // Cancel any pending debounced sync
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
    }

    const settings = this.getSyncSettings();
    if (!settings.isEnabled || !this.isConfigured) {
      return { success: false, error: 'Sync not enabled or configured' };
    }

    console.log('>>> [Cloud Sync] Force sync triggered <<<');
    return await this.uploadToCloud();
  }

  /**
   * Flush any pending sync operations immediately
   */
  async flushPendingSync(): Promise<SyncResult> {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
      console.log('>>> [Cloud Sync] Flushing pending sync <<<');
      return await this.uploadToCloud();
    }
    return { success: true };
  }

  /**
   * Smart auto-sync that compares modification times
   */
  async autoSync(): Promise<SyncResult> {
    const settings = this.getSyncSettings();

    if (!settings.isEnabled || !settings.autoSync) {
      return { success: false, error: 'Auto-sync disabled' };
    }

    // Prevent concurrent sync operations
    if (this.isSyncing) {
      console.log('>>> [Auto-Sync] Already syncing - skipping auto-sync <<<');
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      // Get cloud data info to compare timestamps
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'No API key found' };
      }

      const { data: cloudData, error } = await this.supabase
        .from('user_inventories')
        .select('last_sync, updated_at')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Auto-sync error:', error);
        return { success: false, error: error.message };
      }

      if (!cloudData) {
        // No cloud data exists - upload local data
        console.log('>>> [Auto-Sync] No cloud data found - uploading local data <<<');
        return await this.uploadToCloud();
      }

      // Compare modification times
      const localModTime = this.getLocalModificationTime();
      const cloudModTime = new Date(cloudData.last_sync);

      console.log(`>>> [Auto-Sync] Local modified: ${localModTime.toISOString()}, Cloud modified: ${cloudModTime.toISOString()} <<<`);

      if (localModTime > cloudModTime) {
        // Local data is newer - upload to cloud
        console.log('>>> [Auto-Sync] Local data is newer - uploading to cloud <<<');
        return await this.uploadToCloud();
      } else if (cloudModTime > localModTime) {
        // Cloud data is newer - download from cloud
        console.log('>>> [Auto-Sync] Cloud data is newer - downloading from cloud <<<');
        const downloadResult = await this.downloadFromCloud();
        if (downloadResult.success) {
          // Update our local modification time to match cloud (but don't trigger sync)
          localStorage.setItem('platscanner_last_modified', cloudModTime.toISOString());
        }
        return downloadResult;
      } else {
        // Data is in sync
        console.log('>>> [Auto-Sync] Data is already in sync <<<');
        return { success: true };
      }

    } catch (error) {
      console.error('Auto-sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-sync failed'
      };
    }
  }

  /**
   * Delete user data from cloud
   */
  async deleteCloudData(): Promise<SyncResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'No API key found' };
      }

      const { error } = await this.supabase
        .from('user_inventories')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
      }

      console.log('>>> [Cloud Sync] Delete successful <<<');
      return { success: true };

    } catch (error) {
      console.error('Failed to delete cloud data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * Cleanup method to cancel any pending sync operations
   */
  cleanup(): void {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
    }
  }

  /**
   * Get cloud data info without downloading
   */
  async getCloudDataInfo(): Promise<{
    exists: boolean;
    lastSync?: Date;
    itemCount?: number;
    totalValue?: number;
    categoryBreakdown?: {
      prime_parts: { count: number; value: number };
      relics: { count: number; value: number };
      syndicate_rewards: { count: number; value: number };
      mods: { count: number; value: number };
      prime_sets: { count: number; value: number };
    };
  }> {
    if (!this.isConfigured) {
      return { exists: false };
    }

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return { exists: false };
      }

      const { data, error } = await this.supabase
        .from('user_inventories')
        .select('last_sync, inventory_data')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { exists: false };
      }

      const items = data.inventory_data?.items || [];
      const itemCount = items.length;
      const totalValue = items.reduce(
        (sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)),
        0
      );

      // Calculate category breakdown
      const categoryBreakdown = {
        prime_parts: { count: 0, value: 0 },
        relics: { count: 0, value: 0 },
        syndicate_rewards: { count: 0, value: 0 },
        mods: { count: 0, value: 0 },
        prime_sets: { count: 0, value: 0 }
      };

      items.forEach((item: any) => {
        const category = item.category || 'prime_parts';
        const quantity = item.quantity || 1;
        const value = (item.price || 0) * quantity;

        if (categoryBreakdown[category as keyof typeof categoryBreakdown]) {
          categoryBreakdown[category as keyof typeof categoryBreakdown].count += quantity;
          categoryBreakdown[category as keyof typeof categoryBreakdown].value += value;
        }
      });

      return {
        exists: true,
        lastSync: new Date(data.last_sync),
        itemCount,
        totalValue: Math.round(totalValue),
        categoryBreakdown
      };

    } catch (error) {
      console.error('Failed to get cloud data info:', error);
      return { exists: false };
    }
  }
}

// Export singleton instance
export const cloudSyncService = new CloudSyncService();
export type { SyncResult, SyncStatus, UserInventoryData };