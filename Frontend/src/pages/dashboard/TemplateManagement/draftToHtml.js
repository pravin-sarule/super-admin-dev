/**
 * Convert plain-text draft content to safe HTML for preview.
 * Escapes HTML entities and wraps paragraphs; intended to run in background (e.g. requestIdleCallback).
 * @param {string} text - Plain text draft content
 * @returns {string} HTML string (safe for our own generated content)
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Convert draft plain text to HTML: double newlines -> paragraphs, single newlines -> <br/>.
 * Run this in requestIdleCallback so it doesn't block the main thread (background generation).
 */
export function draftToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) return `<p>${escapeHtml(text.trim())}</p>`;
  return paragraphs
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

/**
 * Schedule HTML generation in the background (idle callback). Falls back to setTimeout if not supported.
 * @param {string} text - Plain text draft content
 * @param {(html: string) => void} onDone - Callback with generated HTML
 */
export function draftToHtmlInBackground(text, onDone) {
  const run = () => {
    const html = draftToHtml(text);
    onDone(html);
  };
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}
