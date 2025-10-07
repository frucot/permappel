// Gestion de l'établissement scolaire
let currentSchool = null;

// Charger les informations de l'établissement
async function loadSchool() {
    try {
        const response = await fetch(getApiUrl('/admin/establishment'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement de l\'établissement');
        }

        const data = await response.json();
        currentSchool = data.establishment;
        displaySchoolInfo(data.establishment);

    } catch (error) {
        console.error('Erreur chargement établissement:', error);
        showError('Erreur lors du chargement des informations de l\'établissement');
    }
}

// Afficher les informations de l'établissement
function displaySchoolInfo(school) {
    const establishmentInfo = document.getElementById('establishmentInfo');
    if (!establishmentInfo) return;

    establishmentInfo.innerHTML = `
        <div class="establishment-card">
            <div class="establishment-header">
                <h4><i class="fas fa-building"></i> ${school.nom}</h4>
            </div>
            <div class="establishment-details">
                <div class="detail-item">
                    <strong>Adresse :</strong>
                    <p>${school.adresse}</p>
                </div>
                <div class="detail-item">
                    <strong>Téléphone :</strong>
                    <p>${school.telephone}</p>
                </div>
            </div>
        </div>
    `;
}

// Afficher la modal de modification de l'établissement
function showEditSchoolModal() {
    if (!currentSchool) {
        showError('Impossible de charger les informations de l\'établissement');
        return;
    }

    // Remplir le formulaire avec les données actuelles
    document.getElementById('establishmentName').value = currentSchool.nom;
    document.getElementById('establishmentAddress').value = currentSchool.adresse;
    document.getElementById('establishmentPhone').value = currentSchool.telephone;

    // Afficher la modal
    showModal('establishmentModal');
}

// Gérer la soumission du formulaire d'établissement
document.addEventListener('DOMContentLoaded', function() {
    const establishmentForm = document.getElementById('establishmentForm');
    if (establishmentForm) {
        establishmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(establishmentForm);
            const schoolData = {
                nom: formData.get('name'),
                adresse: formData.get('address'),
                telephone: formData.get('phone')
            };

            try {
                const response = await fetch(getApiUrl('/admin/establishment'), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(schoolData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la modification');
                }

                const data = await response.json();
                
                // Mettre à jour les données locales
                currentSchool = { ...currentSchool, ...schoolData };
                
                // Rafraîchir l'affichage
                displaySchoolInfo(currentSchool);
                
                // Fermer la modal
                hideModal('establishmentModal');
                
                // Afficher le message de succès
                showNotification('Établissement mis à jour avec succès', 'success');

            } catch (error) {
                console.error('Erreur modification établissement:', error);
                showError(error.message || 'Erreur lors de la modification de l\'établissement');
            }
        });
    }
});

// Exposer les fonctions globalement
window.loadSchool = loadSchool;
window.showEditSchoolModal = showEditSchoolModal;

console.log('🔧 Module school.js chargé');
