// Purpose: Data Backup and Sharing Component - Export/Import user data
// Features: Complete inventory backup, sharing, and cross-browser transfer

import React, { useState, useRef } from 'react';
import { Download, Upload, Share2, AlertCircle, CheckCircle, Copy, Users, HardDrive } from 'lucide-react';
import { exportUserData, importUserData, downloadExportFile, validateExportData } from '../services/dataExportService';

interface DataBackupSectionProps {
  onDataImported?: () => void; // Callback to refresh UI after import
}

const DataBackupSection: React.FC<DataBackupSectionProps> = ({ onDataImported }) => {
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    imported?: { inventory: boolean; buildPlans: boolean; mastery: boolean };
  }>({ status: 'idle' });

  const [exportPreview, setExportPreview] = useState<any>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [importMethod, setImportMethod] = useState<'file' | 'text'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle export functionality
  const handleExport = () => {
    const exportData = exportUserData();
    if (exportData) {
      setExportPreview(exportData);
      downloadExportFile(exportData);
    } else {
      setImportStatus({
        status: 'error',
        message: 'Failed to export data. Please try again.'
      });
    }
  };

  // Handle file selection for import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ status: 'loading', message: 'Reading file...' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;

        // Validate the data first
        const validation = validateExportData(jsonString);
        if (!validation.valid) {
          setImportStatus({
            status: 'error',
            message: `Invalid backup file: ${validation.error}`
          });
          return;
        }

        // Show preview and confirm import
        setExportPreview(JSON.parse(jsonString));
        setImportStatus({
          status: 'idle',
          message: 'File loaded successfully. Choose import options below.'
        });
      } catch (error) {
        setImportStatus({
          status: 'error',
          message: 'Failed to read backup file. Please ensure it\'s a valid PlatScanner backup.'
        });
      }
    };

    reader.onerror = () => {
      setImportStatus({
        status: 'error',
        message: 'Failed to read file.'
      });
    };

    reader.readAsText(file);
  };

  // Handle import with options
  const handleImport = (overwrite: boolean = false) => {
    if (!exportPreview) return;

    setImportStatus({ status: 'loading', message: 'Importing data...' });

    const result = importUserData(JSON.stringify(exportPreview), {
      overwrite
    });

    if (result.success) {
      setImportStatus({
        status: 'success',
        message: `Successfully imported data! ${overwrite ? 'Replaced' : 'Merged'} with existing data.`,
        imported: result.imported
      });

      // Trigger UI refresh
      if (onDataImported) {
        setTimeout(onDataImported, 1000);
      }

      // Clear preview and text after successful import
      setTimeout(() => {
        setExportPreview(null);
        setPastedJson('');
        setImportStatus({ status: 'idle' });
      }, 3000);
    } else {
      setImportStatus({
        status: 'error',
        message: `Import failed: ${result.error}`
      });
    }
  };

  // Copy JSON to clipboard for sharing
  const handleCopyJson = async () => {
    if (!exportPreview) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPreview, null, 2));
      setImportStatus({
        status: 'success',
        message: 'JSON copied to clipboard! You can now paste it to share with others.'
      });

      setTimeout(() => {
        setImportStatus({ status: 'idle' });
      }, 2000);
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: 'Failed to copy to clipboard.'
      });
    }
  };

  // Get current data preview for export
  const getCurrentData = () => {
    const data = exportUserData();
    setExportPreview(data);
  };

  // Handle pasted JSON validation
  const handleJsonPaste = () => {
    if (!pastedJson.trim()) {
      setImportStatus({
        status: 'error',
        message: 'Please paste JSON data first.'
      });
      return;
    }

    setImportStatus({ status: 'loading', message: 'Validating JSON...' });

    try {
      // Validate the data first
      const validation = validateExportData(pastedJson);
      if (!validation.valid) {
        setImportStatus({
          status: 'error',
          message: `Invalid JSON data: ${validation.error}`
        });
        return;
      }

      // Show preview and confirm import
      setExportPreview(JSON.parse(pastedJson));
      setImportStatus({
        status: 'idle',
        message: 'JSON validated successfully. Choose import options below.'
      });
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: 'Invalid JSON format. Please check your pasted data.'
      });
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <HardDrive className="w-5 h-5" />
        Data Backup & Sharing
      </h3>

      <p className="text-gray-300 text-sm mb-6">
        Backup your inventory, build plans, and progress to share with friends or transfer between browsers.
      </p>

      {/* Export Section */}
      <div className="space-y-4 mb-6">
        <h4 className="text-md font-medium text-white">Export Your Data</h4>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Backup File
          </button>

          <button
            onClick={getCurrentData}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Preview Data
          </button>
        </div>
      </div>

            {/* Import Section */}
      <div className="space-y-4 mb-6">
        <h4 className="text-md font-medium text-white">Import Data</h4>

        {/* Import Method Selection */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setImportMethod('file');
              setExportPreview(null);
              setPastedJson('');
              setImportStatus({ status: 'idle' });
            }}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              importMethod === 'file'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📁 Upload File
          </button>
          <button
            onClick={() => {
              setImportMethod('text');
              setExportPreview(null);
              setImportStatus({ status: 'idle' });
            }}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              importMethod === 'text'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📋 Paste JSON
          </button>
        </div>

        {/* File Upload Method */}
        {importMethod === 'file' && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              <Upload className="w-4 h-4" />
              Load Backup File
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Text Paste Method */}
        {importMethod === 'text' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Paste JSON Data
            </label>
            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder="Paste your PlatScanner backup JSON here..."
              rows={6}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent font-mono text-xs"
            />
            <button
              onClick={handleJsonPaste}
              disabled={!pastedJson.trim()}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
            >
              <Upload className="w-4 h-4" />
              Validate JSON
            </button>
          </div>
        )}
      </div>

      {/* Data Preview */}
      {exportPreview && (
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-white">Data Preview</h5>
            <div className="flex gap-2">
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy JSON
              </button>
              <button
                onClick={() => setShowJsonPreview(!showJsonPreview)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
              >
                {showJsonPreview ? 'Hide' : 'Show'} Raw JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-400">{exportPreview.metadata.totalItems}</div>
              <div className="text-xs text-gray-400">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-400">{exportPreview.metadata.totalValue}p</div>
              <div className="text-xs text-gray-400">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-400">{exportPreview.metadata.plannedSets}</div>
              <div className="text-xs text-gray-400">Planned Sets</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-400">{exportPreview.metadata.masteredSets}</div>
              <div className="text-xs text-gray-400">Mastered Sets</div>
            </div>
          </div>

          <div className="text-xs text-gray-400 mb-4">
            Export Date: {new Date(exportPreview.exportDate).toLocaleString()}
            <br />
            Version: {exportPreview.version}
          </div>

          {showJsonPreview && (
            <pre className="text-xs text-gray-300 bg-black rounded p-3 overflow-auto max-h-40">
              {JSON.stringify(exportPreview, null, 2)}
            </pre>
          )}

          {/* Import Options */}
          <div className="pt-3 border-t border-gray-700 space-y-3">
            <div className="text-xs text-gray-300 mb-3">
              <strong>⚠️ Choose your import method carefully:</strong>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                <button
                  onClick={() => handleImport(false)}
                  className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors font-medium"
                >
                  <Users className="w-4 h-4" />
                  Merge with Existing
                </button>
                <p className="text-xs text-green-200 mt-2">
                  ✅ <strong>Safe option</strong> - Adds new items without removing your current data. Recommended for most cases.
                </p>
              </div>

              <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                <button
                  onClick={() => handleImport(true)}
                  className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition-colors font-medium"
                >
                  <AlertCircle className="w-4 h-4" />
                  Replace All Data
                </button>
                <p className="text-xs text-red-200 mt-2">
                  🚨 <strong>DANGER</strong> - Will completely delete ALL your current inventory, build plans, and mastery data!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {importStatus.status !== 'idle' && (
        <div className={`flex items-center gap-2 p-3 rounded-md ${
          importStatus.status === 'success' ? 'bg-green-900 text-green-300' :
          importStatus.status === 'error' ? 'bg-red-900 text-red-300' :
          'bg-blue-900 text-blue-300'
        }`}>
          {importStatus.status === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : importStatus.status === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-sm">{importStatus.message}</span>

          {importStatus.imported && (
            <div className="ml-auto flex gap-1">
              {importStatus.imported.inventory && (
                <span className="text-xs bg-green-700 px-2 py-1 rounded">Inventory</span>
              )}
              {importStatus.imported.buildPlans && (
                <span className="text-xs bg-green-700 px-2 py-1 rounded">Build Plans</span>
              )}
              {importStatus.imported.mastery && (
                <span className="text-xs bg-green-700 px-2 py-1 rounded">Mastery</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 text-xs text-gray-400 space-y-2">
        <div className="border-l-4 border-blue-500 pl-3 mb-4">
          <p className="text-blue-300 font-medium mb-2">💡 How to use:</p>
          <p><strong>📁 Upload File:</strong> Select a .json backup file from your computer</p>
          <p><strong>📋 Paste JSON:</strong> Copy and paste JSON text directly (great for sharing via Discord/chat)</p>
          <p><strong>💾 Download:</strong> Save a backup file to your computer for safekeeping</p>
        </div>

        <div className="border-l-4 border-yellow-500 pl-3 mb-4">
          <p className="text-yellow-300 font-medium mb-2">⚠️ Import options:</p>
          <p><strong>🔄 Merge:</strong> Adds new items to your existing inventory (SAFE - recommended)</p>
          <p><strong>🚨 Replace:</strong> Deletes ALL current data and replaces with imported data (DANGEROUS)</p>
        </div>

        <div className="border-l-4 border-green-500 pl-3">
          <p className="text-green-300 font-medium mb-2">🛡️ What's exported:</p>
          <p>✅ All prime parts and relics with quantities and prices</p>
          <p>✅ Build plans and item reservations</p>
          <p>✅ Mastery status for prime sets</p>
          <p>❌ API keys (kept private for security)</p>
        </div>
      </div>
    </div>
  );
};

export default DataBackupSection;