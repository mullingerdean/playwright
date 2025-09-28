// Debug script to find the correct Electron module
console.log('=== FINDING CORRECT ELECTRON MODULE ===');

const path = require('path');
const fs = require('fs');

// Try to find the actual Electron module
const electronPath = require('electron');
console.log('Electron path from require:', electronPath);

// Check if the path exists
console.log('Path exists:', fs.existsSync(electronPath));

// Try to access the Electron module from the asar file
const asarPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Resources', 'default_app.asar');
console.log('ASAR path:', asarPath);
console.log('ASAR exists:', fs.existsSync(asarPath));

// Try to require from the asar file
try {
  const asar = require('asar');
  console.log('ASAR module available:', typeof asar);
} catch (error) {
  console.log('ASAR module not available:', error.message);
}

// Try to access the Electron module from the correct location
try {
  const electronModulePath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Resources', 'app.asar');
  console.log('App ASAR path:', electronModulePath);
  console.log('App ASAR exists:', fs.existsSync(electronModulePath));
} catch (error) {
  console.log('Error checking app ASAR:', error.message);
}
