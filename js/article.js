import { db, doc, getDoc } from './firebase-config.js';
import { escapeHtml, sanitizeUrl, sanitizeHtml, formatDate, hasArticle } from './render-utils.js';

const container = document.getElementById('article');

function fail(message) {
    container.innerHTML = `
        <div class="is-error">${escapeHtml(message)}</div>
        <p class="article-foot"><a href="index.html">Back to the home page</a></p>
    `;
}

function render(data) {
    // Keep the tab title and the page heading in step
    document.title = `${data.title || 'Article'} — Hamza Boualam`;

    const date = formatDate(data.date);
    const category = data.category ? String(data.category).toLowerCase() : '';

    container.innerHTML = `
        <header class="article-head">
            <h1>${escapeHtml(data.title)}</h1>
            <div class="article-meta">
                ${category ? `<span class="chip">${escapeHtml(category)}</span>` : ''}
                ${date ? `<span>${escapeHtml(date)}</span>` : ''}
            </div>
        </header>

        ${data.image
            ? `<img class="article-hero" src="${sanitizeUrl(data.image)}" alt="${escapeHtml(data.title)}">`
            : ''}

        ${data.description ? `<div class="article-lede">${sanitizeHtml(data.description)}</div>` : ''}

        <div class="article-body">${sanitizeHtml(data.body)}</div>

        <footer class="article-foot">
            ${data.link
            ? `<p><a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">External link <i class="fas fa-external-link-alt" style="font-size:11px"></i></a></p>`
            : ''}
            <p><a href="index.html">Back to all side quests</a></p>
        </footer>
    `;
}

async function load() {
    if (!container) return;

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        fail('No article was specified.');
        return;
    }

    try {
        const snapshot = await getDoc(doc(db, 'talks', id));
        if (!snapshot.exists()) {
            fail('That article could not be found.');
            return;
        }

        const data = snapshot.data();
        if (!hasArticle(data)) {
            fail('This item does not have an article to read yet.');
            return;
        }
        render(data);
    } catch (e) {
        console.error('Error loading article:', e);
        fail('Failed to load this article.');
    }
}

document.addEventListener('DOMContentLoaded', load);
