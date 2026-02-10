import { db, collection, getDocs, query, orderBy } from './firebase-config.js';

// --- HTML Sanitization Helpers ---
// Escape HTML entities for plain-text fields to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Sanitize URLs: only allow http(s) and mailto protocols
function sanitizeUrl(url) {
    if (!url) return '#';
    try {
        const parsed = new URL(url);
        if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            return parsed.href;
        }
    } catch {
        // not a valid URL
    }
    return '#';
}

// Sanitize rich HTML (descriptions): strip dangerous tags/attributes
// Allows safe formatting tags only
function sanitizeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Remove script, style, iframe, object, embed, form, input elements
    const dangerous = doc.querySelectorAll('script, style, iframe, object, embed, form, input, link, meta, base, svg');
    dangerous.forEach(el => el.remove());
    // Remove event handler attributes from all elements
    doc.body.querySelectorAll('*').forEach(el => {
        for (const attr of [...el.attributes]) {
            if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        }
    });
    return doc.body.innerHTML;
}

async function fetchAndRender(collectionName, containerId, renderer) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        let q;
        // 'talks' collection uses custom 'order' field
        if (collectionName === 'talks') {
            q = query(collection(db, collectionName), orderBy('order', 'asc'));
        } else {
            q = query(collection(db, collectionName), orderBy('date', 'desc'));
        }
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-muted">No items found.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading/static content
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            container.innerHTML += renderer(data);
        });
    } catch (e) {
        console.error(`Error fetching ${collectionName}:`, e);
        // Don't clear container if error, so fallback static content remains if applicable
        if (container.querySelector('.loading-placeholder')) {
            container.innerHTML = '<p class="text-danger">Failed to load content. Check configuration.</p>';
        }
    }
}

// Renderers
const renderProject = (data) => `
    <div class="col-md-6 mb-4">
        <div class="item-card h-100">
            ${data.image ? `<img src="${sanitizeUrl(data.image)}" class="project-img" alt="${escapeHtml(data.title)}">` : ''}
            <h5><a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.title)}</a></h5>
            <div class="card-text">${sanitizeHtml(data.description)}</div>
            <small class="text-muted d-block mt-2">${escapeHtml(data.date)}</small>
        </div>
    </div>
`;

const renderTalk = (data) => `
    <div class="col-md-6 mb-4">
        <div class="item-card h-100">
            <h5><a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.title)}</a></h5>
            ${data.image
        ? `<img src="${sanitizeUrl(data.image)}" class="img-fluid rounded mb-3 mt-2" alt="${escapeHtml(data.title)}" style="max-height: 200px; width: 100%; object-fit: cover;">`
        : `<div class="bg-light d-flex align-items-center justify-content-center rounded mb-3 mt-2" style="height: 200px;"><i class="fas fa-image fa-2x text-muted"></i></div>`
    }
            <div class="card-text">${sanitizeHtml(data.description)}</div>
        </div>
    </div>
`;

const renderPaper = (data) => `
    <div class="item-card d-flex flex-column flex-md-row gap-3">
        <div class="item-date text-muted">${escapeHtml(data.date) || 'Year'}</div>
        <div>
            <h5>${data.link ? `<a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.title)}</a>` : escapeHtml(data.title)}</h5>
            <p class="mb-1"><strong>${escapeHtml(data.authors)}</strong></p>
            <p class="mb-0 text-muted"><em>${escapeHtml(data.venue)}</em></p>
        </div>
    </div>
`;

const renderMusic = (data) => `
    <div class="item-card">
        <h5>${escapeHtml(data.title)}</h5>
        <div>${sanitizeHtml(data.content)}</div>
    </div>
`;

const renderNews = (data) => `
    <div class="mb-4 pb-3 border-bottom">
        <div class="row align-items-start">
            ${data.image ? `
            <div class="col-md-3 mb-3 mb-md-0">
                 <img src="${sanitizeUrl(data.image)}" class="img-fluid rounded shadow-sm" style="width:100%; object-fit: cover;" alt="${escapeHtml(data.title)}">
            </div>` : ''}
            
            <div class="${data.image ? 'col-md-9' : 'col-12'}">
                <div class="d-flex align-items-center mb-2">
                    <span class="badge bg-secondary me-2">${escapeHtml(data.date)}</span>
                    <h5 class="mb-0"><strong>${escapeHtml(data.title)}</strong></h5>
                </div>
                
                ${data.description ? `<p class="mb-2">${sanitizeHtml(data.description)}</p>` : ''}
                
                ${data.link ? `<a href="${sanitizeUrl(data.link)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary mt-1">Read More <i class="fas fa-external-link-alt"></i></a>` : ''}
            </div>
        </div>
    </div>
`;

const renderExperience = (data) => `
    <div class="timeline-item">
      <div class="timeline-date">${escapeHtml(data.date)}</div>
      <div class="timeline-logo-container">
        ${data.logo ? `<img src="${sanitizeUrl(data.logo)}" class="timeline-logo" alt="Logo">` : '<div class="timeline-logo" style="background:#ddd;"></div>'}
      </div>
      <div class="timeline-content">
        <h5>${escapeHtml(data.title)}</h5>
        <div>${sanitizeHtml(data.description)}</div>
      </div>
    </div>
`;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRender('experience', 'experience-container', renderExperience);
    fetchAndRender('projects', 'projects-container', renderProject);
    fetchAndRender('talks', 'talks-container', renderTalk);
    fetchAndRender('papers', 'papers-container', renderPaper);
    // fetchAndRender('music', 'music-container', renderMusic); // Disabled in favor of static Spotify embed
    fetchAndRender('news', 'news-container', renderNews);
});
