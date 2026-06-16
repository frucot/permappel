const cdiApi = getApiUrl('/cdi');
const studentsApi = getApiUrl('/students');

/**
 * Lit la réponse HTTP, parse le JSON si possible, puis vérifie response.ok.
 * Évite de parser du HTML ou une chaîne vide comme JSON après une erreur 4xx/5xx.
 */
async function fetchJsonOrThrow(url, init) {
    const response = await fetch(url, init);
    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            if (!response.ok) {
                throw new Error(`Erreur serveur (${response.status})`);
            }
            throw new Error('Réponse serveur invalide');
        }
    }
    if (!response.ok) {
        throw new Error(data.message || `Erreur serveur (${response.status})`);
    }
    return data;
}

let selectedStudent = null;
let suggestionsCache = [];
/** Incrémenté à chaque saisie : ignore les réponses d’autocomplete arrivées hors ordre. */
let studentSearchSeq = 0;
/** Annule la requête autocomplete précédente dès qu’une nouvelle saisie part. */
let studentSearchAbortController = null;

const ui = {
    currentDate: document.getElementById('currentDate'),
    currentSlot: document.getElementById('currentSlot'),
    kioskStatus: document.getElementById('kioskStatus'),
    studentSearch: document.getElementById('studentSearch'),
    studentPreview: document.getElementById('studentPreview'),
    studentsSuggestions: document.getElementById('studentsSuggestions'),
    activitySelect: document.getElementById('activitySelect'),
    submitBtn: document.getElementById('submitBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    feedback: document.getElementById('feedback'),
    form: document.getElementById('kioskForm')
};

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadKioskStatus(), loadCurrentSlot(), loadActivities()]);
    wireEvents();
});

function wireEvents() {
    ui.studentSearch.addEventListener('input', onStudentSearchInput);
    ui.studentSearch.addEventListener('change', onStudentSelected);
    ui.form.addEventListener('submit', onSubmit);
    ui.logoutBtn.addEventListener('click', onLogout);
}

/** Repère une valeur égale à une option du datalist (sélection utilisateur avant que l’API ne vide le cache). */
function studentFromDatalistOptionValue(value) {
    const trimmed = (value || '').trim();
    if (!trimmed || !ui.studentsSuggestions) return null;
    const options = ui.studentsSuggestions.options;
    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.value === trimmed && opt.dataset.studentId) {
            return {
                id: parseInt(opt.dataset.studentId, 10),
                nom: opt.dataset.nom || '',
                prenom: opt.dataset.prenom || '',
                classe: opt.dataset.classe || ''
            };
        }
    }
    return null;
}

async function loadCurrentSlot() {
    try {
        const data = await fetchJsonOrThrow(`${cdiApi}/current-slot`);
        if (!data.success) throw new Error(data.message || 'Échec du chargement du créneau');

        ui.currentDate.textContent = formatDate(data.date);
        ui.currentSlot.textContent = data.currentSlot
            ? `${data.currentSlot.nom} (${data.currentSlot.heureDebut} - ${data.currentSlot.heureFin})`
            : 'Aucun créneau actif';
    } catch (error) {
        showFeedback(`Erreur chargement créneau: ${error.message}`, 'error');
    }
}

async function loadKioskStatus() {
    try {
        const data = await fetchJsonOrThrow(`${cdiApi}/kiosk-status`);
        if (!data.success) throw new Error(data.message || 'Statut borne indisponible');

        if (!data.restrictionEnabled) {
            setKioskStatus('Restriction IP désactivée (borne ouverte)', 'neutral');
            return;
        }

        if (data.authorized) {
            setKioskStatus(`Borne autorisée (IP: ${data.clientIP})`, 'ok');
        } else {
            setKioskStatus(`Borne non autorisée (IP: ${data.clientIP})`, 'blocked');
            ui.submitBtn.disabled = true;
        }
    } catch (error) {
        setKioskStatus('Statut borne indisponible', 'neutral');
    }
}

async function loadActivities() {
    try {
        const data = await fetchJsonOrThrow(`${cdiApi}/activities`);
        if (!data.success) throw new Error(data.message || 'Échec du chargement des activités');

        data.activities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = activity.libelle;
            ui.activitySelect.appendChild(option);
        });
    } catch (error) {
        showFeedback(`Erreur chargement activités: ${error.message}`, 'error');
    }
}

function abortPendingStudentSearch() {
    if (studentSearchAbortController) {
        studentSearchAbortController.abort();
        studentSearchAbortController = null;
    }
}

async function onStudentSearchInput(event) {
    const seq = ++studentSearchSeq;
    const value = event.target.value.trim();

    if (value.length < 1) {
        abortPendingStudentSearch();
        selectedStudent = null;
        ui.studentPreview.textContent = '';
        ui.studentsSuggestions.innerHTML = '';
        suggestionsCache = [];
        return;
    }

    // Le navigateur envoie souvent `input` puis `change` : à la sélection dans le datalist,
    // la valeur complète ne correspond pas au préfixe de recherche — ne pas vider le cache ni rappeler l’API.
    const fromDatalist = studentFromDatalistOptionValue(value);
    if (fromDatalist) {
        abortPendingStudentSearch();
        selectedStudent = fromDatalist;
        ui.studentPreview.textContent =
            `Élève sélectionné: ${fromDatalist.prenom} ${fromDatalist.nom} (${fromDatalist.classe})`;
        return;
    }

    selectedStudent = null;
    ui.studentPreview.textContent = '';

    abortPendingStudentSearch();
    studentSearchAbortController = new AbortController();
    const { signal } = studentSearchAbortController;

    try {
        const data = await fetchJsonOrThrow(
            `${studentsApi}/autocomplete?q=${encodeURIComponent(value)}`,
            { signal }
        );
        if (seq !== studentSearchSeq) {
            return;
        }
        if (!data.success) throw new Error(data.message || 'Échec de la recherche');

        suggestionsCache = data.students || [];
        ui.studentsSuggestions.innerHTML = '';

        suggestionsCache.forEach(student => {
            const option = document.createElement('option');
            option.value = `${student.nom} ${student.prenom} - ${student.classe}`;
            option.dataset.studentId = String(student.id);
            option.dataset.nom = student.nom;
            option.dataset.prenom = student.prenom;
            option.dataset.classe = student.classe;
            ui.studentsSuggestions.appendChild(option);
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        if (seq !== studentSearchSeq) {
            return;
        }
        showFeedback(`Erreur recherche élève: ${error.message}`, 'error');
    }
}

function onStudentSelected() {
    const inputValue = ui.studentSearch.value.trim();
    selectedStudent = suggestionsCache.find(student => (
        `${student.nom} ${student.prenom} - ${student.classe}` === inputValue
    )) || studentFromDatalistOptionValue(inputValue) || null;

    if (selectedStudent) {
        ui.studentPreview.textContent = `Élève sélectionné: ${selectedStudent.prenom} ${selectedStudent.nom} (${selectedStudent.classe})`;
    } else {
        ui.studentPreview.textContent = 'Veuillez sélectionner un élève dans la liste';
    }
}

async function onSubmit(event) {
    event.preventDefault();
    if (!selectedStudent) {
        showFeedback('Veuillez sélectionner un élève dans la liste', 'error');
        return;
    }

    const activityId = ui.activitySelect.value;
    if (!activityId) {
        showFeedback('Veuillez sélectionner une activité', 'error');
        return;
    }

    ui.submitBtn.disabled = true;
    try {
        const data = await fetchJsonOrThrow(`${cdiApi}/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: selectedStudent.id,
                activityId: parseInt(activityId, 10)
            })
        });

        if (!data.success) {
            throw new Error(data.message || 'Erreur lors de l’inscription');
        }

        showFeedback(
            `${selectedStudent.prenom} ${selectedStudent.nom} inscrit(e) au CDI (${data.activity})`,
            'success'
        );
        ui.form.reset();
        selectedStudent = null;
        ui.studentPreview.textContent = '';
        suggestionsCache = [];
        ui.studentsSuggestions.innerHTML = '';
    } catch (error) {
        showFeedback(error.message, 'error');
    } finally {
        ui.submitBtn.disabled = false;
    }
}

function formatDate(dateValue) {
    if (dateValue == null || dateValue === '') {
        return '';
    }
    const str = String(dateValue).trim();
    // Les chaînes date-only (YYYY-MM-DD) sont parsées par JS comme UTC minuit,
    // ce qui décale le jour affiché dans les fuseaux à l'ouest de UTC.
    const dateOnly = str.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return str;
    }
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function showFeedback(message, type) {
    ui.feedback.className = `feedback ${type}`;
    ui.feedback.textContent = message;
}

function setKioskStatus(message, state) {
    if (!ui.kioskStatus) return;
    ui.kioskStatus.textContent = message;
    ui.kioskStatus.className = `kiosk-status ${state}`;
}

function onLogout() {
    localStorage.removeItem('token');
    window.currentUser = null;
    window.location.href = 'index.html';
}
