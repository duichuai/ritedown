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

/** Parse markdown into an mdast tree (CommonMark 0.31.2 + enabled extensions). */
export function parse(markdown: string, options?: RitedownOptions): Root {
  return createProcessor(options).parse(markdown) as Root
}

/** Render markdown to HTML (CommonMark 0.31.2 + enabled extensions). */
export function render(markdown: string, options?: RitedownOptions): string {
  return String(createProcessor(options).processSync(markdown))
}
