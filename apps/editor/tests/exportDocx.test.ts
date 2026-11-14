import { beforeAll, describe, expect, it } from 'vitest'
import { Document, Packer } from 'docx'
import JSZip from 'jszip'
import { mdastToDocxBody, parseForDocx } from '../src/lib/exportDocx'

/**
 * The conversion output is asserted on the generated OOXML: the mdast tree
 * is packed into a real .docx buffer and word/document.xml is inspected.
 */

let xml: string

beforeAll(async () => {
  const body = await mdastToDocxBody(
    parseForDocx(
      [
        '---',
        'title: meta only',
        '---',
        '',
        '# Title One',
        '',
        'Plain **bold** *italic* ~~strike~~ `inline` :tada:',
        '',
        'Math stays literal: $E = mc^2$',
        '',
        'A [link](https://example.com) here.',
        '',
        '- alpha',
        '  - nested',
        '- [x] done task',
        '- [ ] open task',
        '',
        '1. first',
        '2. second',
        '',
        '```js',
        'const x = 1',
        'const y = 2',
        '```',
        '',
        '> quoted wisdom',
        '',
        '| a | b |',
        '|---|:-:|',
        '| 1 | 2 |',
        '',
        '---',
        '',
        '<div>raw html skipped</div>',
      ].join('\n'),
    ),
  )
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: body }] }))
  const zip = await JSZip.loadAsync(buffer)
  xml = (await zip.file('word/document.xml')!.async('string')) as string
})

describe('docx export', () => {
  it('renders headings with Word heading styles', () => {
    expect(xml).toContain('Heading1')
    expect(xml).toContain('<w:t xml:space="preserve">Title One</w:t>')
  })

  it('renders run marks: bold, italic, strike, inline code', () => {
    expect(xml).toContain('<w:t xml:space="preserve">bold</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">italic</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">strike</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">inline</w:t>')
    expect(xml).toContain('<w:b/>')
    expect(xml).toContain('<w:i/>')
    expect(xml).toContain('<w:strike/>')
    // inline code uses a monospace font + shading
    expect(xml).toContain('w:ascii="Consolas"')
    expect(xml.toUpperCase()).toContain('F6F8FA')
  })

  it('keeps math as literal LaTeX text', () => {
    expect(xml).toContain('E = mc^2')
  })

  it('converts emoji shortcodes', () => {
    expect(xml).toContain('\u{1F389}')
    expect(xml).not.toContain(':tada:')
  })

  it('hyperlinks external URLs', () => {
    expect(xml).toContain('<w:hyperlink')
    expect(xml).toContain('<w:u ')
  })

  it('renders bullet, nested, task and ordered lists', () => {
    expect(xml).toContain('<w:t xml:space="preserve">alpha</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">nested</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">1. </w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">2. </w:t>')
    expect(xml).toContain('☑ ')
    expect(xml).toContain('☐ ')
    // bullet numbering reference
    expect(xml).toContain('<w:numPr>')
    // task items use hanging indent, not bullets
    expect(xml).toContain('<w:ind')
  })

  it('renders code blocks with line breaks preserved', () => {
    expect(xml).toContain('<w:t xml:space="preserve">const x = 1</w:t>')
    expect(xml).toContain('<w:t xml:space="preserve">const y = 2</w:t>')
    expect(xml).toContain('<w:br/>')
  })

  it('renders blockquotes with indent and border', () => {
    expect(xml).toContain('<w:t xml:space="preserve">quoted wisdom</w:t>')
    expect(xml).toContain('<w:left')
  })

  it('renders tables with a shaded header row', () => {
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('<w:tcW')
    expect(xml).toContain('<w:t xml:space="preserve">a</w:t>')
    // column b is center-aligned per the md `|:-:|`
    expect(xml).toContain('<w:jc w:val="center"/>')
  })

  it('renders thematic breaks as horizontal rules', () => {
    expect(xml).toContain('<w:pBdr>')
  })

  it('skips frontmatter and raw html', () => {
    expect(xml).not.toContain('meta only')
    expect(xml).not.toContain('raw html skipped')
  })
})
