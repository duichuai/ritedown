import { builtin, parse, type Root } from '@ritedown/core'
import remarkGemoji from 'remark-gemoji'
import remarkFrontmatter from 'remark-frontmatter'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'
import type * as mdast from 'mdast'
import type { FileTypeOptions } from './fileProvider'
import { provider } from './provider'

/**
 * Markdown -> .docx export. The mdast tree (CommonMark + GFM + emoji) is
 * converted into docx elements directly; math stays as its literal LaTeX
 * source (graceful degradation), images are embedded when fetchable and
 * degrade to placeholder text otherwise.
 */

const DOCX_FILE_TYPE: FileTypeOptions = {
  description: 'Word document',
  extensions: ['docx'],
}

const MONO_FONT = 'Consolas'
const CODE_BG = 'F6F8FA'
const QUOTE_COLOR = '59636E'
const BORDER_COLOR = 'D1D9E0'
const LINK_COLOR = '0563C1'
const MAX_IMAGE_WIDTH = 480

/** parse markdown for docx export: GFM + emoji + frontmatter awareness;
 * math is intentionally left as literal $...$ text */
export function parseForDocx(markdown: string): Root {
  return parse(markdown, {
    extensions: [builtin.gfm, remarkGemoji, [remarkFrontmatter, ['yaml']]],
  })
}

const HEADING_BY_DEPTH: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

interface InlineCtx {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  quote?: boolean
  link?: string
}

function baseRun(ctx: InlineCtx): {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  color?: string
  underline?: {}
} {
  return {
    ...(ctx.bold ? { bold: true } : {}),
    ...(ctx.italics ? { italics: true } : {}),
    ...(ctx.strike ? { strike: true } : {}),
    ...(ctx.quote ? { color: QUOTE_COLOR } : {}),
    ...(ctx.link ? { color: LINK_COLOR, underline: {} } : {}),
  }
}

/** embed an image when fetchable, else a gray placeholder run */
async function imageChild(node: mdast.Image): Promise<ParagraphChild> {
  const label = node.alt || node.url || 'image'
  try {
    if (!node.url) throw new Error('no src')
    const response = await fetch(node.url)
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width)
    const type = /png/i.test(blob.type)
      ? ('png' as const)
      : /gif/i.test(blob.type)
        ? ('gif' as const)
        : /bmp/i.test(blob.type)
          ? ('bmp' as const)
          : ('jpg' as const)
    return new ImageRun({
      type,
      data: new Uint8Array(await blob.arrayBuffer()),
      transformation: {
        width: Math.round(bitmap.width * scale),
        height: Math.round(bitmap.height * scale),
      },
    })
  } catch {
    return new TextRun({
      text: `[图片: ${label}]`,
      italics: true,
      color: QUOTE_COLOR,
    })
  }
}

async function inlineRuns(
  nodes: readonly mdast.PhrasingContent[],
  ctx: InlineCtx,
): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        runs.push(new TextRun({ text: node.value, ...baseRun(ctx) }))
        break
      case 'strong':
        runs.push(...(await inlineRuns(node.children, { ...ctx, bold: true })))
        break
      case 'emphasis':
        runs.push(...(await inlineRuns(node.children, { ...ctx, italics: true })))
        break
      case 'delete':
        runs.push(...(await inlineRuns(node.children, { ...ctx, strike: true })))
        break
      case 'inlineCode':
        runs.push(
          new TextRun({
            text: node.value,
            font: MONO_FONT,
            shading: { type: ShadingType.CLEAR, fill: CODE_BG },
          }),
        )
        break
      case 'link': {
        const children = await inlineRuns(node.children, { ...ctx, link: node.url })
        runs.push(new ExternalHyperlink({ link: node.url, children }))
        break
      }
      case 'break':
        runs.push(new TextRun({ break: 1 }))
        break
      case 'image':
        runs.push(await imageChild(node))
        break
      case 'footnoteReference':
        runs.push(
          new TextRun({
            text: `[${node.identifier}]`,
            superScript: true,
            ...baseRun(ctx),
          }),
        )
        break
      default:
        // html / emoji nodes (already merged into text) / others: skip
        break
    }
  }
  return runs
}

function codeBlockParagraph(node: mdast.Code): Paragraph {
  const lines = node.value.replace(/\n$/, '').split('\n')
  const runs = lines.map(
    (line, index) =>
      new TextRun({
        text: line,
        font: MONO_FONT,
        ...(index > 0 ? { break: 1 } : {}),
      }),
  )
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODE_BG },
    children: runs,
    spacing: { after: 160 },
  })
}

function quoteParagraph(children: ParagraphChild[]): Paragraph {
  return new Paragraph({
    indent: { left: 720 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: BORDER_COLOR, space: 12 },
    },
    children,
    spacing: { after: 120 },
  })
}

function alignmentFor(align: mdast.AlignType | null) {
  if (align === 'left') return AlignmentType.LEFT
  if (align === 'right') return AlignmentType.RIGHT
  if (align === 'center') return AlignmentType.CENTER
  return undefined
}

async function buildTable(node: mdast.Table): Promise<Table> {
  const rows = await Promise.all(
    node.children.map(async (row, rowIndex) => {
      const header = rowIndex === 0
      const cells = await Promise.all(
        row.children.map(async (cell, columnIndex) =>
          new TableCell({
            width: {
              size: Math.floor(100 / Math.max(row.children.length, 1)),
              type: WidthType.PERCENTAGE,
            },
            ...(header
              ? { shading: { type: ShadingType.CLEAR, fill: CODE_BG } }
              : {}),
            children: [
              new Paragraph({
                alignment: alignmentFor(node.align?.[columnIndex] ?? null),
                children: await inlineRuns(cell.children, header ? { bold: true } : {}),
              }),
            ],
          }),
        ),
      )
      return new TableRow({ tableHeader: header, children: cells })
    }),
  )
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

async function listItemParagraphs(
  item: mdast.ListItem,
  opts: { ordered: boolean; index: number; level: number },
): Promise<(Paragraph | Table)[]> {
  const isTask = item.checked === true || item.checked === false
  const indent = { left: 720 * (opts.level + 1), hanging: 360 }
  const out: (Paragraph | Table)[] = []
  for (const child of item.children) {
    if (child.type === 'paragraph') {
      const runs: ParagraphChild[] = []
      if (isTask) {
        runs.push(new TextRun({ text: item.checked ? '☑ ' : '☐ ' }))
      } else if (opts.ordered) {
        runs.push(new TextRun({ text: `${opts.index}. ` }))
      }
      runs.push(...(await inlineRuns(child.children, {})))
      out.push(
        new Paragraph({
          ...(isTask || opts.ordered
            ? { indent }
            : { bullet: { level: Math.min(opts.level, 8) } }),
          children: runs,
          spacing: { after: 60 },
        }),
      )
    } else if (child.type === 'list') {
      out.push(...(await listBlocks(child, opts.level + 1)))
    } else {
      out.push(...(await blockNodes([child], {})))
    }
  }
  return out
}

async function listBlocks(
  node: mdast.List,
  level: number,
): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = []
  let index = (node.start ?? 1) - 1
  for (const item of node.children) {
    if (node.ordered) index += 1
    out.push(
      ...(await listItemParagraphs(item, {
        ordered: node.ordered === true,
        index,
        level,
      })),
    )
  }
  return out
}

interface BlockCtx {
  quote?: boolean
}

async function blockNodes(
  nodes: readonly mdast.RootContent[],
  ctx: BlockCtx,
): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        out.push(
          new Paragraph({
            heading: HEADING_BY_DEPTH[Math.min(Math.max(node.depth, 1), 6)],
            children: await inlineRuns(node.children, ctx),
          }),
        )
        break
      case 'paragraph': {
        const runs = await inlineRuns(node.children, ctx)
        if (ctx.quote) out.push(quoteParagraph(runs))
        else out.push(new Paragraph({ children: runs, spacing: { after: 120 } }))
        break
      }
      case 'code':
        out.push(codeBlockParagraph(node))
        break
      case 'blockquote': {
        for (const child of node.children) {
          if (child.type === 'paragraph') {
            out.push(
              quoteParagraph(await inlineRuns(child.children, { ...ctx, quote: true })),
            )
          } else {
            out.push(...(await blockNodes([child], ctx)))
          }
        }
        break
      }
      case 'list':
        out.push(...(await listBlocks(node, 0)))
        break
      case 'table':
        out.push(await buildTable(node))
        break
      case 'thematicBreak':
        out.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
            },
            children: [],
            spacing: { after: 160 },
          }),
        )
        break
      default:
        // yaml / html / footnoteDefinition / definitions: skip
        break
    }
  }
  return out
}

/** mdast -> docx body elements (async: images are fetched during conversion) */
export async function mdastToDocxBody(
  root: Root,
): Promise<(Paragraph | Table)[]> {
  return blockNodes(root.children, {})
}

/** Convert the active document to a .docx file and save it (anchor-download
 * fallback when the provider cannot save). */
export async function exportDocx(
  markdown: string,
  suggestedName: string,
): Promise<void> {
  const body = await mdastToDocxBody(parseForDocx(markdown))
  const blob = await Packer.toBlob(new Document({ sections: [{ children: body }] }))

  if (provider.fsSupported) {
    try {
      await provider.saveBlob(suggestedName, blob, DOCX_FILE_TYPE)
      return // saved, or the user cancelled the dialog
    } catch (err) {
      console.warn('docx export save failed:', err)
      // fall through to anchor download
    }
  }
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = suggestedName
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}
