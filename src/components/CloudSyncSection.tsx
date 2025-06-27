// Purpose: Cloud Sync Settings Component - Cross-platform inventory synchronization
// Features: Auto-sync, manual sync, conflict resolution, cloud data management

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Upload, Download, RefreshCw, AlertTriangle, CheckCircle, Settings, Trash2, Info } from 'lucide-react';
import { cloudSyncService, SyncResult, SyncStatus } from '../services/cloudSyncService';

interface CloudSyncSectionProps {
  onDataImported?: () => void; // Callback to refresh UI after sync
}

const CloudSyncSection: React.FC<CloudSyncSectionProps> = ({ onDataImported }) => {
  const [syncSettings, setSyncSettings] = useState<SyncStatus>(cloudSyncService.getSyncSettings());
  const [cloudInfo, setCloudInfo] = useState<{
    exists: boolean;
    lastSync?: Date;
    itemCount?: number;
    totalValue?: number;
  }>({ exists: false });
  const [syncStatus, setSyncStatus] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
    message?: string;
    conflictData?: any;
  }>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(false);

  const isAvailable = cloudSyncService.isAvailable();

  // Load cloud info on mount
  useEffect(() => {
    if (isAvailable && syncSettings.isEnabled) {
      loadCloudInfo();
    }
  }, [isAvailable, syncSettings.isEnabled]);

  const loadCloudInfo = async () => {
    try {
      const info = await cloudSyncService.getCloudDataInfo();
      setCloudInfo(info);
    } catch (error) {
      console.error('Failed to load cloud info:', error);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    const newSettings = { ...syncSettings, isEnabled: enabled };
    setSyncSettings(newSettings);
    cloudSyncService.saveSyncSettings(newSettings);

    if (enabled) {
      await loadCloudInfo();
      // Try auto-sync when enabling
      await handleAutoSync();
    }
  };

  const handleToggleAutoSync = (autoSync: boolean) => {
    const newSettings = { ...syncSettings, autoSync };
    setSyncSettings(newSettings);
    cloudSyncService.saveSyncSettings(newSettings);
  };

  const handleConflictResolution = (resolution: 'ask' | 'local' | 'remote') => {
    const newSettings = { ...syncSettings, conflictResolution: resolution };
    setSyncSettings(newSettings);
    cloudSyncService.saveSyncSettings(newSettings);
  };

  const handleUpload = async () => {
    setIsLoading(true);
    setSyncStatus({ status: 'syncing', message: 'Uploading to cloud...' });

    try {
      const result = await cloudSyncService.uploadToCloud();
      if (result.success) {
        setSyncStatus({ status: 'success', message: 'Successfully uploaded to cloud!' });
        await loadCloudInfo();
        const newSettings = { ...syncSettings, lastSync: new Date() };
        setSyncSettings(newSettings);
      } else {
        setSyncStatus({ status: 'error', message: result.error || 'Upload failed' });
      }
    } catch (error) {
      setSyncStatus({ status: 'error', message: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (overwrite: boolean = false) => {
    setIsLoading(true);
    setSyncStatus({ status: 'syncing', message: 'Downloading from cloud...' });

    try {
      const result = await cloudSyncService.downloadFromCloud(overwrite);
      if (result.success) {
        setSyncStatus({ status: 'success', message: 'Successfully downloaded from cloud!' });
        onDataImported?.(); // Refresh UI
        const newSettings = { ...syncSettings, lastSync: new Date() };
        setSyncSettings(newSettings);
      } else if (result.conflictData) {
        setSyncStatus({
          status: 'conflict',
          message: 'Conflict detected between local and cloud data',
          conflictData: result.conflictData
        });
      } else {
        setSyncStatus({ status: 'error', message: result.error || 'Download failed' });
      }
    } catch (error) {
      setSyncStatus({ status: 'error', message: 'Download failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSync = async () => {
    if (!syncSettings.isEnabled || !syncSettings.autoSync) return;

    setIsLoading(true);
    setSyncStatus({ status: 'syncing', message: 'Auto-syncing...' });

    try {
      const result = await cloudSyncService.autoSync();
      if (result.success) {
        setSyncStatus({ status: 'success', message: 'Auto-sync completed!' });
        onDataImported?.(); // Refresh UI
        await loadCloudInfo();
        const newSettings = { ...syncSettings, lastSync: new Date() };
        setSyncSettings(newSettings);
      } else if (result.conflictData) {
        setSyncStatus({
          status: 'conflict',
          message: 'Conflict detected - manual resolution required',
          conflictData: result.conflictData
        });
      } else {
        setSyncStatus({ status: 'error', message: result.error || 'Auto-sync failed' });
      }
    } catch (error) {
      setSyncStatus({ status: 'error', message: 'Auto-sync failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCloudData = async () => {
    if (!confirm('Are you sure you want to delete all cloud data? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setSyncStatus({ status: 'syncing', message: 'Deleting cloud data...' });

    try {
      const result = await cloudSyncService.deleteCloudData();
      if (result.success) {
        setSyncStatus({ status: 'success', message: 'Cloud data deleted successfully' });
        setCloudInfo({ exists: false });
      } else {
        setSyncStatus({ status: 'error', message: result.error || 'Delete failed' });
      }
    } catch (error) {
      setSyncStatus({ status: 'error', message: 'Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveConflict = async (resolution: 'local' | 'remote') => {
    if (resolution === 'local') {
      await handleUpload();
    } else {
      await handleDownload(true);
    }
    setSyncStatus({ status: 'idle' });
  };

  if (!isAvailable) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CloudOff className="w-5 h-5" />
          Cloud Sync
        </h3>
        <div className="text-gray-300 text-sm space-y-3">
          <p>Cloud sync is not available. This feature requires Supabase configuration.</p>
          <div className="bg-gray-700 rounded p-3">
            <p className="text-xs text-gray-400">
              Cloud sync allows you to synchronize your inventory across multiple devices and browsers using your Gemini API key as a unique identifier.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Cloud className="w-5 h-5" />
        Cloud Sync
      </h3>

      <p className="text-gray-300 text-sm mb-6">
        Sync your inventory, build plans, and progress across all your devices using your Gemini API key as a secure identifier.
      </p>

      {/* Enable/Disable Toggle */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-white font-medium">Enable Cloud Sync</label>
            <p className="text-gray-400 text-xs">Synchronize data across devices</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={syncSettings.isEnabled}
              onChange={(e) => handleToggleSync(e.target.checked)}
              className="sr-only peer"
              disabled={isLoading}
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {syncSettings.isEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-medium">Auto Sync</label>
                <p className="text-gray-400 text-xs">Automatically sync when opening the app</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncSettings.autoSync}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                  disabled={isLoading}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="text-white font-medium block mb-2">Conflict Resolution</label>
              <select
                value={syncSettings.conflictResolution}
                onChange={(e) => handleConflictResolution(e.target.value as 'ask' | 'local' | 'remote')}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm"
                disabled={isLoading}
              >
                <option value="ask">Ask me each time</option>
                <option value="local">Always use local data</option>
                <option value="remote">Always use cloud data</option>
              </select>
              <p className="text-gray-400 text-xs mt-1">
                How to handle conflicts when both local and cloud data have been modified
              </p>
            </div>
          </>
        )}
      </div>

      {syncSettings.isEnabled && (
        <>
          {/* Cloud Data Info */}
          {cloudInfo.exists && (
            <div className="bg-gray-700 rounded p-4 mb-4">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Cloud Data
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Items</p>
                  <p className="text-white">{cloudInfo.itemCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total Value</p>
                  <p className="text-white">{cloudInfo.totalValue || 0}p</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400">Last Sync</p>
                  <p className="text-white">{cloudInfo.lastSync?.toLocaleString() || 'Never'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Sync Controls */}
          <div className="space-y-3 mb-4">
            <h4 className="text-white font-medium">Manual Sync</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleUpload}
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Upload to Cloud
              </button>

              <button
                onClick={() => handleDownload(false)}
                disabled={isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download from Cloud
              </button>

              <button
                onClick={handleAutoSync}
                disabled={isLoading || !syncSettings.autoSync}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Auto Sync Now
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-gray-600 pt-4">
            <h4 className="text-red-400 font-medium mb-2">Danger Zone</h4>
            <button
              onClick={handleDeleteCloudData}
              disabled={isLoading || !cloudInfo.exists}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Cloud Data
            </button>
            <p className="text-gray-400 text-xs mt-1">
              Permanently delete all your data from the cloud
            </p>
          </div>

          {/* Status Messages */}
          {syncStatus.status !== 'idle' && (
            <div className="mt-4">
              {syncStatus.status === 'syncing' && (
                <div className="flex items-center gap-2 text-blue-400 bg-blue-900/20 p-3 rounded">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {syncStatus.message}
                </div>
              )}

              {syncStatus.status === 'success' && (
                <div className="flex items-center gap-2 text-green-400 bg-green-900/20 p-3 rounded">
                  <CheckCircle className="w-4 h-4" />
                  {syncStatus.message}
                </div>
              )}

              {syncStatus.status === 'error' && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded">
                  <AlertTriangle className="w-4 h-4" />
                  {syncStatus.message}
                </div>
              )}

              {syncStatus.status === 'conflict' && (
                <div className="bg-yellow-900/20 border border-yellow-600 p-4 rounded">
                  <div className="flex items-center gap-2 text-yellow-400 mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    {syncStatus.message}
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    Both your local data and cloud data have been modified. Choose which version to keep:
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolveConflict('local')}
                      disabled={isLoading}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      Keep Local Data
                    </button>
                    <button
                      onClick={() => handleResolveConflict('remote')}
                      disabled={isLoading}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      Keep Cloud Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy Notice */}
          <div className="mt-6 bg-gray-700/50 rounded p-3">
            <p className="text-gray-300 text-xs">
              <strong>Privacy:</strong> Your Gemini API key is hashed using SHA-256 before being used as a unique identifier.
              The raw API key is never stored in the cloud. Only your inventory data, build plans, and mastery progress are synchronized.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CloudSyncSection;