import { db, collection, getDocs, query, orderBy } from './firebase-config.js';
import {
    escapeHtml, sanitizeUrl, sanitizeHtml, formatDate,
    hasArticle, byOrderThenDateDesc, isVisible
} from './render-utils.js';

// Thumbnail: real image when the doc has one, striped placeholder otherwise
function thumb(url, alt, className) {
    if (url) {
        return `<img src="${sanitizeUrl(url)}" class="${className}" alt="${escapeHtml(alt)}" loading="lazy">`;
    }
    return `<div class="${className} thumb-ph" aria-hidden="true"></div>`;
}

// Read a whole collection, keeping doc IDs. Deliberately unordered: an
// orderBy() on a field silently drops every doc that lacks it, which would
// hide older items saved before `order` existed.
async function fetchAll(collectionName) {
    const snapshot = await getDocs(collection(db, collectionName));
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    return items;
}

function setState(container, message, isError) {
    container.innerHTML = `<div class="${isError ? 'is-error' : 'loading-placeholder'}">${escapeHtml(message)}</div>`;
}

// --- Sections still ordered by date (news, experience, papers) ---

async function fetchAndRender(collectionName, containerId, renderer) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const q = query(collection(db, collectionName), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            setState(container, 'No items found.', false);
            return;
        }

        container.innerHTML = ''; // Clear loading/static content
        querySnapshot.forEach((doc) => {
            container.innerHTML += renderer(doc.data());
        });
    } catch (e) {
        console.error(`Error fetching ${collectionName}:`, e);
        // Don't clear container if error, so fallback static content remains if applicable
        if (container.querySelector('.loading-placeholder')) {
            setState(container, 'Failed to load content. Check configuration.', true);
        }
    }
}

// --- Renderers ---

// Compact strip under the header
const renderNews = (data) => `
    <div class="news-strip">
        ${thumb(data.image, data.title, 'news-thumb')}
        <div class="news-body">
            <div class="news-head">
                ${data.date ? `<span class="badge-date">${escapeHtml(formatDate(data.date))}</span>` : ''}
                <h5>${escapeHtml(data.title)}</h5>
            </div>
            ${data.description ? `<div class="news-text">${sanitizeHtml(data.description)}</div>` : ''}
            ${data.link ? `<a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer" class="btn-read">Read More <i class="fas fa-external-link-alt"></i></a>` : ''}
        </div>
    </div>
`;

// Dense row: thumbnail / title + description / date
const renderProject = (data) => `
    <div class="entry">
        ${thumb(data.image, data.title, 'entry-thumb')}
        <div class="entry-body">
            <h5><a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.title)}</a></h5>
            <div class="entry-text">${sanitizeHtml(data.description)}</div>
        </div>
        <div class="entry-date">${escapeHtml(formatDate(data.date))}</div>
    </div>
`;

const renderExperience = (data) => `
    <div class="timeline-item">
      <div class="timeline-date">${escapeHtml(formatDate(data.date))}</div>
      ${data.logo
        ? `<img src="${sanitizeUrl(data.logo)}" class="timeline-logo" alt="" loading="lazy">`
        : '<div class="timeline-logo" aria-hidden="true"></div>'}
      <div class="timeline-content">
        <h5>${escapeHtml(data.title)}</h5>
        <div class="timeline-text">${sanitizeHtml(data.description)}</div>
      </div>
    </div>
`;

const renderPaper = (data) => `
    <div class="entry">
        <div class="entry-body">
            <h5>${data.link
        ? `<a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.title)}</a>`
        : escapeHtml(data.title)}</h5>
            <div class="entry-text">
                <p><strong>${escapeHtml(data.authors)}</strong></p>
                <p><em>${escapeHtml(data.venue)}</em></p>
            </div>
        </div>
        <div class="entry-date">${escapeHtml(formatDate(data.date))}</div>
    </div>
`;

// --- Projects: manual order + show/hide, both set in the admin panel ---

async function loadProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    try {
        const items = (await fetchAll('projects'))
            .filter(isVisible)
            .sort(byOrderThenDateDesc);

        if (!items.length) {
            setState(container, 'No items found.', false);
            return;
        }
        container.innerHTML = items.map(renderProject).join('');
    } catch (e) {
        console.error('Error fetching projects:', e);
        // Leave the static fallback rows in place if they are still there
        if (container.querySelector('.loading-placeholder')) {
            setState(container, 'Failed to load content. Check configuration.', true);
        }
    }
}

// --- Side Quests: filterable, with per-category article pages ---

let sideQuests = [];
let activeFilter = 'All';

// Article items open their own reader page; everything else links out.
function questLink(item) {
    const label = escapeHtml(item.title);
    if (hasArticle(item)) {
        return `<a href="article.html?id=${encodeURIComponent(item.id)}">${label}</a>`;
    }
    return `<a href="${sanitizeUrl(item.link)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

const renderSideQuest = (data) => `
    <div class="entry">
        ${thumb(data.image, data.title, 'entry-thumb')}
        <div class="entry-body">
            <div class="entry-meta">
                <h5>${questLink(data)}</h5>
                ${data.category ? `<span class="chip">${escapeHtml(String(data.category).toLowerCase())}</span>` : ''}
            </div>
            <div class="entry-text">${sanitizeHtml(data.description)}</div>
            ${hasArticle(data) ? `<a class="read-link" href="article.html?id=${encodeURIComponent(data.id)}">Read article <i class="fas fa-arrow-right"></i></a>` : ''}
        </div>
        <div class="entry-date">${escapeHtml(formatDate(data.date))}</div>
    </div>
`;

function renderSideQuestSection() {
    const list = document.getElementById('talks-container');
    const bar = document.getElementById('talks-filters');
    if (!list) return;

    // Only categories that actually have an item become filter pills
    const categories = [];
    sideQuests.forEach(item => {
        if (item.category && !categories.includes(item.category)) categories.push(item.category);
    });

    // Nothing to choose between until there are at least two categories
    if (bar) {
        bar.textContent = '';
        bar.hidden = categories.length < 2;
        if (!bar.hidden) {
            ['All', ...categories].forEach(cat => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'filter' + (cat === activeFilter ? ' is-active' : '');
                btn.setAttribute('aria-pressed', String(cat === activeFilter));
                btn.textContent = cat === 'All' ? 'all' : String(cat).toLowerCase();
                btn.addEventListener('click', () => {
                    activeFilter = cat;
                    renderSideQuestSection();
                });
                bar.appendChild(btn);
            });
        }
    }

    const visible = activeFilter === 'All'
        ? sideQuests
        : sideQuests.filter(item => item.category === activeFilter);

    list.innerHTML = visible.length
        ? visible.map(renderSideQuest).join('')
        : '<div class="loading-placeholder">Nothing in this category yet.</div>';
}

async function loadSideQuests() {
    const list = document.getElementById('talks-container');
    if (!list) return;

    try {
        sideQuests = (await fetchAll('talks'))
            .filter(isVisible)
            .sort(byOrderThenDateDesc);

        if (!sideQuests.length) {
            setState(list, 'No items found.', false);
            return;
        }
        renderSideQuestSection();
    } catch (e) {
        console.error('Error fetching talks:', e);
        setState(list, 'Failed to load content. Check configuration.', true);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRender('news', 'news-container', renderNews);
    loadProjects();
    fetchAndRender('experience', 'experience-container', renderExperience);
    fetchAndRender('papers', 'papers-container', renderPaper);
    loadSideQuests();
});
