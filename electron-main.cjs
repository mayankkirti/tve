const { app, BrowserWindow, nativeTheme, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

// Set up IPC handler for save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog.showSaveDialog(win, options);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden', // Hides the default title bar, keeps window controls
    titleBarOverlay: { // Custom styling for Windows/Mac traffic lights and window controls
      color: '#18181b', // Background color matching the app's top bar (zinc-900)
      symbolColor: '#ffffff', // Window control icons (X, -, [])
      height: 32
    },
    icon: isDev ? path.join(__dirname, 'public', 'logo.png') : path.join(__dirname, 'dist', 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Force dark theme for context menus and native dialogs
  nativeTheme.themeSource = 'dark';
  
  // Hide menubar
  win.setMenuBarVisibility(false);

  if (isDev) {
    // In development mode, load Vite's local dev server
    win.loadURL('http://localhost:3000');
  } else {
    // In production mode, load the bundled index.html
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
