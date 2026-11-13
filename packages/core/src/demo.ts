import { render, builtin } from './index.js'
import remarkGfmAlerts from '@ritedown/gfm-alerts'

const sample = `# Ritedown demo

A **free and open-source** Markdown editor — ~~Typora~~ who?

## GFM features

| Feature | Supported |
| --- | --- |
| Tables | yes |
| Task lists | yes |
| Alerts | yes |

- [x] CommonMark 0.31.2
- [ ] WYSIWYG mode

> [!NOTE]
> GFM alerts render natively.

Use footnotes[^1] and www.example.com autolinks.

[^1]: like this one.
`

const html = render(sample, { extensions: [builtin.gfm, remarkGfmAlerts] })
console.log(html)
