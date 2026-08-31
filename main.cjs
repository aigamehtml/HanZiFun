/**
 * 汉字 Fun - Electron 主进程
 * 作用：加载本地 dist/index.html，提供原生窗口 + PDF 保存对话框
 *
 * 用 .cjs 后缀是因为 package.json 里 "type": "module"，
 * Electron 主进程继续用 CommonJS 最稳。
 */
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const DIST_DIR = path.join(__dirname, 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: '汉字 Fun · 写字练习本生成器',
    backgroundColor: '#fafafa',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadFile(path.join(DIST_DIR, 'index.html'));

  // 外链用系统默认浏览器打开，不要在 Electron 窗口内打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 拒绝 PWA 的 Service Worker / 权限请求（桌面版不需要）
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(false); // 拒绝所有：通知、摄像头等
  });
}

// PDF 保存对话框：渲染进程调用 window.electronAPI.savePdf(data, name)
ipcMain.handle('save-pdf', async (event, { data, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(event.sender, {
    title: '保存 PDF',
    defaultPath: defaultName || 'hanzi-worksheet.pdf',
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;

  // IPC 会丢失 Uint8Array 的缓冲，需要还原
  const buf = Buffer.from(data.data || data);
  await fs.promises.writeFile(filePath, buf);
  return filePath;
});

// 打开外部文件对话框（可选：导入已有练习文本）
ipcMain.handle('open-text-file', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(event.sender, {
    title: '打开文本文件',
    filters: [
      { name: '文本文件', extensions: ['txt', 'md', 'json'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return fs.promises.readFile(filePaths[0], 'utf8');
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: '关于 汉字 Fun',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              title: '关于 汉字 Fun',
              message: '汉字 Fun',
              detail: [
                '离线中文写字练习本生成器',
                '',
                '数据来源：Make Me A Hanzi (MIT License)',
                '字体：AR PL UKai CN (Arphic Public License)',
                '',
                '源代码：https://github.com/aigamehtml/HanZiFun',
              ].join('\n'),
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
