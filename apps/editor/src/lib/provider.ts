/**
 * Runtime selection of the file access layer: the Tauri desktop shell gets
 * the path-based fs/dialog plugin implementation, every browser gets the
 * File System Access API implementation.
 */

import { isTauri } from './fileProvider'
import { desktopProvider } from './providerDesktop'
import { webProvider } from './providerWeb'
import type { FileProvider } from './fileProvider'

/** the active file access layer for this environment */
export const provider: FileProvider = isTauri() ? desktopProvider : webProvider
