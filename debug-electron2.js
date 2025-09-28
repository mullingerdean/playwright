// Debug script to check Electron APIs
console.log('=== CHECKING ELECTRON APIS ===');

// Check if we're running in Electron context
console.log('process.versions:', process.versions);
console.log('process.versions.electron:', process.versions.electron);

// Try different ways to access Electron APIs
console.log('\n=== TRYING DIFFERENT IMPORT METHODS ===');

// Method 1: Direct require
try {
  const electron = require('electron');
  console.log('Method 1 - Direct require:', typeof electron);
} catch (error) {
  console.error('Method 1 failed:', error.message);
}

// Method 2: Check if APIs are available globally
try {
  console.log('Method 2 - Global app:', typeof global.app);
  console.log('Method 2 - Global BrowserWindow:', typeof global.BrowserWindow);
} catch (error) {
  console.error('Method 2 failed:', error.message);
}

// Method 3: Check process.versions for electron
if (process.versions.electron) {
  console.log('Method 3 - Running in Electron context, version:', process.versions.electron);
} else {
  console.log('Method 3 - NOT running in Electron context');
}
