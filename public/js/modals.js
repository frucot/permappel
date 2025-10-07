// ===== GESTION DES MODALES =====

// Fonction pour afficher une modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

// Fonction pour masquer une modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// Configuration des gestionnaires de modales
function setupModalHandlers() {
    // Fermer les modales avec le bouton X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // Fermer les modales en cliquant à l'extérieur
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });

    // Gestion de l'affichage des options de récurrence
    const recurringCallCheckbox = document.getElementById('recurringCall');
    const recurrenceOptions = document.getElementById('recurrenceOptions');
    
    if (recurringCallCheckbox && recurrenceOptions) {
        recurringCallCheckbox.addEventListener('change', function() {
            if (this.checked) {
                recurrenceOptions.style.display = 'block';
            } else {
                recurrenceOptions.style.display = 'none';
            }
        });
    }
    
    // Bouton "Ajouter un élève"
    const addStudentBtn = document.getElementById('addStudentBtn');
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', async () => {
            await loadGroupsForAdd();
            showModal('addStudentModal');
        });
    }
}
