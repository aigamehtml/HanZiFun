/**
 * 汉字 Fun - Electron 主进程
 * 加载 dist/index.html，提供原生窗口 + PDF 保存对话框
 */
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function getResPath(subPath) {
  // 打包后文件在 app.asar 内，__dirname 自动解析到 asar 内
  if (app.isPackaged) {
    // electron-builder 会把 dist/ 打进 asar，路径直接拼接即可
    return path.join(__dirname, '..', 'dist', subPath);
  }
  return path.join(__dirname, 'dist', subPath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: '汉字 Fun · 写字练习本生成器',
    backgroundColor: '#fafafa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const html = getResPath('index.html');
  win.loadFile(html);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 桌面版不需要 Service Worker / 通知等权限
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_, __, cb) => cb(false));
}

// PDF 保存对话框
ipcMain.handle('save-pdf', async (event, { data, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(event.sender, {
    title: '保存 PDF',
    defaultPath: defaultName || 'hanzi-worksheet.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;
  const buf = Buffer.from(data.data || data);
  await fs.promises.writeFile(filePath, buf);
  return filePath;
});

// 打开文本文件
ipcMain.handle('open-text-file', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(event.sender, {
    title: '打开文本文件',
    filters: [{ name: '文本', extensions: ['txt', 'md', 'json'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return fs.promises.readFile(filePaths[0], 'utf8');
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{
        label: '关于 汉字 Fun',
        click: () => {
          dialog.showMessageBox({
            title: '关于',
            message: '汉字 Fun',
            detail: '离线中文写字练习本生成器\n\n笔顺数据：Make Me A Hanzi (MIT)\n字体：AR PL UKai CN (Arphic)\n源码：https://github.com/aigamehtml/HanZiFun',
          });
        },
      }],
    },
  ]));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
