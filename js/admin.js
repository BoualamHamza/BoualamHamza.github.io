import { db, auth, storage, provider, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, signInWithPopup, signOut, onAuthStateChanged, ref, uploadBytes, getDownloadURL, query, orderBy } from './firebase-config.js';

// --- Allowed Admin Emails ---
// IMPORTANT: Only these Google accounts can access the admin panel.
// Update this list with your own email(s). This is a client-side check;
// you MUST also enforce this in your Firebase Security Rules for real security.
const ALLOWED_ADMINS = [
    "boualamhamzaa@gmail.com",
    "boualamhamzaa+work@gmail.com"
];

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');
    const loginOverlay = document.getElementById('login-overlay');
    const adminContent = document.getElementById('admin-content');
    const userEmail = document.getElementById('user-email');

    if (user) {
        // Check if the user's email is in the allowlist
        if (!ALLOWED_ADMINS.includes(user.email)) {
            userEmail.textContent = user.email + ' (unauthorized)';
            loginBtn.classList.add('d-none');
            logoutBtn.classList.remove('d-none');
            adminContent.classList.add('d-none');
            loginOverlay.style.display = 'none';

            alert("Access denied. Your account (" + user.email + ") is not authorized to use this admin panel.");
            signOut(auth);
            return;
        }

        // Logged In & Authorized
        userEmail.textContent = user.email;
        loginBtn.classList.add('d-none');
        logoutBtn.classList.remove('d-none');
        loginOverlay.style.display = 'none';
        adminContent.classList.remove('d-none');

        // Load initial data for the active tab (projects by default)
        loadItemsForActiveTab();
    } else {
        // Logged Out
        userEmail.textContent = 'Not logged in';
        loginBtn.classList.remove('d-none');
        logoutBtn.classList.add('d-none');
        adminContent.classList.add('d-none');
    }
});

// --- Login/Logout Handlers ---
document.getElementById('btn-login').addEventListener('click', () => {
    document.getElementById('login-overlay').style.display = 'block';
});

document.getElementById('btn-google-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Login failed", error);
        alert("Login failed: " + error.message);
    });
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// --- Tab Switching ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // UI Updates
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));

        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        // Load data for the new tab
        loadCollectionData(targetId);
    });
});

// --- Generic Load & Render Functions ---

async function loadItemsForActiveTab() {
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        const targetId = activeTab.getAttribute('data-target');
        loadCollectionData(targetId);
    }
}

async function loadCollectionData(collectionName) {
    if (collectionName === 'music') return; // Skip music as it's static now

    const listContainerId = `list-${collectionName}`;
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;

    listContainer.innerHTML = '<li class="list-group-item">Loading...</li>';

    try {
        let q;
        // Basic sorting: date desc for most, generic for others
        if (['news', 'projects', 'papers', 'experience'].includes(collectionName)) {
            // Note: You might need composites indexes for complex sorting. 
            // Using simple retrieval then client-sort if needed to avoid index issues for now.
            // Or just simple getDocs:
            q = query(collection(db, collectionName));
        } else {
            q = collection(db, collectionName);
        }

        const querySnapshot = await getDocs(q);
        listContainer.innerHTML = ''; // Clear loading

        const items = [];
        querySnapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

        // Client-side sort if date exists (Newest first)
        items.sort((a, b) => {
            if (a.date && b.date) return new Date(b.date) - new Date(a.date);
            if (a.year && b.year) return b.year - a.year; // for papers perhaps
            return 0;
        });

        if (items.length === 0) {
            listContainer.innerHTML = '<li class="list-group-item text-muted">No items found.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = "list-group-item d-flex justify-content-between align-items-center";

            // Build display safely using textContent where possible
            const textDiv = document.createElement('div');
            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.title || item.name || "Untitled";
            textDiv.appendChild(titleSpan);
            if (item.date) {
                const dateSmall = document.createElement('small');
                dateSmall.className = 'text-muted';
                dateSmall.textContent = ` (${item.date})`;
                textDiv.appendChild(dateSmall);
            }

            const btnDiv = document.createElement('div');
            const editBtn = document.createElement('button');
            editBtn.className = "btn btn-sm btn-outline-primary me-2 btn-edit";
            editBtn.dataset.id = item.id;
            editBtn.dataset.col = collectionName;
            editBtn.textContent = "Edit";

            const deleteBtn = document.createElement('button');
            deleteBtn.className = "btn btn-sm btn-outline-danger btn-delete";
            deleteBtn.dataset.id = item.id;
            deleteBtn.dataset.col = collectionName;
            deleteBtn.textContent = "Delete";

            btnDiv.appendChild(editBtn);
            btnDiv.appendChild(deleteBtn);

            li.appendChild(textDiv);
            li.appendChild(btnDiv);
            listContainer.appendChild(li);
        });

        // Add Listeners for Edit/Delete buttons in this list
        listContainer.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editItem(btn.dataset.id, btn.dataset.col, items));
        });
        listContainer.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteItem(btn.dataset.id, btn.dataset.col));
        });

    } catch (e) {
        console.error("Error loading items:", e);
        const errorLi = document.createElement('li');
        errorLi.className = 'list-group-item text-danger';
        errorLi.textContent = `Error loading items: ${e.message}`;
        listContainer.innerHTML = '';
        listContainer.appendChild(errorLi);
    }
}

// --- Edit & Delete Logic ---

function editItem(id, collectionName, items) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const form = document.getElementById(`${collectionName}-form`);
    if (!form) return;

    // Populate Form
    form.reset();
    Object.keys(item).forEach(key => {
        if (form.elements[key]) {
            if (form.elements[key].type !== 'file') {
                form.elements[key].value = item[key];
            }
        }
    });

    // Set Hidden ID
    if (form.elements['docId']) {
        form.elements['docId'].value = id;
    }

    // Show Cancel Button & Update Submit Button Text
    const cancelBtn = document.getElementById(`btn-cancel-${collectionName}`);
    if (cancelBtn) {
        cancelBtn.classList.remove('d-none');
        cancelBtn.onclick = () => resetFormState(collectionName);
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Update Item";

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

async function deleteItem(id, collectionName) {
    if (!confirm("Are you sure you want to delete this item? This cannot be undone.")) return;

    try {
        await deleteDoc(doc(db, collectionName, id));
        alert("Item deleted.");
        loadCollectionData(collectionName); // Refresh list
    } catch (e) {
        console.error("Delete error:", e);
        alert("Error deleting: " + e.message);
    }
}

function resetFormState(collectionName) {
    const form = document.getElementById(`${collectionName}-form`);
    if (!form) return;

    form.reset();
    form.elements['docId'].value = ""; // Clear ID

    // Reset Buttons
    const cancelBtn = document.getElementById(`btn-cancel-${collectionName}`);
    if (cancelBtn) cancelBtn.classList.add('d-none');

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Add Item"; // Reset to default (or similar)
    if (collectionName === 'project' || collectionName === 'projects') submitBtn.innerText = "Add Project";
    if (collectionName === 'papers') submitBtn.innerText = "Add Paper";
    // ... logic to restore specific text if strictly needed, or generic "Add/Save" is fine.
    // simpler:
    if (submitBtn.innerText.includes("Update")) {
        submitBtn.innerText = submitBtn.innerText.replace("Update", "Add").replace("Save", "Add");
        // Fallback default
        if (!submitBtn.innerText.includes("Add")) submitBtn.innerText = "Add Item";
    }

}

// --- Form Submission (Create or Update) ---

async function handleFormSubmit(event, collectionName) {
    event.preventDefault();
    const form = event.target;
    // Disable button
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    const formData = new FormData(form);
    let data = Object.fromEntries(formData.entries());

    // Ensure 'order' is saved as a number for correct sorting
    if (data.order) {
        data.order = parseInt(data.order, 10);
    }

    const docId = data.docId; // Get ID if editing
    delete data.docId; // Don't save ID in the doc data

    try {
        // Handle File Upload
        const fileInput = form.querySelector('input[type="file"]');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storagePath = `uploads/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            if (collectionName === 'experience') {
                data.logo = downloadURL;
            } else {
                data.image = downloadURL;
            }
        }

        // GENERIC CLEANUP: Remove File objects & empty file keys
        Object.keys(data).forEach(key => {
            if (data[key] instanceof File) delete data[key];
        });
        delete data.imageFile;

        if (docId) {
            // UPDATE Existing
            await updateDoc(doc(db, collectionName, docId), {
                ...data,
                updatedAt: new Date()
            });
            alert('Item updated successfully!');
            resetFormState(collectionName); // Reset to Add mode
        } else {
            // CREATE New
            await addDoc(collection(db, collectionName), {
                ...data,
                createdAt: new Date()
            });
            alert('Item added successfully!');
            form.reset();
        }

        // Refresh list
        loadCollectionData(collectionName);

    } catch (e) {
        console.error("Error saving document: ", e);
        alert("Error saving item: " + e.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
}

// Bind Events
document.getElementById('projects-form').addEventListener('submit', (e) => handleFormSubmit(e, 'projects'));
document.getElementById('talks-form').addEventListener('submit', (e) => handleFormSubmit(e, 'talks'));
document.getElementById('experience-form').addEventListener('submit', (e) => handleFormSubmit(e, 'experience'));
document.getElementById('papers-form').addEventListener('submit', (e) => handleFormSubmit(e, 'papers'));
document.getElementById('music-form').addEventListener('submit', (e) => handleFormSubmit(e, 'music')); // Still allows adding specific items if you revert static change
document.getElementById('news-form').addEventListener('submit', (e) => handleFormSubmit(e, 'news'));
