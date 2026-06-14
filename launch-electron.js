// Wrapper: deletes ELECTRON_RUN_AS_NODE before spawning Electron
// VSCode terminal sets this env var, which breaks Electron
delete process.env.ELECTRON_RUN_AS_NODE;
const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('./node_modules/electron');
const args = process.argv.slice(2);
console.log('[Launcher] Removing ELECTRON_RUN_AS_NODE and launching Electron...');

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: { ...process.env }, // ELECTRON_RUN_AS_NODE already deleted above
  windowsHide: false,
});

child.on('close', (code) => process.exit(code));
child.on('error', (err) => {
  console.error('[Launcher] Failed:', err.message);
  process.exit(1);
});
