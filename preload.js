// preload.js - Secure bridge between renderer and main process
console.log('=== PRELOAD SCRIPT STARTING ===');
const { contextBridge, ipcRenderer } = require('electron');
console.log('Preload: Electron IPC bridge modules loaded');

// Expose secure API to renderer
try {
  const electronAPI = {
    // Choose save directory
    chooseSaveDirectory: async () => {
      try {
        console.log('preload: chooseSaveDirectory called');
        const result = await ipcRenderer.invoke('choose-save-directory');
        console.log('preload: chooseSaveDirectory result:', result);
        return result;
      } catch (error) {
        console.error('preload: Error choosing directory:', error);
        return { success: false, message: `Directory selection failed: ${error.message}` };
      }
    },

    // Save CSV to specified directory
    saveCsvToDirectory: async (csvContent, fileName, directoryPath) => {
      try {
        const result = await ipcRenderer.invoke('save-csv-to-directory', csvContent, fileName, directoryPath);
        return result;
      } catch (error) {
        console.error('Error saving CSV:', error);
        return { success: false, message: `Save failed: ${error.message}` };
      }
    },

    // Save CSV via main process
    saveCsv: async (csvContent, fileName) => {
      try {
        const result = await ipcRenderer.invoke('save-csv', csvContent, fileName);
        return result;
      } catch (error) {
        console.error('Error saving CSV:', error);
        return { success: false, message: `Save failed: ${error.message}` };
      }
    },

    saveTextFile: async (options) => {
      try {
        return await ipcRenderer.invoke('save-text-file', options);
      } catch (error) {
        console.error('Error saving text file:', error);
        return { success: false, message: `Save failed: ${error.message}` };
      }
    },

    // Event listeners for save operations
    onSaveComplete: (callback) => {
      ipcRenderer.on('save-complete', (_event, value) => callback(value));
    },
    onSaveError: (callback) => {
      ipcRenderer.on('save-error', (_event, value) => callback(value));
    },

    // Request app restart (for updates)
    requestRestart: () => {
      ipcRenderer.send('request-restart');
    },

    aiCredentials: {
      isAvailable: async () => {
        try {
          return await ipcRenderer.invoke('ai-credentials:is-available');
        } catch (error) {
          console.error('preload: secure storage availability check failed:', error);
          return { success: false, available: false, message: error.message };
        }
      },
      save: async (providerId, apiKey) => {
        try {
          return await ipcRenderer.invoke('ai-credentials:save', { providerId, apiKey });
        } catch (error) {
          console.error('preload: secure storage save failed:', error);
          return { success: false, message: error.message };
        }
      },
      load: async (providerId) => {
        try {
          return await ipcRenderer.invoke('ai-credentials:load', { providerId });
        } catch (error) {
          console.error('preload: secure storage load failed:', error);
          return { success: false, message: error.message, apiKey: '' };
        }
      },
      clear: async (providerId) => {
        try {
          return await ipcRenderer.invoke('ai-credentials:clear', { providerId });
        } catch (error) {
          console.error('preload: secure storage clear failed:', error);
          return { success: false, message: error.message };
        }
      }
    }
  };

  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('Preload: electronAPI exposed successfully');
  console.log('Preload: Available functions:', Object.keys(electronAPI));
} catch (error) {
  console.error('Preload: Failed to expose electronAPI:', error);
  console.error('Preload: Error details:', error.message);
}
