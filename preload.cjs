/**
 * 预加载脚本：给渲染进程暴露安全的 Electron API
 * 用 .cjs 后缀是因为 package.json 里 "type": "module"
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** 保存 PDF 到本地：data 是 Uint8Array，defaultName 是默认文件名 */
  savePdf: (data, defaultName) => ipcRenderer.invoke('save-pdf', { data, defaultName }),
  /** 打开文本文件，返回文件内容 */
  openTextFile: () => ipcRenderer.invoke('open-text-file'),
  platform: process.platform,
  isElectron: true,
});
