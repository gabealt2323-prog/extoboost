const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const BACKEND_URL = process.env.EXOBOOST_BACKEND_URL || 'http://localhost:4000';
const WEB_APP_URL = process.env.EXOBOOST_WEB_URL || 'http://localhost:3000';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Extoboost Key System',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0a0a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      disableBlinkFeatures: 'Auxclick',
    },
  });

  mainWindow.loadURL(WEB_APP_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(WEB_APP_URL) && !url.startsWith(BACKEND_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
