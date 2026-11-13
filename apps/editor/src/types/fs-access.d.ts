// File System Access API picker methods — declared as optional to feature-
// detect in Firefox/Safari where they are missing.
interface Window {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>
}
