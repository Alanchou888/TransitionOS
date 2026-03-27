type ExportInput = {
  title: string;
  markdown: string;
};

export function exportMarkdownFile(input: ExportInput) {
  return {
    fileName: `${slugify(input.title)}.md`,
    contentType: "text/markdown; charset=utf-8",
    content: input.markdown
  };
}

export function exportPdfHtml(input: ExportInput) {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.5; color: #0f172a; }
      h1, h2, h3 { color: #0c4a6e; }
      pre { background: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; }
      code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    ${markdownToSimpleHtml(input.markdown)}
  </body>
</html>`;
  return {
    fileName: `${slugify(input.title)}.html`,
    contentType: "text/html; charset=utf-8",
    content: html
  };
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownToSimpleHtml(markdown: string) {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(.*)$/gim, "<p>$1</p>")
    .replace(/<p><li>/g, "<ul><li>")
    .replace(/<\/li><\/p>/g, "</li></ul>");
}

