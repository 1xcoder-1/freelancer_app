import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sendQuickCapture: (data: unknown) => ipcRenderer.send('quick-capture', data),
});
