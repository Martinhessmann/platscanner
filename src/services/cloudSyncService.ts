// Purpose: Cloud Sync Service - Sync user data across platforms using Supabase
// Uses hashed Gemini API key as unique user identifier for cross-platform inventory sync

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
   * Get current user ID from stored API key
   */
  private async getCurrentUserId(): Promise<string | null> {
    const apiKey = localStorage.getItem('platscanner_gemini_api_key');
    if (!apiKey) return null;
    return await this.hashApiKey(apiKey);
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
   * Get local data for syncing
   */
  private getLocalData(): UserInventoryData | null {
    try {
      const inventory = localStorage.getItem('platscanner_inventory');
      const buildPlans = localStorage.getItem('platscanner_build_plans');
      const mastery = localStorage.getItem('platscanner_mastery');
      const lastScan = localStorage.getItem('platscanner_last_scan');

      return {
        user_id: '', // Will be set by caller
        inventory_data: inventory ? JSON.parse(inventory) : null,
        build_plans: buildPlans ? JSON.parse(buildPlans) : { buildPlans: [], reservedItems: [], version: 1 },
        mastery_data: mastery ? JSON.parse(mastery) : [],
        last_scan: lastScan || new Date().toISOString(),
        last_sync: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get local data:', error);
      return null;
    }
  }

  /**
   * Save remote data to local storage
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
    }
  }

  /**
   * Download data from cloud
   */
  async downloadFromCloud(overwriteLocal: boolean = false): Promise<SyncResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloud sync not configured' };
    }

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

      // Save to local storage
      this.saveLocalData(data);

      console.log('>>> [Cloud Sync] Download successful <<<');
      return { success: true };

    } catch (error) {
      console.error('Failed to download from cloud:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Auto-sync based on user settings
   */
  async autoSync(): Promise<SyncResult> {
    const settings = this.getSyncSettings();

    if (!settings.isEnabled || !settings.autoSync) {
      return { success: false, error: 'Auto-sync disabled' };
    }

    // Try download first, then upload if no conflicts
    const downloadResult = await this.downloadFromCloud();

    if (downloadResult.success) {
      return downloadResult;
    }

    if (downloadResult.error === 'No cloud data found') {
      // First time - upload local data
      return await this.uploadToCloud();
    }

    if (downloadResult.conflictData) {
      // Handle conflict based on user preference
      if (settings.conflictResolution === 'local') {
        return await this.uploadToCloud();
      } else if (settings.conflictResolution === 'remote') {
        return await this.downloadFromCloud(true);
      }
      // Otherwise return conflict for user to resolve
      return downloadResult;
    }

    return downloadResult;
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
   * Get cloud data info without downloading
   */
  async getCloudDataInfo(): Promise<{
    exists: boolean;
    lastSync?: Date;
    itemCount?: number;
    totalValue?: number;
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

      const itemCount = data.inventory_data?.items?.length || 0;
      const totalValue = data.inventory_data?.items?.reduce(
        (sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)),
        0
      ) || 0;

      return {
        exists: true,
        lastSync: new Date(data.last_sync),
        itemCount,
        totalValue: Math.round(totalValue)
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