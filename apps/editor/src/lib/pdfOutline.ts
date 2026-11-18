/**
 * PDF bookmarks (outline) for exported documents.
 *
 * The webview's print pipeline (Skia/PDF) only writes page content, so
 * headings never become PDF outlines. We therefore measure the headings in
 * the print snapshot, then post-process the generated file with pdf-lib and
 * inject an /Outlines tree pointing at each heading's page.
 *
 * Page numbers come from the heading's offset in the print layout, divided by
 * the printable page height; CSS `break-inside/break-after: avoid` rules can
 * shift real breaks by a bit, so destinations are close rather than exact.
 */

/** Print geometry; keep in sync with print_settings() in
 * apps/desktop/src-tauri/src/lib.rs (A4 portrait, 12 mm margins). */
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MARGIN_MM = 12
const PX_PER_MM = 96 / 25.4
const PX_TO_PT = 72 / 96
const PT_PER_MM = 72 / 25.4

/** Width of the printable area, i.e. the width the snapshot lays out at. */
export const PRINT_CONTENT_WIDTH = `${PAGE_WIDTH_MM - MARGIN_MM * 2}mm`

const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_MM - MARGIN_MM * 2) * PX_PER_MM
const CONTENT_TOP_PT = (PAGE_HEIGHT_MM - MARGIN_MM) * PT_PER_MM

export interface PdfBookmark {
  title: string
  level: number
  pageIndex: number
  /** top edge in PDF points, measured from the page bottom */
  y: number
}

/** Headings of the print snapshot mapped to estimated page positions. */
export function collectBookmarks(root: HTMLElement): PdfBookmark[] {
  const rootTop = root.getBoundingClientRect().top
  const marks: PdfBookmark[] = []
  for (const el of Array.from(root.querySelectorAll('h1, h2, h3'))) {
    const title = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
    if (!title) continue
    const top = Math.max(0, el.getBoundingClientRect().top - rootTop)
    marks.push({
      title,
      level: Number(el.tagName[1]),
      pageIndex: Math.floor(top / CONTENT_HEIGHT_PX),
      y: CONTENT_TOP_PT - (top % CONTENT_HEIGHT_PX) * PX_TO_PT,
    })
  }
  return marks
}

/** Insert an /Outlines tree (H1 > H2 > H3) into an existing PDF. */
export async function addBookmarks(
  bytes: Uint8Array,
  marks: PdfBookmark[],
): Promise<Uint8Array> {
  const { PDFDocument, PDFHexString, PDFName } = await import('pdf-lib')

  const doc = await PDFDocument.load(bytes)
  const context = doc.context
  const pageRefs = doc.getPages().map((page) => page.ref)

  interface Node {
    mark: PdfBookmark
    ref: ReturnType<typeof context.nextRef>
    children: Node[]
    parent: Node | null
  }

  const roots: Node[] = []
  const stack: Node[] = []
  for (const mark of marks) {
    const node: Node = {
      mark,
      ref: context.nextRef(),
      children: [],
      parent: null,
    }
    while (stack.length && stack[stack.length - 1].mark.level >= mark.level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1] ?? null
    node.parent = parent
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  if (!roots.length) return bytes

  const countDescendants = (node: Node): number =>
    node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)

  const outlineRef = context.nextRef()
  const allNodes: Node[] = []
  const visit = (node: Node) => {
    allNodes.push(node)
    node.children.forEach(visit)
  }
  roots.forEach(visit)

  for (const node of allNodes) {
    const pageRef = pageRefs[Math.min(node.mark.pageIndex, pageRefs.length - 1)]
    const siblings = node.parent ? node.parent.children : roots
    const index = siblings.indexOf(node)
    const dict = context.obj({
      Title: PDFHexString.fromText(node.mark.title),
      Parent: node.parent ? node.parent.ref : outlineRef,
      Dest: [pageRef, PDFName.of('FitH'), node.mark.y],
    })
    if (index > 0) dict.set(PDFName.of('Prev'), siblings[index - 1].ref)
    if (index < siblings.length - 1) {
      dict.set(PDFName.of('Next'), siblings[index + 1].ref)
    }
    if (node.children.length) {
      dict.set(PDFName.of('First'), node.children[0].ref)
      dict.set(PDFName.of('Last'), node.children[node.children.length - 1].ref)
      // positive count = expanded by default
      dict.set(PDFName.of('Count'), context.obj(countDescendants(node)))
    }
    context.assign(node.ref, dict)
  }

  const outline = context.obj({
    Type: PDFName.of('Outlines'),
    First: roots[0].ref,
    Last: roots[roots.length - 1].ref,
    // expanded by default: all descendants visible
    Count: context.obj(allNodes.length),
  })
  context.assign(outlineRef, outline)
  doc.catalog.set(PDFName.of('Outlines'), outlineRef)

  return doc.save()
}
