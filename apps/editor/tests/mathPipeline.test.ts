import { describe, expect, it } from 'vitest'
import { render } from '@ritedown/core'
import remarkMath from 'remark-math'
import { remarkMathToCode } from '../src/lib/mathPlugin'

describe('math pipeline', () => {
  it('renders inline math as code.language-math', () => {
    const html = render('a $E=mc^2$ b', {
      extensions: [remarkMath, remarkMathToCode],
    })
    expect(html).toContain('<code class="language-math">')
    expect(html).toContain('E=mc^2')
    expect(html).not.toContain('inlineMath')
  })

  it('renders block math as pre > code.language-math', () => {
    const html = render('$$\nx^2\n$$', {
      extensions: [remarkMath, remarkMathToCode],
    })
    expect(html).toContain('language-math')
    expect(html).toContain('x^2')
  })
})
