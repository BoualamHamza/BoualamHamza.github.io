// Shared rendering + sanitization helpers, used by the home page (app.js)
// and the standalone article reader (article.js).

// Escape HTML entities for plain-text fields to prevent XSS.
// Quotes are escaped too, so this is safe inside a quoted attribute as well
// as in text content -- the DOM/textContent trick escapes only & < > and
// would let a value containing a double quote break out of an attribute.
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Sanitize URLs: only allow http(s) and mailto protocols.
// Resolved against the page's own base so relative links ("article.html")
// keep working; an absolute URL with its own scheme ignores the base, so
// "javascript:" and "data:" are still rejected.
export function sanitizeUrl(url) {
    if (!url) return '#';
    try {
        const parsed = new URL(url, document.baseURI);
        if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            return parsed.href;
        }
    } catch {
        // not a valid URL
    }
    return '#';
}

// Sanitize rich HTML (descriptions, article bodies): strip dangerous
// tags/attributes, allowing safe formatting tags only.
export function sanitizeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Remove script, style, iframe, object, embed, form, input elements
    const dangerous = doc.querySelectorAll('script, style, iframe, object, embed, form, input, link, meta, base, svg');
    dangerous.forEach(el => el.remove());
    // Remove event handler attributes, and drop any href that is not an
    // allowed protocol (blocks javascript:, data:, vbscript: and friends)
    doc.body.querySelectorAll('*').forEach(el => {
        for (const attr of [...el.attributes]) {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            } else if (attr.name === 'href' && sanitizeUrl(attr.value) === '#') {
                el.removeAttribute(attr.name);
            }
        }
    });
    return doc.body.innerHTML;
}

// Dates are stored as plain strings by the admin panel, but older docs may hold
// a Firestore Timestamp. Render both as YYYY-MM-DD rather than "Timestamp(...)".
export function formatDate(value) {
    if (!value) return '';
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate().toISOString().slice(0, 10);
    }
    return String(value);
}

// An item earns its own reader page once it has article body content.
export function hasArticle(item) {
    return typeof item.body === 'string' && item.body.trim().length > 0;
}

// Manual ordering from the admin panel. Docs with no `order` sink to the
// bottom and fall back to newest-first, so items saved before the field
// existed still appear.
const ORDER_LAST = Number.MAX_SAFE_INTEGER;

export function orderOf(item) {
    const n = Number(item.order);
    return Number.isFinite(n) ? n : ORDER_LAST;
}

export function byOrderThenDateDesc(a, b) {
    const diff = orderOf(a) - orderOf(b);
    if (diff !== 0) return diff;
    return formatDate(b.date).localeCompare(formatDate(a.date));
}

// Items are hidden only by an explicit `visible: false`, so docs saved
// before the toggle existed stay visible.
export function isVisible(item) {
    return item.visible !== false;
}
