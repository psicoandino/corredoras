// Inicialización Estricta del Estado de la Aplicación Monolítica
let state = {
    profile: {
        name: 'Boutique Assets',
        welcomeSeen: false,
        onboardingState: 'WELCOME', // Rango: 'WELCOME' | 'MAP' | 'CHOICE' | 'SIMULATION' | 'COMPLETED'
        mapStep: 1,
        tutorialStep: 1,
        settingsTourSeen: false,
        settingsStep: 1,
        whatsappTemplates: {
            'A': 'Hola {name}, soy parte del equipo de {broker}. Analicé sus requerimientos de alta prioridad para la propiedad {slug}. Coordinemos una llamada de inmediato.',
            'B1': 'Hola {name}, coordinemos una llamada para revisar los detalles sobre la propiedad {slug} en {broker}.',
            'B2': 'Hola {name}, recibimos su solicitud de información para la propiedad {slug} en {broker}. Le comparto los datos.',
            'C': 'Hola {name}, confirmamos la recepción de sus datos para la propiedad {slug} en {broker}. Saludos.'
        }
    },
    properties: [],
    leads: [],
    sandboxWizard: {
        currentStep: 1,
        totalScore: 0,
        currentLead: {}
    },
    runtimeFilters: {
        leadFilter: 'ALL',
        reverseLeads: false
    }
};

const UF_CONVERSION_FACTOR = 38560;

const TIER_NAMES = {
    'A': 'A-Cierre',
    'B1': 'B1-Calificado',
    'B2': 'B2-Evaluación',
    'C': 'C-Fricción'
};

// Soporte de Swipe Horizontal Nativo Ligero Vanilla JS
let touchstartX = 0;
let touchendX = 0;

function checkTouchSwipeDirection() {
    // Cancelar interrupción táctil si se está ejecutando un flujo restrictivo de onboarding
    if (document.getElementById('view-welcome').style.display === 'flex' || 
        document.getElementById('view-profile').classList.contains('active')) return;
    if (state.profile.onboardingState === 'MAP' || state.profile.onboardingState === 'SIMULATION') return;

    const swipeThreshold = 65;
    const viewsOrder = ['inventory', 'leads', 'sandbox'];
    const activeViewElement = document.querySelector('.crm-view.active');
    if (!activeViewElement) return;
    
    const currentViewId = activeViewElement.id.replace('view-', '');
    const currentIndex = viewsOrder.indexOf(currentViewId);
    if (currentIndex === -1) return;

    if (touchendX < touchstartX - swipeThreshold) {
        // Swipe Izquierda -> Avanzar vista
        if (currentIndex < viewsOrder.length - 1) {
            executeViewMutation(viewsOrder[currentIndex + 1]);
        }
    }
    if (touchendX > touchstartX + swipeThreshold) {
        // Swipe Derecha -> Retroceder vista
        if (currentIndex > 0) {
            executeViewMutation(viewsOrder[currentIndex - 1]);
        }
    }
}

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    checkTouchSwipeDirection();
}, { passive: true });


document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    
    const welcomeModal = document.getElementById('view-welcome');
    if (!state.profile.welcomeSeen) {
        welcomeModal.classList.add('active');
        welcomeModal.style.display = 'flex';
        advanceWelcomeSlide(1);
    } else {
        welcomeModal.classList.remove('active');
        welcomeModal.style.display = 'none';
        evaluateOnboardingStateExecution();
    }

    syncFormElements();
    renderIntegratedInventory();
    renderLeadsConsole();
    refreshSandboxPropertyAllocation();
    updateTabDynamicBrackets('inventory');
});

function triggerHapticFeedback() {
    if (navigator.vibrate) {
        navigator.vibrate(8);
    }
}

function showToast(messageText) {
    const rootContainer = document.getElementById('toast-root');
    if (!rootContainer) return;
    const notificationEl = document.createElement('div');
    notificationEl.className = 'toast-notification';
    notificationEl.innerText = messageText;
    rootContainer.appendChild(notificationEl);
    setTimeout(() => {
        notificationEl.style.opacity = '0';
        notificationEl.style.transform = 'translateY(-4px)';
        notificationEl.style.transition = 'all 0.2s ease';
        setTimeout(() => notificationEl.remove(), 200);
    }, 3000);
}

function loadStateFromStorage() {
    try {
        const storedPayload = localStorage.getItem('BOUTIQUE_CRM_STATE');
        if (storedPayload) {
            const compiledObject = JSON.parse(storedPayload);
            if (compiledObject && compiledObject.profile) {
                state = compiledObject;
            }
        }
    } catch (err) {
        console.error("Fallo de lectura desde memoria local:", err);
    }
}

function saveStateToStorage() {
    try {
        localStorage.setItem('BOUTIQUE_CRM_STATE', JSON.stringify(state));
    } catch (err) {
        console.error("Fallo de escritura en memoria local:", err);
    }
}

/* --- ARQUITECTURA DE ONBOARDING ADAPTADO --- */
function advanceWelcomeSlide(slideNum) {
    triggerHapticFeedback();
    document.querySelectorAll('.welcome-slide').forEach(s => s.style.display = 'none');
    document.getElementById(`welcome-slide-${slideNum}`).style.display = 'flex';
    
    for (let i = 1; i <= 4; i++) {
        const block = document.getElementById('pb-' + i);
        if (block) {
            block.style.background = i <= slideNum ? 'var(--text-pure)' : '#27272a';
        }
    }
}   

function initializeInterfaceMapOnboarding() {
    triggerHapticFeedback();
    state.profile.welcomeSeen = true;
    state.profile.onboardingState = 'INTRO';
    state.profile.mapStep = 1;
    saveStateToStorage();

    // Cubrir pantalla ANTES del fade — elimina el pop-in visual
    const blocker = document.getElementById('tour-blocker');
    blocker.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    blocker.style.display = 'block';

    const welcomeModal = document.getElementById('view-welcome');
    welcomeModal.classList.add('exiting');

    setTimeout(function() {
        welcomeModal.style.display = 'none';
        welcomeModal.classList.remove('active');
        welcomeModal.classList.remove('exiting');
        executeViewMutation('inventory');
        evaluateOnboardingStateExecution();
    }, 180);
}

function bypassOnboardingCompletely() {
    triggerHapticFeedback();
    state.profile.welcomeSeen = true;
    state.profile.onboardingState = 'COMPLETED';
    state.profile.mapStep = 0;
    state.profile.tutorialStep = 0;
    saveStateToStorage();
    document.getElementById('view-welcome').style.display = 'none';
    document.getElementById('view-welcome').classList.remove('active');
    document.getElementById('onboarding-guide-widget').style.display = 'none';
    document.getElementById('tour-blocker').style.display = 'none';
    document.querySelectorAll('.ux-spotlight-active').forEach(el => el.classList.remove('ux-spotlight-active'));
    document.querySelectorAll('.ux-spotlight-locked').forEach(el => el.classList.remove('ux-spotlight-locked'));
    document.querySelectorAll('.map-step-settings').forEach(el => el.classList.remove('map-step-settings'));
}

function beginMapFromIntro() {
    triggerHapticFeedback();
    document.getElementById('tour-blocker').style.backgroundColor = 'transparent';
    state.profile.onboardingState = 'MAP';
    state.profile.mapStep = 1;
    saveStateToStorage();
    evaluateOnboardingStateExecution();
}

function setWidgetPosition(verticalAlignment) {
    const widget = document.getElementById('onboarding-guide-widget');
    if (!widget) return;
    
    widget.style.transition = 'opacity 0.15s ease';
    widget.style.opacity = '0';
    
    setTimeout(() => {
        if (verticalAlignment === 'center') {
            widget.style.top = '50%';
            widget.style.bottom = 'auto';
            widget.style.transform = 'translateX(-50%) translateY(-50%)';
        } else if (verticalAlignment === 'top') {
            widget.style.top = '84px';
            widget.style.bottom = 'auto';
            widget.style.transform = 'translateX(-50%)';
        } else if (verticalAlignment === 'mid') {
            widget.style.top = 'auto';
            widget.style.bottom = '30vh';
            widget.style.transform = 'translateX(-50%)';
        } else {
            widget.style.top = 'auto';
            widget.style.bottom = 'calc(16px + env(safe-area-inset-bottom, 0px) + 85px)';
            widget.style.transform = 'translateX(-50%)';
        }
        widget.style.opacity = '1';
    }, 150);
}

function updateTabDynamicBrackets(activeViewId) {
    const totalActive = state.properties.filter(p => !p.is_crystallized).length;
    document.getElementById('lbl-tab-inventory').innerText = `Activos [${totalActive}]`;
}

function evaluateOnboardingStateExecution() {
    const widget = document.getElementById('onboarding-guide-widget');
    const blocker = document.getElementById('tour-blocker');
    
    document.querySelectorAll('.ux-spotlight-active').forEach(el => el.classList.remove('ux-spotlight-active'));
    document.querySelectorAll('.ux-spotlight-locked').forEach(el => el.classList.remove('ux-spotlight-locked'));
    document.querySelectorAll('.map-step-settings').forEach(el => el.classList.remove('map-step-settings'));
    
    if (state.profile.onboardingState === 'COMPLETED') {
        widget.style.display = 'none';
        blocker.style.display = 'none';
        return;
    }

    widget.style.display = 'flex';
    blocker.style.display = 'block'; 

    const title = document.getElementById('onboarding-widget-title');
    const body = document.getElementById('onboarding-widget-body');
    const actions = document.getElementById('onboarding-widget-actions');

    // ESTADO INTRO: Elección inicial antes del Mapa Guiado
    if (state.profile.onboardingState === 'INTRO') {
        blocker.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        setWidgetPosition('center');
        title.innerText = "¿Cómo desea comenzar?";
        body.innerHTML = "Puede seguir el <strong>Mapa Guiado</strong> para conocer cada sección del sistema, o explorar directamente por su cuenta.";
        actions.innerHTML = `
            <button class="btn-row-action" style="color: var(--text-muted);" onclick="bypassOnboardingCompletely()">[Explorar Libre]</button>
            <button class="btn-row-action" style="background-color: var(--accent-color); color: var(--accent-contrast); border-color: var(--accent-color);" onclick="beginMapFromIntro()">[Iniciar Mapa]</button>
        `;
    }

    // FASE 1: Mapa Guiado Macro
    else if (state.profile.onboardingState === 'MAP') {
        switch (state.profile.mapStep) {
            case 1:
                setWidgetPosition('top');
                const headerEl = document.getElementById('ui-main-header');
                if (headerEl) headerEl.classList.add('ux-spotlight-active', 'ux-spotlight-locked');
                title.innerText = "Mapa: Paso 1 de 5";
                body.innerHTML = "Este es el <strong>Encabezado de Control</strong>. Aquí visualiza la marca de su negocio y el identificador único del agente operativo.";
                actions.innerHTML = `
                    <button class="btn-row-action" style="border-color: var(--scale-a); color: var(--scale-a);" onclick="navigateMapOnboarding(1)">[Siguiente]</button>
                `;
                break;
            case 2:
                setWidgetPosition('bottom');
                const footerBar = document.getElementById('ui-tabs-bar');
                if (footerBar) footerBar.classList.add('ux-spotlight-active', 'ux-spotlight-locked');
                title.innerText = "Mapa: Paso 2 de 5";
                body.innerHTML = "Esta es la <strong>Barra de Navegación de Terreno</strong>. Permite alternar de forma fluida e instantánea entre las Propiedades, el Consola de Clientes y el Evaluador Tecnológico Sandbox.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateMapOnboarding(-1)">[Atrás]</button>
                    <button class="btn-row-action" style="border-color: var(--scale-a); color: var(--scale-a);" onclick="navigateMapOnboarding(1)">[Siguiente]</button>
                `;
                break;
            case 3:
                setWidgetPosition('mid');
                const inventoryCard = document.getElementById('active-assets-card');
                if (inventoryCard) inventoryCard.classList.add('ux-spotlight-active', 'ux-spotlight-locked');
                title.innerText = "Mapa: Paso 3 de 5";
                body.innerHTML = "Este panel lista sus <strong>Propiedades Activas</strong>. Dispone de un límite estricto de 4 espacios paralelos para mantener el foco en sus cierres comerciales más rentables.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateMapOnboarding(-1)">[Atrás]</button>
                    <button class="btn-row-action" style="border-color: var(--scale-a); color: var(--scale-a);" onclick="navigateMapOnboarding(1)">[Siguiente]</button>
                `;
                break;
            case 4:
                setWidgetPosition('top');
                const crystallizedCard = document.getElementById('crystallized-assets-card');
                if (crystallizedCard) crystallizedCard.classList.add('ux-spotlight-active', 'ux-spotlight-locked');
                title.innerText = "Mapa: Paso 4 de 5";
                body.innerHTML = "Esta es la sección de <strong>Propiedades Archivadas</strong>. Aquí se almacenan los activos que han concluido su ciclo activo: cierres, retiros o mandatos vencidos. El historial queda disponible para consulta permanente.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateMapOnboarding(-1)">[Atrás]</button>
                    <button class="btn-row-action" style="border-color: var(--scale-a); color: var(--scale-a);" onclick="navigateMapOnboarding(1)">[Siguiente]</button>
                `;
                break;
            case 5:
                setWidgetPosition('top');
                const settingsHeader = document.getElementById('ui-main-header');
                if (settingsHeader) settingsHeader.classList.add('ux-spotlight-active', 'ux-spotlight-locked', 'map-step-settings');
                title.innerText = "Mapa: Paso 5 de 5";
                body.innerHTML = "Este botón abre los <strong>Ajustes de Plataforma</strong>. Desde allí configura su identidad comercial, personaliza las plantillas de WhatsApp y puede reiniciar las guías operativas cuando lo necesite.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateMapOnboarding(-1)">[Atrás]</button>
                    <button class="btn-row-action" style="border-color: var(--scale-a); color: var(--scale-a);" onclick="concludeMapAndOfferSimulation()">[Concluir]</button>
                `;
                break;    
        }
    }
    
    // FASE 2: Decisión de Simulación Operativa
    else if (state.profile.onboardingState === 'CHOICE') {
        setWidgetPosition('bottom');
        title.innerText = "Mapa Concluido";
        body.innerHTML = "¿Desea iniciar una <strong>Simulación Práctica</strong> guiada imitando un caso real de atención, o prefiere comenzar a operar el sistema de inmediato?";
        actions.innerHTML = `
            <button class="btn-row-action" style="border-color: var(--scale-b1); color: var(--scale-b1);" onclick="bypassOnboardingCompletely()">[Operar Libre]</button>
            <button class="btn-row-action" style="background-color: var(--accent-color); color: var(--accent-contrast);" onclick="initiateGuidedSimulationSequence()">[Iniciar Simulación]</button>
        `;
    }

    // FASE 3: Simulación Táctica Guiada
    else if (state.profile.onboardingState === 'SIMULATION') {
        switch (state.profile.tutorialStep) {
            case 1:
                setWidgetPosition('bottom');
                const addBtn = document.querySelector('#active-assets-card .btn-row-action');
                if (addBtn) addBtn.classList.add('ux-spotlight-active');
                title.innerText = "Simulación: Caso Real (1/5)";
                body.innerHTML = "Imaginemos que ingresa una oportunidad de corretaje exclusiva. Presione el botón <strong>[Añadir]</strong> en el panel de control superior para desplegar la ficha técnica.";
                actions.innerHTML = [];
                break;
            case 2:
                setWidgetPosition('bottom');
                const formCard = document.getElementById('asset-creation-drawer');
                if (formCard) formCard.classList.add('ux-spotlight-active');
                title.innerText = "Simulación: Caso Real (2/5)";
                
                document.getElementById('asset-slug').value = "CASA-ALMAGRO";
                document.getElementById('asset-commune').value = "Ñuñoa";
                document.getElementById('asset-price').value = "9200";

                body.innerHTML = "Hemos pre-completado los datos técnicos: <strong>CASA-ALMAGRO</strong> en Ñuñoa por 9.200 UF. Presione el botón de guardado para grabarlo físicamente.";
                actions.innerHTML = [];
                break;
            case 3:
                setWidgetPosition('bottom');
                const sandTab = document.getElementById('tab-sandbox');
                if (sandTab) sandTab.classList.add('ux-spotlight-active');
                title.innerText = "Simulación: Caso Real (3/5)";
                body.innerHTML = "¡Propiedad grabada! Ahora ingresa un cliente interesado. Para calificarlo operacionalmente sin sesgos, diríjase a la pestaña de <strong>Calificar</strong> (Sandbox).";
                actions.innerHTML = [];
                break;
            case 4:
                setWidgetPosition('bottom');
                const invTab = document.getElementById('tab-inventory');
                if (invTab) invTab.classList.add('ux-spotlight-active');
                title.innerText = "Simulación: Caso Real (4/5)";
                body.innerHTML = "El cliente contestó el cuestionario táctico y fue indexado. Volvamos a la vista de <strong>Activos</strong> para ver la ficha.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateSimulationStep(-1)">[Atrás]</button>
                `;
                break;
            case 5:
                setWidgetPosition('bottom');
                const archiveBtn = document.querySelector('#active-inventory-list .item-actions-wrapper .btn-row-action[style*="scale-c"]');
                if (archiveBtn) archiveBtn.className += " ux-spotlight-active";
                title.innerText = "Simulación: Caso Real (5/5)";
                body.innerHTML = "¡Ficha técnica desplegada! Aquí visualiza al prospecto, su nivel de prioridad y el enlace a WhatsApp. Para concluir definitivamente el tour, presione <strong>[Archivar]</strong>.";
                actions.innerHTML = `
                    <button class="btn-row-action" onclick="navigateSimulationStep(-1)">[Atrás]</button>
                `;
                break;
        }
    }

    if (state.profile.onboardingState === 'MAP' || state.profile.onboardingState === 'SIMULATION') {
        const escapeBtn = document.createElement('button');
        escapeBtn.className = 'btn-row-action';
        escapeBtn.style.color = 'var(--text-muted)';
        escapeBtn.innerText = '[Saltar]';
        escapeBtn.onclick = bypassOnboardingCompletely;
        actions.appendChild(escapeBtn);
    }
}

function navigateMapOnboarding(direction) {
    triggerHapticFeedback();
    state.profile.mapStep += direction;
    if (state.profile.mapStep < 1) state.profile.mapStep = 1;
    if (state.profile.mapStep > 5) state.profile.mapStep = 5;
    saveStateToStorage();
    evaluateOnboardingStateExecution();
}

function navigateSimulationStep(direction) {
    triggerHapticFeedback();
    state.profile.tutorialStep += direction;
    if (state.profile.tutorialStep < 1) {
        state.profile.onboardingState = 'CHOICE';
        saveStateToStorage();
        evaluateOnboardingStateExecution();
        return;
    }

    if (state.profile.tutorialStep === 1) {
        executeViewMutation('inventory');
        toggleAssetForm(false);
    } else if (state.profile.tutorialStep === 2) {
        executeViewMutation('inventory');
        if (state.properties.length > 0 && direction < 0) {
            state.properties.pop();
            renderIntegratedInventory();
        }
    } else if (state.profile.tutorialStep === 3) {
        executeViewMutation('sandbox');
        resetSandboxWizardState();
    } else if (state.profile.tutorialStep === 4) {
        executeViewMutation('inventory');
        if (state.leads.length > 0 && direction < 0) {
            state.leads.shift();
            renderLeadsConsole();
            renderIntegratedInventory();
        }
    }
    saveStateToStorage();
    evaluateOnboardingStateExecution();
}

function concludeMapAndOfferSimulation() {
    triggerHapticFeedback();
    state.profile.onboardingState = 'CHOICE';
    saveStateToStorage();
    evaluateOnboardingStateExecution();
}

function initiateGuidedSimulationSequence() {
    triggerHapticFeedback();
    state.profile.onboardingState = 'SIMULATION';
    state.profile.tutorialStep = 1;
    saveStateToStorage();
    executeViewMutation('inventory');
    toggleAssetForm(false);
    evaluateOnboardingStateExecution();
}

/* --- CONTROL DE VISTAS Y CONFIGURACIÓN --- */
function toggleProfileModal(shouldOpen) {
    triggerHapticFeedback();
    const modal = document.getElementById('view-profile');
    if (shouldOpen) {
        syncFormElements();
        modal.classList.add('active');
        if (state.profile.onboardingState === 'COMPLETED') {
            triggerSettingsSubTourLogic();
        }
    } else {
        modal.classList.remove('active');
        document.getElementById('settings-card-profile').style.outline = 'none';
        document.getElementById('settings-card-templates').style.outline = 'none';
    }
}

function syncFormElements() {
    document.getElementById('input-broker-name').value = state.profile.name || 'Boutique Assets';
    document.getElementById('ui-brand-name').innerText = state.profile.name || 'Boutique Assets';
    if (state.profile.whatsappTemplates) {
        document.getElementById('wats-template-A').value = state.profile.whatsappTemplates['A'] || '';
        document.getElementById('wats-template-B1').value = state.profile.whatsappTemplates['B1'] || '';
        document.getElementById('wats-template-B2').value = state.profile.whatsappTemplates['B2'] || '';
        document.getElementById('wats-template-C').value = state.profile.whatsappTemplates['C'] || '';
    }
}

function saveProfileConfiguration() {
    triggerHapticFeedback();
    const brandNameValue = document.getElementById('input-broker-name').value.trim();
    if (brandNameValue) {
        state.profile.name = brandNameName = brandNameValue;
        document.getElementById('ui-brand-name').innerText = brandNameValue;
    }
    
    state.profile.whatsappTemplates['A'] = document.getElementById('wats-template-A').value;
    state.profile.whatsappTemplates['B1'] = document.getElementById('wats-template-B1').value;
    state.profile.whatsappTemplates['B2'] = document.getElementById('wats-template-B2').value;
    state.profile.whatsappTemplates['C'] = document.getElementById('wats-template-C').value;

    saveStateToStorage();
    showToast("Configuración del Sistema Actualizada");
    toggleProfileModal(false);
}

function restartInteractiveTutorial() {
    triggerHapticFeedback();
    state.profile.welcomeSeen = false;
    state.profile.onboardingState = 'WELCOME';
    state.profile.mapStep = 1;
    state.profile.tutorialStep = 1;
    state.profile.settingsTourSeen = false;
    state.profile.settingsStep = 1;
    
    state.properties = [];
    state.leads = [];
    saveStateToStorage();
    
    toggleProfileModal(false);
    
    const welcomeModal = document.getElementById('view-welcome');
    welcomeModal.classList.add('active');
    welcomeModal.style.display = 'flex';
    advanceWelcomeSlide(1);
    
    syncFormElements();
    renderIntegratedInventory();
    renderLeadsConsole();
    refreshSandboxPropertyAllocation();
    updateTabDynamicBrackets('inventory');
}

function triggerSettingsSubTourLogic() {
    if (state.profile.settingsTourSeen) return;
    const subWidget = document.getElementById('settings-guide-widget');
    subWidget.style.display = 'flex';
    state.profile.settingsStep = 1;
    renderSettingsTourStep();
}

function renderSettingsTourStep() {
    const title = document.getElementById('settings-guide-title');
    const body = document.getElementById('settings-guide-body');
    const btnPrev = document.getElementById('settings-guide-btn-prev');
    
    document.getElementById('settings-card-profile').style.outline = "none";
    document.getElementById('settings-card-templates').style.outline = "none";

    if (state.profile.settingsStep === 1) {
        title.innerText = "Ajustes: Paso 1 de 2";
        body.innerHTML = "En esta sección puede sobreescribir el <strong>Nombre Comercial</strong> que se inyectará en las variables dinámicas.";
        document.getElementById('settings-card-profile').style.outline = "2px solid var(--scale-a)";
        btnPrev.style.visibility = 'hidden';
    } else {
        title.innerText = "Ajustes: Paso 2 de 2";
        body.innerHTML = "Aquí define el texto base de sus comunicaciones. El sistema elegirá de forma precisa el mensaje según el rango de prioridad calculado.";
        document.getElementById('settings-card-templates').style.outline = "2px solid var(--scale-a)";
        btnPrev.style.visibility = 'visible';
    }
}

function navigateSettingsTour(direction) {
    triggerHapticFeedback();
    state.profile.settingsStep += direction;
    if (state.profile.settingsStep > 2) {
        state.profile.settingsTourSeen = true;
        state.profile.settingsStep = 1;
        document.getElementById('settings-guide-widget').style.display = 'none';
        document.getElementById('settings-card-profile').style.outline = 'none';
        document.getElementById('settings-card-templates').style.outline = 'none';
        saveStateToStorage();
        showToast("Guía de ajustes completada");
        return;
    }
    if (state.profile.settingsStep < 1) state.profile.settingsStep = 1;
    saveStateToStorage();
    renderSettingsTourStep();
}

function executeViewMutation(targetViewId) {
    triggerHapticFeedback();
    
    if (state.profile.onboardingState === 'MAP' || state.profile.onboardingState === 'SIMULATION') {
        if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 3 && targetViewId === 'sandbox') {
            // Permitir navegación requerida en la simulación
        } else if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 4 && targetViewId === 'inventory') {
            // Permitir navegación requerida en la simulación
        } else {
            showToast("Navegación bloqueada durante el recorrido instructivo");
            return;
        }
    }
    
    document.querySelectorAll('.crm-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${targetViewId}`);
    const targetTab = document.getElementById(`tab-${targetViewId}`);
    
    if (targetView) targetView.classList.add('active');
    if (targetTab) targetTab.classList.add('active');
    
    if (targetViewId === 'inventory') renderIntegratedInventory();
    if (targetViewId === 'leads') renderLeadsConsole();
    if (targetViewId === 'sandbox') refreshSandboxPropertyAllocation();
}

/* --- ARQUEOLOGÍA DE SISTEMAS: COMPONENTE GEOMÉTRICO GLYPH --- */
function generateGeometricGlyph(idString, pricingNumeric) {
    let seed = 0;
    const combinedString = idString + pricingNumeric.toString();
    for (let idx = 0; idx < combinedString.length; idx++) {
        seed += combinedString.charCodeAt(idx);
    }
    const linesCount = 4 + (seed % 6);
    const center = 18;
    const radius = 14;
    
    let svgString = `<svg width="36" height="36" viewBox="0 0 36 36" style="border:1px solid var(--border-subtle); border-radius:4px;">`;
    svgString += `<circle cx="${center}" cy="${center}" r="${Math.min(16, 4 + linesCount)}" fill="none" stroke="#27272a" stroke-width="0.5"/>`;
    
    for (let i = 0; i < linesCount; i++) {
        const rotationAngle = (i * 2 * Math.PI) / linesCount + (seed % 50) / 50;
        const forwardAngle = ((i + 2) * 2 * Math.PI) / linesCount + (seed % 50) / 50;
        const x1 = center + radius * Math.cos(rotationAngle);
        const y1 = center + radius * Math.sin(rotationAngle);
        const x2 = center + radius * Math.cos(forwardAngle);
        const y2 = center + radius * Math.sin(forwardAngle);
        svgString += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a1a1aa" stroke-width="0.75" opacity="0.65"/>`;
    }
    svgString += `</svg>`;
    return svgString;
}

function toggleMetadataDrawer(propertyId) {
    triggerHapticFeedback();
    const drawer = document.getElementById(`drawer-${propertyId}`);
    if (drawer) {
        const isCurrentlyActive = drawer.classList.contains('active');
        drawer.classList.toggle('active', !isCurrentlyActive);
        document.getElementById(`btn-info-${propertyId}`).innerText = isCurrentlyActive ? '[+Info]' : '[-Info]';
        
        if (!isCurrentlyActive && state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 4) {
            state.profile.tutorialStep = 5;
            saveStateToStorage();
            evaluateOnboardingStateExecution();
        }
    }
}

function executeExportJsonPayload(propertyId) {
    triggerHapticFeedback();
    const targetedAsset = state.properties.find(p => p.property_id === propertyId);
    if (!targetedAsset) return;

    const structuredData = {
        key: "CRM_EXPORT_RECORD",
        property: targetedAsset,
        associated_leads: state.leads.filter(l => l.property_id === propertyId)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(structuredData, null, 4));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Ficha_${targetedAsset.slug.toUpperCase()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Archivo JSON generado con éxito");
}

/* --- OPERACIONES CORE DEL INVENTARIO INMOBILIARIO --- */
function toggleAssetForm(shouldShow) {
    triggerHapticFeedback();
    const drawerForm = document.getElementById('asset-creation-drawer');
    if (shouldShow) {
        const activeCount = state.properties.filter(p => !p.is_crystallized).length;
        if (activeCount >= 5) {
            showToast("Límite Operativo Excedido: Máximo 5 activos en paralelo.");
            return;
        }
        drawerForm.style.display = 'flex';
        if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 1) {
            state.profile.tutorialStep = 2;
            saveStateToStorage();
            evaluateOnboardingStateExecution();
        }
    } else {
        drawerForm.style.display = 'none';
    }
}

function saveNewAsset() {
    triggerHapticFeedback();
    const slugInput = document.getElementById('asset-slug').value.trim();
    const communeInput = document.getElementById('asset-commune').value.trim();
    const priceInput = parseInt(document.getElementById('asset-price').value);

    if (!slugInput || !communeInput || isNaN(priceInput) || priceInput <= 0) {
        showToast("Por favor complete todos los parámetros técnicos necesarios.");
        return;
    }

    const activeCount = state.properties.filter(p => !p.is_crystallized).length;
    if (activeCount >= 5) {
        showToast("Saturación de Memoria Local: archive propiedades previas.");
        return;
    }

    const uniqueId = 'prop_' + Date.now();
    const assetPayload = {
        property_id: uniqueId,
        slug: slugInput,
        location_commune: communeInput,
        price_uf: priceInput,
        is_crystallized: false,
        timestamp: new Date().toLocaleDateString('es-CL')
    };

    state.properties.unshift(assetPayload);
    saveStateToStorage();

    // Limpieza física del formulario
    document.getElementById('asset-slug').value = '';
    document.getElementById('asset-commune').value = '';
    document.getElementById('asset-price').value = '';
    document.getElementById('asset-creation-drawer').style.display = 'none';

    renderIntegratedInventory();
    refreshSandboxPropertyAllocation();
    updateTabDynamicBrackets('inventory');

    showToast(`Activo [${slugInput}] grabado debidamente.`);

    if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 2) {
        state.profile.tutorialStep = 3;
        saveStateToStorage();
        evaluateOnboardingStateExecution();
    }
}

function archiveAsset(propertyId) {
    triggerHapticFeedback();
    const assetIndex = state.properties.findIndex(p => p.property_id === propertyId);
    if (assetIndex === -1) return;

    state.properties[assetIndex].is_crystallized = true;
    saveStateToStorage();
    renderIntegratedInventory();
    updateTabDynamicBrackets('inventory');
    showToast("Propiedad desplazada al inventario archivado");

    if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 5) {
        state.profile.onboardingState = 'COMPLETED';
        state.profile.mapStep = 0;
        state.profile.tutorialStep = 0;
        saveStateToStorage();
        evaluateOnboardingStateExecution();
        showToast("¡Enhorabuena! Simulación finalizada con éxito.");
    }
}

function deleteAssetPermanent(propertyId) {
    triggerHapticFeedback();
    if (confirm("¿Confirma la remoción permanente de este activo y todos sus prospectos vinculados?")) {
        state.properties = state.properties.filter(p => p.property_id !== propertyId);
        state.leads = state.leads.filter(l => l.property_id !== propertyId);
        saveStateToStorage();
        renderIntegratedInventory();
        renderLeadsConsole();
        refreshSandboxPropertyAllocation();
        updateTabDynamicBrackets('inventory');
        showToast("Eliminado del almacenamiento del dispositivo");
    }
}

function renderIntegratedInventory() {
    const activeList = document.getElementById('active-inventory-list');
    const archivedList = document.getElementById('crystallized-inventory-list');

    activeList.innerHTML = '';
    archivedList.innerHTML = '';

    const actives = state.properties.filter(p => !p.is_crystallized);
    const archives = state.properties.filter(p => p.is_crystallized);

    if (actives.length === 0) {
        activeList.innerHTML = `
            <div class="empty-canvas">
                <div class="empty-icon-btn" onclick="toggleAssetForm(true)">+</div>
                <h3>Sin Propiedades Activas</h3>
                <p>Registre su primer activo inmobiliario local para desplegar el mapa comercial.</p>
            </div>`;
    } else {
        actives.forEach(prop => {
            const estimatedClp = prop.price_uf * UF_CONVERSION_FACTOR;
            const propertyLeads = state.leads.filter(l => l.property_id === prop.property_id);
            
            let embeddedLeadsHtml = '';
            if (propertyLeads.length === 0) {
                embeddedLeadsHtml = '<p style="font-size:11px; color:var(--text-muted); font-style:italic;">No hay clientes evaluados para este activo todavía.</p>';
            } else {
                embeddedLeadsHtml += `<div class="embedded-leads-container">`;
                propertyLeads.forEach(lead => {
                    let encodedTemplate = (state.profile.whatsappTemplates && state.profile.whatsappTemplates[lead.score]) ? state.profile.whatsappTemplates[lead.score] : '';
                    if (!encodedTemplate) {
                        encodedTemplate = "Hola {name}, coordinemos una llamada sobre el activo {slug}.";
                    }
                    const customizedText = encodedTemplate
                        .replace(/{name}/g, lead.name)
                        .replace(/{slug}/g, prop.slug)
                        .replace(/{broker}/g, state.profile.name || "Boutique Assets");

                    const waUrl = `https://api.whatsapp.com/send?phone=${lead.phone.replace(/\D/g, '')}&text=${encodeURIComponent(customizedText)}`;
                    
                    embeddedLeadsHtml += `
                        <div class="embedded-lead-row">
                            <div class="embedded-lead-info">
                                <span class="score-badge ${lead.score}">${TIER_NAMES[lead.score] || lead.score}</span>
                                <span style="font-size:12px; font-weight:500;">${lead.name}</span>
                            </div>
                            <a href="${waUrl}" target="_blank" class="btn-row-action" style="border-color: var(--scale-a); font-size:10px; min-height:30px; padding:2px 8px;">[WhatsApp]</a>
                        </div>`;
                });
                embeddedLeadsHtml += `</div>`;
            }

            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <div class="item-main-row">
                    <div class="glyph-container">${generateGeometricGlyph(prop.property_id, prop.price_uf)}</div>
                    <div class="item-meta">
                        <h4>${prop.slug}</h4>
                        <p>${prop.location_commune} • <strong>${Number(prop.price_uf).toLocaleString('es-CL')} UF</strong></p>
                        <div class="telemetry-row">
                            <span>Clientes: <strong class="telemetry-badge">${propertyLeads.length} / 10</strong></span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button id="btn-info-${prop.property_id}" class="btn-row-action" onclick="toggleMetadataDrawer('${prop.property_id}')">[+Info]</button>
                    </div>
                </div>
                <div id="drawer-${prop.property_id}" class="metadata-drawer">
                    <div class="metadata-line"><span>ID INTERNO:</span> <strong>${prop.property_id}</strong></div>
                    <div class="metadata-line"><span>FECHA REGISTRO:</span> <strong>${prop.timestamp || 'Base'}</strong></div>
                    <div class="metadata-line"><span>VALOR ESTIMADO EN PESOS:</span> <strong>$${estimatedClp.toLocaleString('es-CL')}</strong></div>
                    <div style="margin-top:8px; margin-bottom:4px;">
                        <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700; margin-bottom: 6px;">Clientes Vinculados:</p>
                        ${embeddedLeadsHtml}
                    </div>
                </div>
                <div class="item-actions-wrapper">
                    <button class="btn-row-action" onclick="executeExportJsonPayload('${prop.property_id}')">[Backup JSON]</button>
                    <button class="btn-row-action" style="color: var(--scale-c); border-color: rgba(199,58,74,0.3);" onclick="archiveAsset('${prop.property_id}')">[Archivar]</button>
                </div>`;
            activeList.appendChild(el);
        });
    }

    if (archives.length === 0) {
        archivedList.innerHTML = '<p style="font-size:11px; color:var(--text-muted); text-align:center; padding:14px 0;">No se registran propiedades en el archivo.</p>';
    } else {
        archives.forEach(prop => {
            const el = document.createElement('div');
            el.className = 'list-item crystallized-card';
            el.innerHTML = `
                <div class="item-main-row">
                    <div class="item-meta">
                        <h4 style="color: var(--text-muted); text-decoration: line-through;">${prop.slug}</h4>
                        <p style="font-size:11px;">${prop.location_commune} • Archivada el ${prop.timestamp || 'Reciente'}</p>
                    </div>
                    <button class="btn-row-action" style="color: var(--scale-c); border-color: transparent;" onclick="deleteAssetPermanent('${prop.property_id}')">[Eliminar]</button>
                </div>`;
            archivedList.appendChild(el);
        });
    }
}

/* --- MOTOR DE CALIFICACIÓN SANDBOX --- */
function refreshSandboxPropertyAllocation() {
    const selector = document.getElementById('sandbox-prop-select');
    selector.innerHTML = '';
    const actives = state.properties.filter(p => !p.is_crystallized);
    
    if (actives.length === 0) {
        const opt = document.createElement('option');
        opt.text = "Inscriba una propiedad activa primero";
        selector.add(opt);
        document.getElementById('btn-start-wizard').disabled = true;
    } else {
        actives.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.property_id;
            opt.text = p.slug;
            selector.add(opt);
        });
        document.getElementById('btn-start-wizard').disabled = false;
    }
}

function initiateSandboxWizardExecution() {
    triggerHapticFeedback();
    const propSelect = document.getElementById('sandbox-prop-select').value;
    const clientName = document.getElementById('sandbox-lead-name').value.trim();
    const clientPhone = document.getElementById('sandbox-lead-phone').value.trim();

    if (!propSelect || !clientName || !clientPhone) {
        showToast("Parámetros del Prospecto incompletos.");
        return;
    }

    const matchedLeadsCount = state.leads.filter(l => l.property_id === propSelect).length;
    if (matchedLeadsCount >= 10) {
        showToast("Saturación Ficha: Límite estricto de 10 clientes por propiedad.");
        return;
    }

    state.sandboxWizard.currentLead = {
        lead_id: 'lead_' + Date.now(),
        property_id: propSelect,
        name: clientName,
        phone: clientPhone,
        answers_log: []
    };

    state.sandboxWizard.currentStep = 1;
    state.sandboxWizard.totalScore = 0;

    document.getElementById('sandbox-setup').style.display = 'none';
    document.getElementById('sandbox-wizard-panel').style.display = 'flex';

    document.querySelectorAll('.wizard-step').forEach(ws => ws.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');
    document.getElementById('wizard-progress').innerText = "Pregunta 1 de 4";
}

function abortSandboxWizardContext() {
    triggerHapticFeedback();
    resetSandboxWizardState();
    showToast("Evaluación Sandbox Cancelada");
}

function resetSandboxWizardState() {
    state.sandboxWizard.currentStep = 1;
    state.sandboxWizard.totalScore = 0;
    state.sandboxWizard.currentLead = {};
    
    document.getElementById('sandbox-lead-name').value = '';
    document.getElementById('sandbox-lead-phone').value = '';
    document.getElementById('sandbox-setup').style.display = 'flex';
    document.getElementById('sandbox-wizard-panel').style.display = 'none';
}

function advanceWizardStep(valueGained, summaryText) {
    triggerHapticFeedback();
    state.sandboxWizard.totalScore += valueGained;
    state.sandboxWizard.currentLead.answers_log.push(summaryText);

    const currentStepIndex = state.sandboxWizard.currentStep;
    
    if (currentStepIndex < 4) {
        document.getElementById(`step-${currentStepIndex}`).classList.remove('active');
        const nextStep = currentStepIndex + 1;
        state.sandboxWizard.currentStep = nextStep;
        document.getElementById(`step-${nextStep}`).classList.add('active');
        document.getElementById('wizard-progress').innerText = `Pregunta ${nextStep} de 4`;
    } else {
        let totalScoreTier = 'C';
        const finalAggregatePoints = state.sandboxWizard.totalScore;
        
        if (finalAggregatePoints >= 9) totalScoreTier = 'A';
        else if (finalAggregatePoints >= 7) totalScoreTier = 'B1';
        else if (finalAggregatePoints >= 5) totalScoreTier = 'B2';

        const timestampClock = new Date();
        const displayClockFormatted = `${timestampClock.getHours().toString().padStart(2, '0')}:${timestampClock.getMinutes().toString().padStart(2, '0')}`;

        const constructedLeadObject = {
            ...state.sandboxWizard.currentLead,
            score: totalScoreTier,
            timestamp: displayClockFormatted
        };

        state.leads.unshift(constructedLeadObject);
        saveStateToStorage();
        renderLeadsConsole();
        renderIntegratedInventory(); 
        
        showToast(`Evaluación: Clasificado en [${TIER_NAMES[totalScoreTier]}]`);
        
        resetSandboxWizardState();

        if (state.profile.onboardingState === 'SIMULATION' && state.profile.tutorialStep === 3) {
            state.profile.tutorialStep = 4;
            saveStateToStorage();
            evaluateOnboardingStateExecution();
        }

        executeViewMutation('inventory');
    }
}

/* --- CONSOLA OPERATIVA DE CLIENTES --- */
function setLeadFilter(filterType) {
    triggerHapticFeedback();
    state.runtimeFilters.leadFilter = filterType;
    document.getElementById('filter-all').classList.remove('active');
    document.getElementById('filter-premium').classList.remove('active');
    
    if (filterType === 'ALL') document.getElementById('filter-all').classList.add('active');
    if (filterType === 'HIGH') document.getElementById('filter-premium').classList.add('active');
    renderLeadsConsole();
}

function toggleLeadSortOrder() {
    triggerHapticFeedback();
    state.runtimeFilters.reverseLeads = !state.runtimeFilters.reverseLeads;
    document.getElementById('filter-rev').classList.toggle('active', state.runtimeFilters.reverseLeads);
    renderLeadsConsole();
}

function renderLeadsConsole() {
    const container = document.getElementById('leads-list');
    container.innerHTML = '';

    let subset = [...state.leads];

    if (state.runtimeFilters.leadFilter === 'HIGH') {
        subset = subset.filter(l => l.score === 'A');
    }
    if (state.runtimeFilters.reverseLeads) {
        subset.reverse();
    }

    if (subset.length === 0) {
        container.innerHTML = '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:24px 10px;">No se registran clientes bajo este criterio.</p>';
        return;
    }

    subset.forEach(lead => {
        const itemBox = document.createElement('div');
        itemBox.className = 'list-item';

        const parentProp = state.properties.find(p => p.property_id === lead.property_id);
        const assetName = parentProp ? parentProp.slug : "Desconocido / Eliminado";

        let encodedTemplate = (state.profile.whatsappTemplates && state.profile.whatsappTemplates[lead.score]) ? state.profile.whatsappTemplates[lead.score] : '';
        if (!encodedTemplate) {
            encodedTemplate = "Hola {name}, coordinemos para ver la propiedad {slug}.";
        }
        const customizedText = encodedTemplate
            .replace(/{name}/g, lead.name)
            .replace(/{slug}/g, assetName)
            .replace(/{broker}/g, state.profile.name || "Boutique Assets");

        const targetWaLink = `https://api.whatsapp.com/send?phone=${lead.phone.replace(/\D/g, '')}&text=${encodeURIComponent(customizedText)}`;

        let historyHtml = '';
        if (lead.answers_log && lead.answers_log.length > 0) {
            historyHtml = `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.04); font-size:11px; color:var(--text-muted); display:flex; flex-direction:column; gap:2px;">`;
            lead.answers_log.forEach(ans => {
                historyHtml += `<span>• ${ans}</span>`;
            });
            historyHtml += `</div>`;
        }

        itemBox.innerHTML = `
            <div class="item-main-row">
                <div class="item-meta">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
                        <span class="score-badge ${lead.score}">${TIER_NAMES[lead.score] || lead.score}</span>
                        <h4 style="font-size:14px;">${lead.name}</h4>
                    </div>
                    <p style="font-size:11px;">Vinculado a: <strong>${assetName}</strong> • Tel: ${lead.phone}</p>
                    ${historyHtml}
                </div>
                <div style="display:flex; align-items:center;">
                    <a href="${targetWaLink}" target="_blank" class="btn-row-action" style="border-color: var(--scale-a);">[WhatsApp]</a>
                </div>
            </div>`;
        container.appendChild(itemBox);
    });
}

// Robustecimiento de la navegación por gestos táctiles (Swipe)
(function() {
    let touchStartX = 0;
    let touchStartY = 0;
    const tabsOrder = ['inventory', 'leads', 'sandbox'];

    window.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        // Bloquear navegación táctil si el onboarding está activo e impide la libre navegación
        if (state.profile.onboardingState !== 'COMPLETED') {
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Validar que el gesto sea predominantemente horizontal y supere un umbral mínimo (swipe)
        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
            // Determinar la pestaña activa actual inspeccionando el DOM o las clases
            const activeBtn = document.querySelector('.tab-btn.active');
            if (!activeBtn) return;
            
            const currentTabId = activeBtn.id.replace('tab-', '');
            const currentIndex = tabsOrder.indexOf(currentTabId);
            
            if (currentIndex !== -1) {
                if (diffX < 0 && currentIndex < tabsOrder.length - 1) {
                    // Swipe a la izquierda: avanza a la siguiente pestaña
                    executeViewMutation(tabsOrder[currentIndex + 1]);
                } else if (diffX > 0 && currentIndex > 0) {
                    // Swipe a la derecha: vuelve a la pestaña anterior
                    executeViewMutation(tabsOrder[currentIndex - 1]);
                }
            }
        }
    }, { passive: true });
})();