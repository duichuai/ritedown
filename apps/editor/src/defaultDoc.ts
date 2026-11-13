export const DEFAULT_DOC = `# Ritedown

rite (write) + down (markdown) — write it down.

支持最新 Markdown 标准的开源编辑器，左侧输入，右侧实时渲染。

## CommonMark

段落、**加粗**、*斜体*、\`行内代码\`、[链接](https://duichuai.com)、图片、引用、有序/无序列表、代码块、水平分割线：

---

## GFM（已启用）

### 表格

| 功能 | 状态 |
| ---- | ---- |
| 源码编辑 | ✅ |
| 实时预览 | ✅ |

### 任务列表

- [x] monorepo 搭建
- [x] core 渲染管线
- [ ] M1 编辑器

### 删除线与自动链接

~~废弃的写法~~，访问 https://github.com/duichuai/ritedown

### 提示块（GFM Alerts）

> [!NOTE]
> 这是由 @ritedown/gfm-alerts 扩展渲染的提示块。

> [!WARNING]
> 注意渲染效果。

## 代码高亮（Shiki）

\`\`\`ts
// 双主题高亮，跟随系统亮暗切换
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## 数学公式（KaTeX）

行内公式 $E = mc^2$，块级公式：

$$
\\int_0^\\infty e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}
$$

## 图表（Mermaid）

\`\`\`mermaid
flowchart LR
  A[输入 Markdown] --> B{渲染管线}
  B --> C[代码高亮]
  B --> D[图表]
  B --> E[预览]
\`\`\`

`
