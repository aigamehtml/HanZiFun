# 汉字 Fun Design Philosophy

## Product Shape

汉字 Fun is not a landing page and not a form-based PDF generator. It is a lightweight print design tool for Chinese handwriting practice sheets.

The default screen should immediately communicate the product:

```text
Left: settings
Right: real paper preview
```

Users should understand the workflow in a few seconds: type characters, adjust options, inspect the paper, print or save as PDF.

The app should also work well when installed to a phone home screen as a PWA. Mobile is not a separate product, but the layout must adapt deliberately.

## Design Principles

### 1. The Paper Is the Product

The right side paper preview is the primary surface. It should look like an actual sheet of paper, with accurate proportions and visible printable content.

The preview should never feel like a decorative mockup. It is the real output.

Requirements:

- Show a paper sheet on first load.
- Default to A4 portrait.
- Preserve real paper aspect ratio.
- Keep paper centered on a neutral workspace background.
- Show multiple pages as a vertical stack.
- Avoid hiding the paper behind setup steps.

### 2. Settings Are Direct Manipulation

All settings must be WYSIWYG. A control change updates the paper immediately.

There should be no required "Generate" action. A refresh or regenerate button may exist only as a fallback/debug affordance, not as the main workflow.

Examples:

- Typing characters updates the preview.
- Choosing a built-in content template updates or appends to the input.
- Changing template updates the preview.
- Switching A5/A4/A3/Letter changes paper size.
- Switching portrait/landscape changes paper orientation.
- Changing grid size reflows rows and columns.
- Toggling stroke numbers removes/adds numbers on the paper.
- Changing trace opacity updates traced characters immediately.
- Editing title/name/class/date updates the page header immediately.

### 3. Quiet, Useful, Printable

The visual design should feel calm and practical. Parents and teachers are preparing a printable artifact, not browsing marketing content.

Use:

- restrained typography
- clear section labels
- compact controls
- neutral backgrounds
- crisp paper contrast
- print-friendly colors

Avoid:

- hero sections
- marketing copy
- decorative illustrations
- large gradient backgrounds
- oversized cards
- complex dashboards
- multi-step wizard flows
- modal-heavy setup

### 4. Defaults Should Be Good Enough

Opening the page should produce a useful worksheet without configuration.

Default state:

```text
Template: Tianzi tracing
Paper: A4
Orientation: portrait
Header: homework
Grid size: medium
Input: small demo character set
Content templates: available but not intrusive
Stroke numbers: on
Start dots: on
Direction arrows: on
Trace opacity: moderate
```

The first impression should be "I can print this now."

### 5. Favor Familiar Controls

Use standard controls that match the decision being made:

- segmented controls for template, paper size, orientation, and header preset
- textarea for practice content
- toggles/checkboxes for binary options
- sliders for opacity and line darkness
- number inputs or steppers for page count, grid size, row count, and practice count
- select menus only when there are many options

Controls should be clear without instructional paragraphs.

## Layout

### Desktop

Desktop is the primary experience.

Recommended structure:

```text
┌──────────────────────────────────────────────────────────┐
│ Left settings panel │ Right preview workspace            │
│ fixed width         │ scrollable paper stack             │
│                     │                                    │
│ Content             │       ┌────────────────────┐       │
│ Template            │       │                    │       │
│ Paper               │       │     A4 preview     │       │
│ Grid                │       │                    │       │
│ Stroke Order        │       └────────────────────┘       │
│ Header              │                                    │
│ Print               │                                    │
└──────────────────────────────────────────────────────────┘
```

Settings panel:

- Width: around 320-380px.
- Full-height, independently scrollable.
- White or near-white background.
- Clear group divisions.
- Sticky print action near bottom if possible.

Preview workspace:

- Flexible width.
- Neutral light background.
- Paper centered horizontally.
- Paper shadow subtle enough not to distract.
- Multi-page preview uses consistent vertical gaps.

### Mobile

Mobile must be intentionally designed. It should not be a squeezed desktop layout.

Recommended behavior:

- Default view prioritizes paper preview.
- Preview scales down while preserving paper ratio.
- Settings open from a bottom panel, drawer, or grouped bottom tabs.
- Print button remains easy to find.
- Controls are at least 44px tall.
- No page-level horizontal scrolling.
- Multi-page preview scrolls vertically.
- Landscape paper still fits within the viewport.
- Settings groups can collapse to reduce vertical overload.

Recommended mobile structure:

```text
┌────────────────────┐
│ 汉字 Fun      Print│
├────────────────────┤
│                    │
│   scaled paper     │
│                    │
├────────────────────┤
│ Content Template ⚙ │
└────────────────────┘
```

The mobile editing experience should feel like a lightweight app after being added to the home screen.

### PWA Mode

When installed as a PWA:

- Use standalone display.
- Keep the same design language as the browser version.
- Avoid browser-only assumptions.
- Keep a compact app bar visible.
- Restore the user's latest settings on launch.
- Show offline status only when it affects available data.

## Information Architecture

Recommended left-panel order:

### Content

- Practice text
- Content template library
- Template category
- Template item
- Replace current content
- Append to current content
- Deduplicate characters
- Missing character status

Built-in content templates should be discoverable without dominating the panel. The textarea remains the source of truth after a template is inserted.

Template categories:

- Tang poems
- San Zi Jing sections
- Elementary common characters
- Basic character structures
- Common words

### Template

- Tianzi tracing
- Mizi tracing
- Stroke-order breakdown
- Blank paper

### Paper

- A5 / A4 / A3 / Letter
- Portrait / Landscape
- Margin

### Grid

- Tianzi / Mizi
- Cell size
- Rows per page: auto/manual
- Cells per row: auto/manual
- Line darkness
- Guide line visibility

### Stroke Order

- Stroke numbers
- Start dots
- Direction arrows
- Step breakdown count

This group should be hidden or disabled for blank paper.

### Header

- Header preset
- Title
- Student name
- Class
- Date
- Page number

### Actions

- Print / Save PDF
- Restore defaults
- Clear content

## Visual System

### Color

Use a print-tool palette, not a playful full-color learning-game palette.

Recommended roles:

```text
Canvas background: cool light gray
Settings background: white
Text primary: near-black slate
Text secondary: muted gray
Borders: light neutral gray
Primary action: deep teal or blue-green
Stroke accent: warm red/orange for start dots and arrows
Paper: pure white
Grid lines: cool gray
Trace characters: black with low opacity
```

Avoid one-note palettes dominated by purple, beige, dark blue, brown, or decorative gradients.

### Typography

UI typography should be compact and readable.

Recommended:

- System sans-serif for UI.
- Chinese UI should use system Chinese fonts.
- No viewport-width font scaling.
- Letter spacing: `0`.
- Use small section labels and clear control labels.
- Do not use hero-scale typography inside the app.

Printed characters should come from SVG stroke data where possible. Fallback font rendering is allowed only for unsupported/no-stroke modes and must be clearly indicated.

### Spacing

Keep the app dense enough for repeated use.

Recommended:

- 8px base spacing rhythm.
- 8px border radius maximum for controls and compact panels.
- Clear vertical separation between setting groups.
- Avoid nested cards.

### Paper Preview

The paper preview must be visually accurate and trustworthy.

Requirements:

- Use millimeter-based CSS dimensions for paper.
- Use the selected paper size and orientation.
- Keep content inside printable margins.
- Use subtle shadow on screen only.
- Remove preview shadow in print.
- Page background must be white.

## Template Design

### Tianzi Tracing

Purpose: everyday practice.

Paper content:

- Optional page header
- Character label or pinyin
- One traced model cell
- As many whole practice cells as fit the available row width
- Tianzi grid lines
- Optional stroke-order annotations on the model cell

### Mizi Tracing

Purpose: beginner structure and angle guidance.

Same as Tianzi tracing, but with diagonal guide lines.

### Stroke-Order Breakdown

Purpose: learning new characters.

Paper content:

- Larger model cell
- Stroke-number annotations
- Start dots and arrows
- Step-by-step small cells
- Limited practice cells

This template can use more space per character. It is acceptable to fit fewer characters per page.

### Blank Practice Paper

Purpose: free writing and classroom handouts.

Rules:

- Does not require input text.
- Does not require stroke data.
- Generates only grid cells.
- Supports Tianzi or Mizi.
- Uses page count, paper size, margin, grid size, rows, and columns.
- Optional header.

### Article Tracing

Purpose: tracing poems, passages, and classroom text in reading order.

Rules:

- Every visible input character occupies exactly one cell.
- Repeated characters and punctuation are preserved.
- Supported Hanzi use SVG stroke paths; punctuation and unsupported characters use a local-font fallback.
- Cells flow left-to-right and top-to-bottom, then continue on the next page.
- Practice-only controls are hidden because rows and pages are filled automatically.

## States And Feedback

### Missing Characters

Unsupported characters should be visible in the settings panel, not silently ignored.

Recommended behavior:

```text
已加载 18 个字，2 个字暂无笔顺数据：龘、𠮷
```

If fallback rendering is enabled, label it clearly.

### Loading Stroke Data

On-demand loading should be quiet but visible.

Recommended:

- Show a compact loading status in the Content group.
- Keep already-rendered pages stable.
- Avoid blocking the whole UI unless needed.

### Local Save

Settings should auto-save without interrupting the user.

Recommended:

- No toast on every change.
- A subtle "已自动保存" status can appear near actions.
- Restore settings automatically on load.

## Print Rules

Print output is the final product. Screen design must not compromise printed clarity.

Requirements:

- `@page` should reflect selected paper size.
- Browser print should use actual size / 100%.
- Disable browser headers and footers in user guidance.
- Remove screen-only shadows.
- Keep grid lines light but visible.
- Keep trace characters visible enough for children to follow.
- Stroke numbers and arrows must remain readable after printing.

## What Not To Build

Do not turn the app into:

- a marketing landing page
- a classroom management dashboard
- a social sharing tool
- a gamified practice app
- a multi-step PDF wizard
- an account-first SaaS product

汉字 Fun should stay close to one job: design a printable Chinese writing sheet quickly and clearly.

## One-Sentence Design North Star

汉字 Fun is a calm, WYSIWYG print design tool: settings on the left, real paper on the right, every change visible immediately.
