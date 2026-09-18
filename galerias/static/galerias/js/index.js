document.addEventListener('DOMContentLoaded', function () {
    const planSelector = document.getElementById('plan-selector');
    const camposExperienciaPremium = document.getElementById('campos-experiencia-premium');
    const camposPremium = document.getElementById('campos-premium');
    const horasExtraInput = document.getElementById('horas-extra');
    
    // TEMAS DE COLOR ELEMENTS
    const selectTema = document.querySelector('select[name="tema_color"]') || document.getElementById('id_tema_color');
    const swatchCards = document.querySelectorAll('.tema-swatch-card');
    const temaLiveNombre = document.getElementById('tema-live-nombre');
    const temaLiveMockup = document.getElementById('tema-live-mockup');
    const temaLiveButton = document.getElementById('tema-live-button');
    const temaLiveText = document.getElementById('tema-live-text');

    const indPrimary = document.getElementById('cuadrito-indicator-primary');
    const indBg = document.getElementById('cuadrito-indicator-bg');
    const indText = document.getElementById('cuadrito-indicator-text');

    const valPrimary = document.getElementById('val-indicator-primary');
    const valBg = document.getElementById('val-indicator-bg');
    const valText = document.getElementById('val-indicator-text');

    // MARCOS ELEMENTS
    const selectMarco = document.querySelector('select[name="marco_seleccionado"]') || document.getElementById('id_marco_seleccionado');
    const marcoPills = document.querySelectorAll('.marco-pill-btn');
    const marcoImgOverlay = document.getElementById('marco-overlay-img');
    const marcoEmptyState = document.getElementById('marco-empty-state');
    const marcoMissingState = document.getElementById('marco-missing-state');
    const marcoMissingDesc = document.getElementById('marco-missing-desc');
    const marcoPreviewNombre = document.getElementById('marco-preview-nombre');
    const marcoPreviewBadge = document.getElementById('marco-preview-badge');

    // PRECIOS BASE
    const preciosBase = {
        5000: 500,   // Esencial
        10000: 900,  // Experiencia
        15000: 1500  // Premium
    };

    function actualizarCamposSegunPlan() {
        if (!planSelector) return;
        const planSeleccionado = parseInt(planSelector.value) || 5000;

        // Mostrar campos de Experiencia y Premium (marcos, fondo) para planes >= 10000
        if (camposExperienciaPremium) {
            if (planSeleccionado >= 10000) {
                camposExperienciaPremium.classList.add('visible');
            } else {
                camposExperienciaPremium.classList.remove('visible');
            }
        }

        // Mostrar campos de Premium (mensaje bienvenida) solo para plan >= 15000
        if (camposPremium) {
            if (planSeleccionado >= 15000) {
                camposPremium.classList.add('visible');
            } else {
                camposPremium.classList.remove('visible');
            }
        }

        // Limitar paletas de color según el plan
        if (selectTema) {
            const esEsencial = planSeleccionado < 10000;
            
            // Ocultar tarjetas de previsualización que no sean 'clasico'
            swatchCards.forEach(card => {
                if (esEsencial && card.getAttribute('data-tema-codigo') !== 'clasico') {
                    card.style.display = 'none';
                } else {
                    card.style.display = '';
                }
            });

            // Ocultar opciones del select que no sean 'clasico'
            Array.from(selectTema.options).forEach(opt => {
                if (esEsencial && opt.value !== 'clasico') {
                    opt.style.display = 'none';
                    opt.disabled = true;
                } else {
                    opt.style.display = '';
                    opt.disabled = false;
                }
            });

            // Si es esencial y tenía seleccionado otro tema, forzar a 'clasico'
            if (esEsencial && selectTema.value !== 'clasico') {
                selectTema.value = 'clasico';
                actualizarPreviewTema('clasico');
            }
        }

        // Actualizar cotización
        actualizarCotizacion();

        // Actualizar estado del marco según el plan
        if (selectMarco) {
            actualizarPreviewMarco(selectMarco.value);
        }
    }

    function actualizarCotizacion() {
        if (!planSelector) return;
        const planSeleccionado = parseInt(planSelector.value) || 5000;
        const horasExtra = (horasExtraInput && parseInt(horasExtraInput.value)) || 0;

        const precioBase = preciosBase[planSeleccionado] || 500;
        const costoHorasExtra = horasExtra * 100;
        const costoTotal = precioBase + costoHorasExtra;

        const elPrecioBase = document.getElementById('precio-base');
        const elHorasExtra = document.getElementById('costo-horas-extra');
        const elCostoTotal = document.getElementById('costo-total');

        if (elPrecioBase) elPrecioBase.textContent = `$${precioBase} MXN`;
        if (elHorasExtra) elHorasExtra.textContent = `$${costoHorasExtra} MXN`;
        if (elCostoTotal) elCostoTotal.textContent = `$${costoTotal} MXN`;
    }

    function actualizarPreviewTema(codigoTema) {
        const temas = window.TEMAS_DATA || {};
        const datosTema = temas[codigoTema];
        if (!datosTema) return;

        // 1. Marcar botón de swatch activo
        swatchCards.forEach(card => {
            if (card.getAttribute('data-tema-codigo') === codigoTema) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        // 2. Actualizar etiquetas y nombres
        if (temaLiveNombre) {
            temaLiveNombre.textContent = datosTema.nombre || codigoTema;
        }

        // 3. Actualizar mockup interactivo
        if (temaLiveMockup) {
            temaLiveMockup.style.backgroundColor = datosTema.bg;
            temaLiveMockup.style.borderColor = datosTema.shadow_dark || 'rgba(0,0,0,0.1)';
        }

        if (temaLiveButton) {
            temaLiveButton.style.backgroundColor = datosTema.primary;
            temaLiveButton.style.color = '#ffffff';
        }

        if (temaLiveText) {
            temaLiveText.style.color = datosTema.text;
        }

        // 4. Actualizar cuadritos indicadores y valores hex
        if (indPrimary) indPrimary.style.backgroundColor = datosTema.primary;
        if (indBg) indBg.style.backgroundColor = datosTema.bg;
        if (indText) indText.style.backgroundColor = datosTema.text;

        if (valPrimary) valPrimary.textContent = datosTema.primary;
        if (valBg) valBg.textContent = datosTema.bg;
        if (valText) valText.textContent = datosTema.text;
    }

    function actualizarPreviewMarco(marcoId) {
        const marcos = window.MARCOS_PREVIEW_DATA || {};
        const strId = String(marcoId || '');

        // 1. Actualizar pills activas
        marcoPills.forEach(pill => {
            const pillId = pill.getAttribute('data-marco-id') || '';
            if (pillId === strId) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });

        // 2. Caso: Sin marco seleccionado
        if (!strId) {
            if (marcoPreviewNombre) marcoPreviewNombre.textContent = 'Sin marco seleccionado';
            if (marcoPreviewBadge) {
                marcoPreviewBadge.textContent = 'Sin marco';
                marcoPreviewBadge.className = 'marco-status-badge marco-status-badge--neutral';
            }
            if (marcoImgOverlay) {
                marcoImgOverlay.removeAttribute('src');
                marcoImgOverlay.style.display = 'none';
            }
            if (marcoEmptyState) marcoEmptyState.style.display = 'flex';
            if (marcoMissingState) marcoMissingState.style.display = 'none';
            return;
        }

        // 3. Caso: Marco seleccionado
        const marcoInfo = marcos[strId];
        if (!marcoInfo) return;

        if (marcoPreviewNombre) {
            marcoPreviewNombre.textContent = marcoInfo.nombre;
        }

        if (marcoInfo.tiene_preview && marcoInfo.preview_url) {
            // Existe coincidencia exacta de archivo local en la app
            if (marcoEmptyState) marcoEmptyState.style.display = 'none';
            if (marcoMissingState) marcoMissingState.style.display = 'none';

            if (marcoImgOverlay) {
                marcoImgOverlay.src = marcoInfo.preview_url;
                marcoImgOverlay.style.display = 'block';
            }

            if (marcoPreviewBadge) {
                marcoPreviewBadge.textContent = 'Vista previa activa';
                marcoPreviewBadge.className = 'marco-status-badge marco-status-badge--success';
            }
        } else {
            // Marco en catálogo GC sin archivo local en galerias/static/galerias/marcos/
            if (marcoEmptyState) marcoEmptyState.style.display = 'none';
            if (marcoImgOverlay) {
                marcoImgOverlay.removeAttribute('src');
                marcoImgOverlay.style.display = 'none';
            }

            if (marcoMissingState) marcoMissingState.style.display = 'flex';
            if (marcoMissingDesc) {
                marcoMissingDesc.innerHTML = `No es posible cargar, contancte con el desarrollador.`;
            }

            if (marcoPreviewBadge) {
                marcoPreviewBadge.textContent = 'Archivo local pendiente';
                marcoPreviewBadge.className = 'marco-status-badge marco-status-badge--warning';
            }
        }

        // Advertencia visual si el marco es exclusivo de Premium y el usuario está en Experiencia
        const planSeleccionado = (planSelector && parseInt(planSelector.value)) || 5000;
        if (marcoInfo.solo_premium && planSeleccionado < 15000) {
            if (marcoPreviewBadge) {
                marcoPreviewBadge.textContent = '⭐ Exclusivo de Plan Premium';
                marcoPreviewBadge.className = 'marco-status-badge marco-status-badge--warning';
            }
        }
    }

    // ==========================================
    // INICIALIZACIÓN Y EVENT LISTENERS
    // ==========================================
    if (planSelector) {
        actualizarCamposSegunPlan();
        planSelector.addEventListener('change', actualizarCamposSegunPlan);
    }

    if (horasExtraInput) {
        horasExtraInput.addEventListener('input', actualizarCotizacion);
    }

    if (selectTema) {
        selectTema.addEventListener('change', function () {
            actualizarPreviewTema(this.value);
        });

        swatchCards.forEach(card => {
            card.addEventListener('click', function () {
                const codigo = this.getAttribute('data-tema-codigo');
                if (codigo) {
                    selectTema.value = codigo;
                    actualizarPreviewTema(codigo);
                }
            });
        });

        if (selectTema.value) {
            actualizarPreviewTema(selectTema.value);
        }
    }

    if (selectMarco) {
        selectMarco.addEventListener('change', function () {
            actualizarPreviewMarco(this.value);
        });

        marcoPills.forEach(pill => {
            pill.addEventListener('click', function () {
                const id = this.getAttribute('data-marco-id') || '';
                selectMarco.value = id;
                actualizarPreviewMarco(id);
            });
        });

        actualizarPreviewMarco(selectMarco.value);
    }

    // ==========================================
    // LIMPIAR FORMULARIO (RESET)
    // ==========================================
    const form = document.querySelector('.request-form__form');
    if (form) {
        form.addEventListener('reset', function () {
            // setTimeout para permitir que el form nativo se resetee primero
            setTimeout(() => {
                if (planSelector) actualizarCamposSegunPlan();
                if (selectTema && selectTema.value) actualizarPreviewTema(selectTema.value);
                if (selectMarco) actualizarPreviewMarco(selectMarco.value);
            }, 50);
        });
    }
});