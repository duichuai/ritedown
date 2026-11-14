import { unified, type Pluggable } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import type { Root } from 'mdast'

export type { Root } from 'mdast'

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
