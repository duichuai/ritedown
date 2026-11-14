import { unified, type Pluggable } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import remarkGfmAlerts from '@ritedown/gfm-alerts'
import type { Root } from 'mdast'

export type { Root } from 'mdast'
export type { Pluggable } from 'unified'

/**
 * Syntax extensions available to the pipeline.
 * Ritedown core ships with zero extensions enabled by default —
 * callers opt in explicitly (see `builtin`).
 */
export interface RitedownOptions {
  /** remark/rehype plugins to extend the pipeline */
  extensions?: Pluggable[]
}

/** Built-in extension registry (GFM: tables, task lists, strikethrough, autolinks, footnotes, alerts) */
export const builtin = {
  gfm: remarkGfm,
} as const

/**
 * Descriptor for a Ritedown plugin: a named bundle of remark/rehype
 * extensions plus optional editor-side hooks.
 */
export interface RitedownPlugin {
  /** stable identifier used for enable/disable persistence */
  id: string
  /** display name (i18n keys or literal text) */
  name: string
  /** short description shown in the settings panel */
  description?: string
  /** remark (or array-form) plugin injected into the pipeline */
  remark?: Pluggable
  /** rehype plugin injected after remarkRehype */
  rehype?: Pluggable
  /** enabled when the user has never toggled it (default true) */
  defaultEnabled?: boolean
  /**
   * CodeMirror extension factory for editor-side syntax support.
   * Typed `unknown` so core keeps zero editor dependencies; callers
   * narrow the result to their own Extension type.
   */
  editorExtension?: () => unknown
}

/**
 * Plugins bundled with core, in canonical declaration order.
 * Order matters: callers must preserve it when assembling pipelines.
 */
export const builtinPlugins: RitedownPlugin[] = [
  {
    id: 'gfm',
    name: 'GFM',
    description: 'Tables, task lists, strikethrough, autolinks, footnotes',
    remark: builtin.gfm,
    defaultEnabled: true,
  },
  {
    id: 'gfmAlerts',
    name: 'GFM Alerts',
    description: '> [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION] blocks',
    remark: remarkGfmAlerts,
    defaultEnabled: true,
  },
]

function createProcessor(options: RitedownOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(options.extensions ?? [])
    .use(remarkRehype)
    .use(rehypeStringify)
}

/** remark-only pipeline (no rehype): used by parse() to stay in mdast */
function createParser(options: RitedownOptions = {}) {
  return unified().use(remarkParse).use(options.extensions ?? [])
}

/** Parse markdown into an mdast tree (CommonMark 0.31.2 + enabled extensions;
 * transformer-phase plugins like gemoji run too). */
export function parse(markdown: string, options?: RitedownOptions): Root {
  const processor = createParser(options)
  return processor.runSync(processor.parse(markdown)) as Root
}

/** Render markdown to HTML (CommonMark 0.31.2 + enabled extensions). */
export function render(markdown: string, options?: RitedownOptions): string {
  return String(createProcessor(options).processSync(markdown))
}
