// Debug script to check what's happening with Electron
console.log('=== DEBUGGING ELECTRON IMPORT ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Arch:', process.arch);

try {
  const electron = require('electron');
  console.log('Electron import result type:', typeof electron);
  console.log('Electron import result:', electron);
  
  if (typeof electron === 'string') {
    console.log('Electron is a string (path):', electron);
  } else if (typeof electron === 'object') {
    console.log('Electron is an object with keys:', Object.keys(electron));
    console.log('app property:', typeof electron.app);
    console.log('BrowserWindow property:', typeof electron.BrowserWindow);
  }
} catch (error) {
  console.error('Error importing electron:', error);
}
