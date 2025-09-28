// main.js - Enhanced Electron app for converting Playwright tests to Azure DevOps CSV
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let keytar;
let keytarAvailable = false;
try {
  keytar = require('keytar');
  keytarAvailable = typeof keytar?.setPassword === 'function';
  if (!keytarAvailable) {
    console.warn('Keytar module loaded but setPassword is unavailable.');
  }
} catch (error) {
  console.warn('Keytar module could not be loaded. Secure storage unavailable.', error.message || error);
}

const KEYTAR_SERVICE = 'playwright-converter-ai-credentials';

console.log('Playwright to Azure CSV Converter starting...');

// Window reference to prevent garbage collection
let mainWindow;

const createWindow = () => {
  // Create the browser window with improved security settings
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 1200,
    minWidth: 1200,
    minHeight: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false,
    },
    show: false, // Don't show until ready
  });

  // Load the main UI
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window is ready and visible');
    // Uncomment for debugging
    // mainWindow.webContents.openDevTools();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App lifecycle events
app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Secure IPC handlers for file operations
ipcMain.handle('ai-credentials:is-available', async () => {
  return { success: true, available: keytarAvailable };
});

ipcMain.handle('ai-credentials:save', async (_event, payload = {}) => {
  const { providerId, apiKey } = payload;
  if (!providerId) {
    return { success: false, message: 'providerId is required' };
  }
  if (!keytarAvailable) {
    return { success: false, message: 'Secure storage not available on this platform.' };
  }

  try {
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
      await keytar.deletePassword(KEYTAR_SERVICE, providerId);
    } else {
      await keytar.setPassword(KEYTAR_SERVICE, providerId, trimmedKey);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to store API key securely:', error);
    return { success: false, message: error.message || 'Secure storage save error.' };
  }
});

ipcMain.handle('ai-credentials:load', async (_event, payload = {}) => {
  const { providerId } = payload;
  if (!providerId) {
    return { success: false, message: 'providerId is required' };
  }
  if (!keytarAvailable) {
    return { success: false, message: 'Secure storage not available on this platform.' };
  }

  try {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, providerId);
    return { success: true, apiKey: apiKey || '' };
  } catch (error) {
    console.error('Failed to load API key from secure storage:', error);
    return { success: false, message: error.message || 'Secure storage load error.' };
  }
});

ipcMain.handle('ai-credentials:clear', async (_event, payload = {}) => {
  const { providerId } = payload;
  if (!providerId) {
    return { success: false, message: 'providerId is required' };
  }
  if (!keytarAvailable) {
    return { success: false, message: 'Secure storage not available on this platform.' };
  }

  try {
    await keytar.deletePassword(KEYTAR_SERVICE, providerId);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear API key from secure storage:', error);
    return { success: false, message: error.message || 'Secure storage clear error.' };
  }
});

ipcMain.handle('choose-save-directory', async () => {
  try {
    console.log('choose-save-directory handler called');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose Save Location',
      properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      console.log('Directory selected:', result.filePaths[0]);
      return { success: true, directoryPath: result.filePaths[0] };
    }

    console.log('Directory selection cancelled');
    return { success: false, message: 'Directory selection cancelled.' };
  } catch (error) {
    console.error('Directory selection error:', error);
    return { success: false, message: `Error selecting directory: ${error.message}` };
  }
});

ipcMain.handle('save-csv-to-directory', async (event, csvContent, defaultFileName = 'azure-test-cases', directoryPath) => {
  try {
    console.log('save-csv-to-directory handler called', { defaultFileName, directoryPath });
    if (!directoryPath) {
      throw new Error('No directory selected');
    }

    const fileName = `${defaultFileName}-${Date.now()}.csv`;
    const filePath = path.join(directoryPath, fileName);

    const fs = require('fs').promises;
    await fs.writeFile(filePath, csvContent, 'utf-8');
    console.log('CSV file saved to:', filePath);
    return { success: true, message: `CSV file saved to ${directoryPath}!` };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, message: `Error saving file: ${error.message}` };
  }
});

ipcMain.handle('save-csv', async (event, csvContent, defaultFileName = 'azure-test-cases') => {
  try {
    console.log('save-csv handler called', { defaultFileName });
    const fileName = `${defaultFileName}-${Date.now()}.csv`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Test Cases CSV',
      defaultPath: fileName,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (!result.canceled) {
      const fs = require('fs').promises;
      await fs.writeFile(result.filePath, csvContent, 'utf-8');
      console.log('CSV file saved to:', result.filePath);
      return { success: true, message: 'CSV file saved successfully!' };
    }

    return { success: false, message: 'Save cancelled by user.' };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, message: `Error saving file: ${error.message}` };
  }
});

ipcMain.handle('save-text-file', async (_event, payload = {}) => {
  try {
    const {
      defaultFileName = 'ai-plan',
      content = '',
      extension = 'md',
      filters = [{ name: 'Markdown', extensions: ['md'] }]
    } = payload;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedName = `${defaultFileName}-${timestamp}.${extension}`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save AI Plan',
      defaultPath: suggestedName,
      filters
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Save cancelled by user.' };
    }

    const fs = require('fs').promises;
    await fs.writeFile(result.filePath, content, 'utf-8');
    console.log('AI plan saved to:', result.filePath);
    return { success: true, message: 'AI plan saved successfully.' };
  } catch (error) {
    console.error('Failed to save AI plan:', error);
    return { success: false, message: `Error saving AI plan: ${error.message}` };
  }
});

// Handle app restart requests (for updates)
ipcMain.on('request-restart', () => {
  app.relaunch();
  app.exit();
});

console.log('Main process setup complete');