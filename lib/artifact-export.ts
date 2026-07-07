"use client";

/**
 * Artifact export utilities — zero-dependency MVP using browser print API.
 * Text/HTML → PDF via window.print(), Image → PNG download, Sheet → CSV download.
 */

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "export";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print-optimized HTML template for PDF export */
function buildPrintHTML(title: string, bodyHTML: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page {
    size: A4;
    margin: 2cm 2.5cm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.8;
    color: #1a1a1a;
    max-width: 680px;
    margin: 0 auto;
    padding: 20px 0;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 8px 0;
    padding-bottom: 12px;
    border-bottom: 2px solid #333;
  }
  .meta {
    font-size: 12px;
    color: #999;
    margin-bottom: 32px;
  }
  h2 { font-size: 20px; margin-top: 2em; margin-bottom: 0.5em; }
  h3 { font-size: 17px; margin-top: 1.5em; margin-bottom: 0.4em; }
  h4, h5, h6 { font-size: 15px; margin-top: 1.2em; margin-bottom: 0.3em; }
  p { margin: 0.6em 0; }
  ul, ol { padding-left: 1.8em; margin: 0.5em 0; }
  li { margin: 0.2em 0; }
  blockquote {
    border-left: 3px solid #ddd;
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #555;
    background: #fafafa;
  }
  code {
    background: #f5f5f5;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  }
  pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: inherit;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
  }
  th { background: #f5f5f5; font-weight: 600; }
  hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
  strong { font-weight: 600; }
  img { max-width: 100%; height: auto; }
  @media print {
    body { padding: 0; }
    h1 { page-break-after: avoid; }
    h2, h3 { page-break-after: avoid; }
    pre, blockquote { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">${new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</div>
${bodyHTML}
</body>
</html>`;
}

/**
 * Simple markdown → HTML converter (headings, bold, italic, code, lists, links, hr, blockquote, tables, images).
 * Not a full markdown parser — covers the common patterns AI-generated content uses.
 */
function markdownToHTML(md: string): string {
  let html = md;

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code>${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(
    /`([^`\n]+)`/g,
    (_match, code) =>
      `<code>${code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`
  );

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr>");

  // Blockquote
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

  // Simple tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow, _separator, bodyRows) => {
      const headers = headerRow
        .split("|")
        .filter((c: string) => c.trim())
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join("");
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) => {
          const cells = row
            .split("|")
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Avoid double-wrapping
  html = html.replace(
    /(?<!<ul>)(<li>.*<\/li>\n?)+(?![\s\S]*<\/ul>)/g,
    (match) => (match.includes("<ul>") ? match : `<ol>${match}</ol>`)
  );

  // Paragraphs — wrap remaining lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) {
        return "";
      }
      if (/^<(h[1-6]|ul|ol|pre|blockquote|table|hr|img)/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function openPrintWindow(htmlContent: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Fallback: use a blob URL approach
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fallback = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    if (!fallback) {
      throw new Error("无法打开导出窗口，请检查浏览器弹出窗口设置");
    }
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  // Wait for content to render before printing
  setTimeout(() => printWindow.print(), 250);
}

/**
 * Export markdown text content as PDF (via browser print dialog).
 */
export function exportTextAsPDF(title: string, markdownContent: string): void {
  const bodyHTML = markdownToHTML(markdownContent);
  const fullHTML = buildPrintHTML(title, bodyHTML);
  openPrintWindow(fullHTML);
}

/**
 * Export raw HTML content as PDF (via browser print dialog).
 * Wraps the content in the print-optimized template.
 */
export function exportHtmlAsPDF(title: string, htmlContent: string): void {
  const fullHTML = buildPrintHTML(title, htmlContent);
  openPrintWindow(fullHTML);
}

/**
 * Download code content as a file.
 */
export function downloadCode(content: string, title: string): void {
  // Default to .py since the code artifact currently only supports Python
  const ext = "py";
  const filename = `${sanitizeFilename(title)}.${ext}`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

/**
 * Download base64 image content as PNG.
 */
export function downloadImage(content: string, title: string): void {
  const filename = `${sanitizeFilename(title)}.png`;
  // Content may or may not include the data URI prefix
  const base64Data = content.includes(",") ? content.split(",")[1] : content;
  const byteChars = atob(base64Data);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: "image/png" });
  triggerDownload(blob, filename);
}

/**
 * Download CSV content as a .csv file.
 */
export function downloadCSV(content: string, title: string): void {
  const filename = `${sanitizeFilename(title)}.csv`;
  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob([`\ufeff${content}`], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);
}
