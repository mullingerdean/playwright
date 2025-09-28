// Simple test to see if we can access Electron APIs
console.log('=== SIMPLE ELECTRON TEST ===');

// Try to access Electron APIs directly
try {
  // In Electron context, these should be available
  const { app, BrowserWindow } = require('electron');
  console.log('Successfully imported Electron APIs');
  console.log('app type:', typeof app);
  console.log('BrowserWindow type:', typeof BrowserWindow);
  
  if (typeof app !== 'undefined') {
    console.log('App is available, creating window...');
    
    app.whenReady().then(() => {
      console.log('App is ready!');
      
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: true
        }
      });
      
      win.loadURL('data:text/html;charset=utf-8,<h1>Hello World!</h1><p>Electron is working!</p>');
      console.log('Window created and loaded');
    });
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  } else {
    console.log('App is undefined - Electron APIs not available');
  }
} catch (error) {
  console.error('Error accessing Electron APIs:', error);
}
