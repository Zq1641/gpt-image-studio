import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '../shared/ipc'
import type { Api } from '../shared/ipc'

const api: Api = {
  getSettings: () => ipcRenderer.invoke(CH.settingsGet),
  saveSettings: (patch) => ipcRenderer.invoke(CH.settingsSet, patch),
  addModel: (name) => ipcRenderer.invoke(CH.modelsAdd, name),
  deleteModel: (name) => ipcRenderer.invoke(CH.modelsDelete, name),
  addPreset: (p) => ipcRenderer.invoke(CH.presetsAdd, p),
  updatePreset: (p) => ipcRenderer.invoke(CH.presetsUpdate, p),
  deletePreset: (id) => ipcRenderer.invoke(CH.presetsDelete, id),
  setActivePreset: (id) => ipcRenderer.invoke(CH.presetsSetActive, id),
  addSkill: (input) => ipcRenderer.invoke(CH.skillsAdd, input),
  deleteSkill: (id) => ipcRenderer.invoke(CH.skillsDelete, id),
  clearHistory: () => ipcRenderer.invoke(CH.historyClear),
  downloadHistoryFile: (filename) => ipcRenderer.invoke(CH.historyDownload, filename),
  downloadHistoryFiles: (filenames) => ipcRenderer.invoke(CH.historyDownloadAll, filenames),
  getCacheStats: () => ipcRenderer.invoke(CH.cacheStats),
  clearGeneratedImages: () => ipcRenderer.invoke(CH.cacheClearImages),
  clearRefCache: () => ipcRenderer.invoke(CH.cacheClearRefs),
  clearAllCache: () => ipcRenderer.invoke(CH.cacheClearAll),
  generate: (req) => ipcRenderer.invoke(CH.generateRun, req),
  cancel: (requestId) => ipcRenderer.invoke(CH.generateCancel, { requestId }),
  listHistory: () => ipcRenderer.invoke(CH.historyList),
  deleteHistory: (id) => ipcRenderer.invoke(CH.historyDelete, { id }),
}

contextBridge.exposeInMainWorld('api', api)
