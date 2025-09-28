const fs = require('fs');

const escapeCsv = (str) => {
  if (str === null || str === undefined || str === '') {
    return '';
  }
  const normalized = String(str);
  const needsQuotes = /[",\n]/.test(normalized);
  const escaped = normalized.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const config = {
  areaPath: 'Prometric\\Shared Services\\Automation\\Hydra',
  assignedTo: '',
  state: 'Design'
};
const testCases = [{
  title: 'Login Test',
  steps: [
    { action: 'Open login page', expectedResult: 'Page loads' },
    { action: 'Enter username', expectedResult: 'Username accepted' },
    { action: 'Enter password', expectedResult: 'Password accepted' }
  ]
}];

const header = ['ID','Work Item Type','Title','Test Step','Step Action','Step Expected','Area Path','Assigned To','State'];
const rows = [header.join(',')];

for (const testCase of testCases) {
  rows.push([
    '',
    'Test Case',
    escapeCsv(testCase.title),
    '',
    '',
    '',
    escapeCsv(config.areaPath),
    escapeCsv(config.assignedTo),
    escapeCsv(config.state)
  ].join(','));

  testCase.steps.forEach((step, index) => {
    rows.push([
      '',
      '',
      '',
      (index + 1).toString(),
      escapeCsv(step.action),
      escapeCsv(step.expectedResult),
      '',
      '',
      ''
    ].join(','));
  });
}

fs.writeFileSync('sample.csv', rows.join('\r\n'));
console.log('Wrote sample.csv with', rows.length - 1, 'rows');
