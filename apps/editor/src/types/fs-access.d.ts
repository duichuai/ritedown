// File System Access API picker methods — declared as optional to feature-
// detect in Firefox/Safari where they are missing.
interface Window {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>
}

// permission methods from the FS Access spec, not yet in TS DOM lib
interface FileSystemHandle {
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}
