const { app, BrowserWindow } = require('electron');
console.log('process.type:', process.type);
console.log('app:', typeof app);
app.whenReady().then(() => {
  console.log('Electron app ready!');
  app.quit();
});
