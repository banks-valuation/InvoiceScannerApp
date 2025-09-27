import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Folder, FileSpreadsheet, Settings as SettingsIcon, RefreshCw, CheckCircle, AlertCircle, FolderOpen, ChevronRight, ChevronDown, X, ChevronLeft } from 'lucide-react';
import { AlertModal } from './Modal';
import { useAlertModal } from '../hooks/useModal';
import { SettingsService } from '../services/settingsService';
import { MicrosoftService } from '../services/microsoftService';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showExcelBrowser, setShowExcelBrowser] = useState(false);
  const [excelBrowserPath, setExcelBrowserPath] = useState('');
  const [availableExcelItems, setAvailableExcelItems] = useState<Array<{ name: string; path: string; isFolder: boolean }>>([]);
  const [isLoadingExcelItems, setIsLoadingExcelItems] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderBrowserPath, setFolderBrowserPath] = useState('');
  const [availableFolders, setAvailableFolders] = useState<Array<{ name: string; path: string; isFolder: boolean }>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const alertModal = useAlertModal();

  useEffect(() => {
    // Load settings from database
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        console.log('Loading settings...');
        const startTime = Date.now();
        const loadedSettings = await SettingsService.getSettings();
        const loadTime = Date.now() - startTime;
        console.log(`Settings loaded in ${loadTime}ms`);
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Use default settings if loading fails
        setSettings(DEFAULT_SETTINGS);
        alertModal.showAlert({
          title: 'Settings Load Failed',
          message: 'Failed to load settings from database. Using default settings.',
          type: 'warning'
        });
      } finally {
        setIsLoadingSettings(false);
      }
    };


    loadSettings();
    

    // Check authentication status when component mounts and periodically
    const checkAuth = () => {
      const authStatus = MicrosoftService.isAuthenticated();
      console.log('Settings page - checking auth status:', authStatus);
      setIsAuthenticated(authStatus);
    };
    
    checkAuth();
    
    // Also check when the component becomes visible (in case user authenticated in another tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleInputChange = (section: keyof AppSettings, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await SettingsService.saveSettings(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleAuthenticateOneDrive = () => {
    try {
      console.log('Connect OneDrive button clicked');
      MicrosoftService.initiateLogin();
    } catch (error) {
      console.error('Authentication failed:', error);
      alertModal.showAlert({
        title: 'Authentication Failed',
        message: 'Authentication failed. Please try again.',
        type: 'error'
      });
    }
  };

  const handleDisconnectOneDrive = () => {
    MicrosoftService.logout();
    setIsAuthenticated(false);
    setAvailableFiles([]);
    console.log('Disconnected from Microsoft OneDrive');
  };

  const loadAvailableExcelFiles = async () => {
    if (!isAuthenticated) return;
    
    setIsLoadingFiles(true);
    try {
      const files = await MicrosoftService.listExcelFiles();
      setAvailableFiles(files);
    } catch (error) {
      console.error('Failed to load Excel files:', error);
      alertModal.showAlert({
        title: 'Load Failed',
        message: 'Failed to load Excel files. Please check your connection.',
        type: 'error'
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadExcelItems = async (path: string = '') => {
    if (!isAuthenticated) return;
    
    console.log('loadExcelItems called with path:', path);
    setIsLoadingExcelItems(true);
    try {
      // Get both folders and Excel files in the current path
      const [folders, files] = await Promise.all([
        MicrosoftService.listFolders(path),
        MicrosoftService.listExcelFilesInPath(path)
      ]);
      
      // Combine folders and Excel files
      const combined = [
        ...folders.map(folder => ({ ...folder, isFolder: true })),
        ...files.map(file => ({ ...file, isFolder: false }))
      ];
      
      console.log('Loaded Excel items:', combined);
      setAvailableExcelItems(combined);
      setExcelBrowserPath(path);
    } catch (error) {
      console.error('Failed to load Excel items:', error);
      alertModal.showAlert({
        title: 'Load Failed',
        message: `Failed to load items: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your connection and permissions.`,
        type: 'error'
      });
    } finally {
      setIsLoadingExcelItems(false);
    }
  };

  const handleExcelFileSelect = (fileName: string, filePath: string) => {
    // Extract just the filename for the setting
    const justFileName = fileName;
    handleInputChange('onedrive', 'excelFileName', justFileName);
    
    // Store the full path for reference (we might need this later)
    console.log('Selected Excel file:', { fileName, filePath });
    setShowExcelBrowser(false);
  };

  const navigateToExcelFolder = (folderPath: string) => {
    loadExcelItems(folderPath);
  };

  const navigateExcelUp = () => {
    const pathParts = excelBrowserPath.split('/').filter(part => part.length > 0);
    pathParts.pop();
    const parentPath = pathParts.join('/');
    loadExcelItems(parentPath);
  };

  const loadFolders = async (path: string = '') => {
    if (!isAuthenticated) return;
    
    console.log('loadFolders called with path:', path);
    setIsLoadingFolders(true);
    try {
      const folders = await MicrosoftService.listFolders(path);
      console.log('Loaded folders:', folders);
      setAvailableFolders(folders);
      setFolderBrowserPath(path);
    } catch (error) {
      console.error('Failed to load folders:', error);
      alertModal.showAlert({
        title: 'Load Failed',
        message: `Failed to load folders: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your connection and permissions.`,
        type: 'error'
      });
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    handleInputChange('onedrive', 'invoiceDirectory', folderPath);
    setShowFolderBrowser(false);
  };

  const navigateToFolder = (folderPath: string) => {
    loadFolders(folderPath);
  };

  const navigateUp = () => {
    const pathParts = folderBrowserPath.split('/').filter(part => part.length > 0);
    pathParts.pop();
    const parentPath = pathParts.join('/');
    loadFolders(parentPath);
  };

  const getSaveButtonContent = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="w-4 h-4" />
            Saved!
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            Error
          </>
        );
      default:
        return (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        );
    }
  };

  // Show loading state while settings are being loaded
  if (isLoadingSettings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* OneDrive Integration Settings */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Folder className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">OneDrive Integration</h2>
                <p className="text-sm text-gray-600">Configure where invoice files are stored and tracked</p>
              </div>
            </div>

            {/* Authentication Status */}
            <div className="mb-6 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <span className="font-medium text-gray-900">
                      {isAuthenticated ? 'Connected to Microsoft OneDrive' : 'Not connected'}
                    </span>
                    {isAuthenticated && (
                      <div className="text-xs text-gray-500 mt-1">
                        {(() => {
                          const tokenStatus = MicrosoftService.checkTokenValidity();
                          if (tokenStatus.expiresAt) {
                            const hoursRemaining = Math.floor((tokenStatus.timeRemaining || 0) / (1000 * 60 * 60));
                            return hoursRemaining > 0 
                              ? `Token expires in ${hoursRemaining} hours`
                              : 'Token will refresh automatically';
                          }
                          return 'Persistent login active';
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                {isAuthenticated ? (
                  <button
                    onClick={handleDisconnectOneDrive}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleAuthenticateOneDrive}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Connect OneDrive
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Invoice Directory */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="invoiceDirectory" className="block text-sm font-medium text-gray-700">
                    Invoice Upload Directory
                  </label>
                  {isAuthenticated && (
                    <button
                      onClick={() => {
                        console.log('Browse Folders button clicked');
                        setShowFolderBrowser(true);
                        loadFolders();
                      }}
                      className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Browse Folders
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  id="invoiceDirectory"
                  value={settings.onedrive.invoiceDirectory}
                  onChange={(e) => handleInputChange('onedrive', 'invoiceDirectory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Invoices, Documents/Invoices, Tax/2024/Invoices"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Specify the OneDrive folder where invoice files will be uploaded. Use forward slashes for subfolders.
                </p>
              </div>

              {/* Excel File Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="excelFileName" className="block text-sm font-medium text-gray-700">
                    Excel Tracking File
                  </label>
                  {isAuthenticated && (
                    <button
                      onClick={() => {
                        console.log('Browse Excel Files button clicked');
                        setShowExcelBrowser(true);
                        loadExcelItems();
                      }}
                      disabled={isLoadingExcelItems}
                      className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {isLoadingExcelItems ? (
                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-3 h-3" />
                      )}
                      Browse Files
                    </button>
                  )}
                </div>
                
                <input
                  type="text"
                  id="excelFileName"
                  value={settings.onedrive.excelFileName}
                  onChange={(e) => handleInputChange('onedrive', 'excelFileName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Invoice_Tracker.xlsx, Expenses_2024.xlsx"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Name of the Excel file where invoice data will be tracked. If the file doesn't exist, it will be created automatically.
                </p>

                {/* Available Files List */}
                {availableFiles.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Available Excel files:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {availableFiles.map((file, index) => (
                        <button
                          key={index}
                          onClick={() => handleInputChange('onedrive', 'excelFileName', file.name)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-green-600" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-gray-400 text-xs ml-auto">{file.path}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* General Settings */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <SettingsIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
                <p className="text-sm text-gray-600">Configure default behavior and preferences</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Default Category */}
              <div>
                <label htmlFor="defaultCategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Default Invoice Category
                </label>
                <select
                  id="defaultCategory"
                  value={settings.general.defaultCategory}
                  onChange={(e) => handleInputChange('general', 'defaultCategory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="Massage Therapy">Massage Therapy</option>
                  <option value="Physio Therapy">Physio Therapy</option>
                  <option value="Dentist">Dentist</option>
                  <option value="Prescription Medication">Prescription Medication</option>
                  <option value="Vision">Vision</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Auto OCR Extraction */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="autoExtractOCR" className="text-sm font-medium text-gray-700">
                    Auto-extract data from uploaded files
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically extract customer name, date, and amount using OCR when files are uploaded
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="autoExtractOCR"
                    checked={settings.general.autoExtractOCR}
                    onChange={(e) => handleInputChange('general', 'autoExtractOCR', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                saveStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getSaveButtonContent()}
            </button>
          </div>
        </div>
      </div>

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Browse OneDrive Folders</h3>
                <button
                  onClick={() => setShowFolderBrowser(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Current Path */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <Folder className="w-4 h-4" />
                <span>Current path: /{folderBrowserPath || 'OneDrive Root'}</span>
              </div>
            </div>

            <div className="p-6">
              {/* Navigation */}
              <div className="flex items-center gap-2 mb-4">
                {folderBrowserPath && (
                  <button
                    onClick={navigateUp}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Go Up
                  </button>
                )}
                
                <button
                  onClick={() => handleFolderSelect(folderBrowserPath)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium ml-auto"
                >
                  <CheckCircle className="w-4 h-4" />
                  Use This Folder
                </button>
              </div>

              {/* Folder List */}
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {isLoadingFolders ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-gray-600">Loading folders...</span>
                  </div>
                ) : availableFolders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No folders found in this location</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {availableFolders.map((folder, index) => (
                      <button
                        key={index}
                        onClick={() => navigateToFolder(folder.path)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <Folder className="w-5 h-5 text-blue-600" />
                        <span className="flex-1 text-gray-900">{folder.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Excel File Browser Modal */}
      {showExcelBrowser && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Browse Excel Files</h3>
                <button
                  onClick={() => setShowExcelBrowser(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Current Path */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Current path: /{excelBrowserPath || 'OneDrive Root'}</span>
              </div>
            </div>

            <div className="p-6">
              {/* Navigation */}
              <div className="flex items-center gap-2 mb-4">
                {excelBrowserPath && (
                  <button
                    onClick={navigateExcelUp}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Go Up
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {isLoadingExcelItems ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-gray-600">Loading...</span>
                  </div>
                ) : availableExcelItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No folders or Excel files found in this location</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {availableExcelItems.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (item.isFolder) {
                            navigateToExcelFolder(item.path);
                          } else {
                            handleExcelFileSelect(item.name, item.path);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        {item.isFolder ? (
                          <Folder className="w-5 h-5 text-blue-600" />
                        ) : (
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        )}
                        <span className="flex-1 text-gray-900">{item.name}</span>
                        {item.isFolder ? (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <span className="text-xs text-gray-500">Select</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.handleClose}
        title={alertModal.config?.title || ''}
        message={alertModal.config?.message || ''}
        type={alertModal.config?.type}
        buttonText={alertModal.config?.buttonText}
      />
    </div>
  );
}