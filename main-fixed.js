// main.js - Enhanced Electron app for converting Playwright tests to Azure DevOps CSV
const path = require('path');

// The issue is that require('electron') returns a path instead of the module
// We need to access the Electron APIs differently
let app, BrowserWindow, ipcMain, dialog;

// Try to access Electron APIs from the correct location
try {
  // In Electron context, the APIs should be available globally
  // Let's try to access them directly
  const electron = require('electron');
  console.log('Electron import result:', typeof electron);
  
  if (typeof electron === 'string') {
    // This is the path to the executable, not the module
    console.log('Electron is returning path:', electron);
    
    // Try to access the APIs from the global context
    // In Electron, these should be available globally
    app = global.app || global.require('electron').app;
    BrowserWindow = global.BrowserWindow || global.require('electron').BrowserWindow;
    ipcMain = global.ipcMain || global.require('electron').ipcMain;
    dialog = global.dialog || global.require('electron').dialog;
    
    console.log('Trying to access APIs from global context...');
    console.log('app:', typeof app);
    console.log('BrowserWindow:', typeof BrowserWindow);
    console.log('ipcMain:', typeof ipcMain);
    console.log('dialog:', typeof dialog);
  } else {
    // Normal case - electron is the module
    app = electron.app;
    BrowserWindow = electron.BrowserWindow;
    ipcMain = electron.ipcMain;
    dialog = electron.dialog;
  }
} catch (error) {
  console.error('Error accessing Electron APIs:', error);
  process.exit(1);
}

console.log('Playwright to Azure CSV Converter starting...');

// Window reference to prevent garbage collection
let mainWindow;

const createWindow = () => {
  // Create the browser window with improved security settings
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
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
if (app && typeof app.whenReady === 'function') {
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
} else {
  console.error('App object is not available or invalid');
  process.exit(1);
}

// Secure IPC handlers for file operations
if (ipcMain && typeof ipcMain.handle === 'function') {
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

  // Handle app restart requests (for updates)
  ipcMain.on('request-restart', () => {
    app.relaunch();
    app.exit();
  });
} else {
  console.error('ipcMain is not available or invalid');
}

console.log('Main process setup complete');
