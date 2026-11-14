import {
  builtinPlugins,
  type Pluggable,
  type RitedownPlugin,
} from '@ritedown/core'
import remarkGemoji from 'remark-gemoji'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMath from 'remark-math'
import { remarkFrontmatterTable } from './frontmatter'
import { remarkMathToCode } from './mathPlugin'
import { remarkLineMarkers } from './lineMarkers'

/**
 * Editor-side plugin definitions, appended after core's builtinPlugins.
 * The order is canonical and pipeline-sensitive: mathToCode must come
 * right after math, frontmatterTable right after frontmatter. Callers
 * (resolveExtensions) must preserve declaration order.
 */
const editorPlugins: RitedownPlugin[] = [
  {
    id: 'gemoji',
    name: 'Emoji',
    description: ':tada: -> 🎉 shortcodes',
    remark: remarkGemoji,
    defaultEnabled: true,
  },
  {
    id: 'math',
    name: 'Math',
    description: 'LaTeX blocks ($$..$$) and inline math ($..$)',
    remark: remarkMath,
    defaultEnabled: true,
  },
  {
    id: 'mathToCode',
    name: 'Math fallback',
    description: 'Render math as styled code text (no KaTeX at runtime)',
    remark: remarkMathToCode,
    defaultEnabled: true,
  },
  {
    id: 'frontmatter',
    name: 'Front matter',
    description: 'YAML front matter recognition (--- block)',
    remark: [remarkFrontmatter, ['yaml']] as Pluggable,
    defaultEnabled: true,
  },
  {
    id: 'frontmatterTable',
    name: 'Front matter table',
    description: 'Render front matter as a metadata table',
    remark: remarkFrontmatterTable,
    defaultEnabled: true,
  },
  {
    id: 'lineMarkers',
    name: 'Line markers',
    description: 'Live line markers for scroll sync (recommended)',
    remark: remarkLineMarkers,
    defaultEnabled: true,
  },
]

/** All registered plugins in canonical order (core first, then editor). */
export function listPlugins(): RitedownPlugin[] {
  return [...builtinPlugins, ...editorPlugins]
}

const STORAGE_KEY = 'ritedown-plugins'

/** Read the persisted disabled-plugin id list (diff against the registry,
 * so newly added plugins stay enabled for existing users). */
export function loadDisabledIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveDisabledIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* storage unavailable — settings stay session-only */
  }
}

/** Enabled = present in the registry and not in the disabled list. */
export function isEnabled(plugin: RitedownPlugin, disabledIds: string[]): boolean {
  return !disabledIds.includes(plugin.id)
}

/** Assemble the unified extensions array from enabled plugin ids,
 * preserving canonical registry order (never sort by id). */
export function resolveExtensions(enabledIds: string[]): Pluggable[] {
  const enabled = new Set(enabledIds)
  const exts: Pluggable[] = []
  for (const plugin of listPlugins()) {
    if (!enabled.has(plugin.id)) continue
    if (plugin.remark) exts.push(plugin.remark)
  }
  for (const plugin of listPlugins()) {
    if (!enabled.has(plugin.id)) continue
    if (plugin.rehype) exts.push(plugin.rehype)
  }
  return exts
}

/** Ids of plugins enabled by default, minus the disabled ones. */
export function enabledPluginIds(disabledIds: string[]): string[] {
  return listPlugins()
    .filter((p) => p.defaultEnabled !== false && isEnabled(p, disabledIds))
    .map((p) => p.id)
}
