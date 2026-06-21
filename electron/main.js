const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const { startServer } = require('../server');

let mainWindow = null;
let runningServer = null;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(createMainWindow);
}

async function createMainWindow() {
  try {
    runningServer = await startServer({ port: 0, host: '127.0.0.1' });
  } catch (err) {
    dialog.showErrorBox(
      'Art-Net Config konnte nicht gestartet werden',
      `Der interne Art-Net Server konnte nicht starten.\n\n${err.message}`
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#080a0d',
    title: 'Art-Net Config',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(runningServer.url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (runningServer) {
    runningServer.close();
    runningServer = null;
  }
});
