const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('extoboost', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  isDesktop: true,
});
