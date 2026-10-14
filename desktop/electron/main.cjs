const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');

const CUSTOM_USER_AGENT = 'PinkoApp-Desktop/1.0.0';

// Set fallback user agent before app ready
app.userAgentFallback = CUSTOM_USER_AGENT;

let mainWindow;

function createWindow() {
  // Override user-agent for all web requests so Supabase Kong gateway never rejects with browser secret key error
  if (session && session.defaultSession) {
    session.defaultSession.setUserAgent(CUSTOM_USER_AGENT);
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = CUSTOM_USER_AGENT;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Pinko App Desktop — نظام إدارة المبيعات والمخازن والتوزيع',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.webContents.setUserAgent(CUSTOM_USER_AGENT);

  Menu.setApplicationMenu(null);

  // Load the built dist/index.html
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
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
