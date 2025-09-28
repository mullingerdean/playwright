// Simple test to see what's happening with Electron
console.log('=== TESTING ELECTRON ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

try {
  const electron = require('electron');
  console.log('Electron import result type:', typeof electron);
  console.log('Electron import result:', electron);
  
  if (typeof electron === 'string') {
    console.log('Electron is a string (path) - this is the problem!');
  } else {
    console.log('Electron is an object - this should work');
    console.log('Available properties:', Object.keys(electron));
  }
} catch (error) {
  console.error('Error importing electron:', error);
}
