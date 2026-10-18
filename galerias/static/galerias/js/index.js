/**
 * PhotoDom — Landing Page & Cotizador Interactivo
 * Código separado de lógica JavaScript para index.html
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // ----------------------------------------------------------------------
    // 1. NAVEGACIÓN Y MENÚ MÓVIL
    // ----------------------------------------------------------------------
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    if (mobileMenuBtn && mobileDrawer) {
      mobileMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        mobileDrawer.classList.toggle('is-open');
      });

      mobileLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          mobileDrawer.classList.remove('is-open');
        });
      });

      document.addEventListener('click', function (e) {
        if (!mobileDrawer.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          mobileDrawer.classList.remove('is-open');
        }
      });
    }

    // Resaltado de navegación activa en scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('#desktop-nav a');

    function updateActiveNav() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      sections.forEach(function (current) {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 120;
        const sectionId = current.getAttribute('id');

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navLinks.forEach(function (link) {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + sectionId) {
              link.classList.add('active');
            }
          });
        }
      });
    }
    window.addEventListener('scroll', updateActiveNav, { passive: true });

    // ----------------------------------------------------------------------
    // 2. INTERACTIVIDAD DEMO EN VIVO: LIKES EN CADA FOTO DEL MURO
    // ----------------------------------------------------------------------
    const likeButtons = document.querySelectorAll('.interactive-like-btn');
    likeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = this.getAttribute('data-target');
        const counterEl = document.getElementById('like-count-' + targetId);
        if (!counterEl) return;
        let currentLikes = parseInt(counterEl.textContent, 10) || 0;

        if (this.classList.contains('liked')) {
          this.classList.remove('liked');
          counterEl.textContent = currentLikes - 1;
        } else {
          this.classList.add('liked');
          counterEl.textContent = currentLikes + 1;
          this.style.transform = 'scale(1.2)';
          const self = this;
          setTimeout(function () {
            self.style.transform = '';
          }, 180);
        }
      });
    });

    // ----------------------------------------------------------------------
    // 3. COTIZADOR EN VIVO Y LÓGICA DE PAQUETES
    // ----------------------------------------------------------------------
    const planSelect = document.getElementById('plan_almacenamiento') || document.getElementById('plan-selector') || document.getElementById('id_plan_almacenamiento');
    const proyectorCheckbox = document.getElementById('incluye_proyector') || document.getElementById('incluye-proyector-checkbox') || document.getElementById('id_incluye_proyector');
    const proyectorContainer = document.getElementById('proyector-addon-container');
    const proyectorBadgePrice = document.getElementById('proyector-badge-price');
    const proyectorHelpText = document.getElementById('proyector-help-text');
    const avisoInvitacion = document.getElementById('aviso-invitacion-web');
    const horasExtraInput = document.getElementById('horas_extra') || document.getElementById('horas-extra') || document.getElementById('id_horas_extra');
    const seccionPersonalizacion = document.getElementById('seccion-personalizacion-galeria');
    const camposPremium = document.getElementById('campos-experiencia-premium');

    const precioBaseEl = document.getElementById('precio-base');
    const costoProyectorEl = document.getElementById('costo-proyector');
    const costoHorasExtraEl = document.getElementById('costo-horas-extra');
    const costoTotalEl = document.getElementById('costo-total');
    const filaProyector = document.getElementById('fila-costo-proyector');

    // Mapeo unificado de planes (admite números enteros y strings)
    const PLAN_MAPPING = {
      'galeria_qr': 5000,
      '5000': 5000,
      '5000.0': 5000,
      'invitacion_web': 0,
      '0': 0,
      'paquete_vip': 15000,
      '15000': 15000
    };

    const PRECIOS_BASE = {
      5000: 500,     // Solo Galería QR
      0: 699,        // Solo Invitación Web
      15000: 1190    // Paquete VIP
    };

    window.seleccionarPlan = function (planKey) {
      if (!planSelect) return;
      const targetVal = PLAN_MAPPING[planKey] !== undefined ? PLAN_MAPPING[planKey] : planKey;
      planSelect.value = targetVal;
      calcularCotizacion();
      const solicitarSec = document.getElementById('solicitar');
      if (solicitarSec) {
        solicitarSec.scrollIntoView({ behavior: 'smooth' });
      }
    };

    function calcularCotizacion() {
      if (!planSelect) return;
      const rawVal = String(planSelect.value);
      const planId = PLAN_MAPPING[rawVal] !== undefined ? PLAN_MAPPING[rawVal] : (parseInt(rawVal, 10) || 5000);
      const horasExtra = Math.max(0, parseInt(horasExtraInput ? horasExtraInput.value : 0, 10) || 0);

      const base = PRECIOS_BASE[planId] !== undefined ? PRECIOS_BASE[planId] : 500;
      let costoProyector = 0;
      const costoHoras = horasExtra * 100;

      if (planId === 0) {
        // Solo Invitación Web
        if (proyectorContainer) proyectorContainer.style.display = 'none';
        if (avisoInvitacion) avisoInvitacion.style.display = 'block';
        if (filaProyector) filaProyector.style.display = 'none';
        if (seccionPersonalizacion) seccionPersonalizacion.style.display = 'none';
        if (proyectorCheckbox) {
          proyectorCheckbox.checked = false;
          proyectorCheckbox.disabled = true;
        }
      } else if (planId === 15000) {
        // Paquete VIP
        if (proyectorContainer) proyectorContainer.style.display = 'block';
        if (avisoInvitacion) avisoInvitacion.style.display = 'none';
        if (filaProyector) filaProyector.style.display = 'flex';
        if (seccionPersonalizacion) seccionPersonalizacion.style.display = 'block';
        if (camposPremium) camposPremium.style.display = 'block';
        if (proyectorCheckbox) {
          proyectorCheckbox.checked = true;
          proyectorCheckbox.disabled = true;
        }
        if (proyectorBadgePrice) {
          proyectorBadgePrice.textContent = 'INCLUIDO GRATIS';
          proyectorBadgePrice.style.background = 'var(--gold-soft)';
          proyectorBadgePrice.style.color = 'var(--gold)';
        }
        if (proyectorHelpText) {
          proyectorHelpText.textContent = 'El Modo Proyector en vivo ya viene incluido sin costo adicional en el Paquete VIP.';
        }
        costoProyector = 0;
        if (costoProyectorEl) costoProyectorEl.textContent = '$0 MXN (Incluido)';
      } else {
        // Solo Galería QR (5000)
        if (proyectorContainer) proyectorContainer.style.display = 'block';
        if (avisoInvitacion) avisoInvitacion.style.display = 'none';
        if (filaProyector) filaProyector.style.display = 'flex';
        if (seccionPersonalizacion) seccionPersonalizacion.style.display = 'block';
        if (camposPremium) camposPremium.style.display = 'none';
        if (proyectorCheckbox) {
          proyectorCheckbox.disabled = false;
        }
        if (proyectorBadgePrice) {
          proyectorBadgePrice.textContent = '+ $250 MXN';
          proyectorBadgePrice.style.background = 'var(--primary-soft)';
          proyectorBadgePrice.style.color = 'var(--primary)';
        }
        if (proyectorHelpText) {
          proyectorHelpText.textContent = 'Transmite en vivo las fotos y videos de tus invitados en pantalla o proyector durante el evento.';
        }
        if (proyectorCheckbox && proyectorCheckbox.checked) {
          costoProyector = 250;
          if (costoProyectorEl) costoProyectorEl.textContent = '+$250 MXN';
        } else {
          costoProyector = 0;
          if (costoProyectorEl) costoProyectorEl.textContent = '$0 MXN';
        }
      }

      const total = base + costoProyector + costoHoras;

      if (precioBaseEl) precioBaseEl.textContent = `$${base.toLocaleString('es-MX')} MXN`;
      if (costoHorasExtraEl) costoHorasExtraEl.textContent = costoHoras > 0 ? `+$${costoHoras.toLocaleString('es-MX')} MXN` : '$0 MXN';
      if (costoTotalEl) costoTotalEl.textContent = `$${total.toLocaleString('es-MX')} MXN`;
    }

    if (planSelect) planSelect.addEventListener('change', calcularCotizacion);
    if (proyectorCheckbox) proyectorCheckbox.addEventListener('change', calcularCotizacion);
    if (horasExtraInput) horasExtraInput.addEventListener('input', calcularCotizacion);
    calcularCotizacion();

    // ----------------------------------------------------------------------
    // 4. PERSONALIZACIÓN DE TEMAS Y SWATCHES (Colores exactos de models.py)
    // ----------------------------------------------------------------------
    const DEFAULT_TEMAS = {
      clasico: { nombre: 'Clásico / Gris Neumórfico', primary: '#4f46e5', bg: '#e0e5ec', text: '#4a5568' },
      rosa_pastell: { nombre: 'Rosa & Pastel', primary: '#db2777', bg: '#fce7f3', text: '#831843' },
      azul_elegante: { nombre: 'Azul Noche & Plata', primary: '#4338ca', bg: '#e0e7ff', text: '#1e1b4b' },
      verde_bosque: { nombre: 'Verde Bosque & Muted Teal', primary: '#4f7d6d', bg: '#e6f0ed', text: '#1f352d' },
      morado_fiesta: { nombre: 'Morado & Lavanda', primary: '#7e22ce', bg: '#f3e8ff', text: '#3b0764' },
      blanco_boda: { nombre: 'Blanco Marfil & Dorado', primary: '#b8860b', bg: '#f8f6f0', text: '#44403c' }
    };

    const TEMAS = Object.assign({}, DEFAULT_TEMAS, window.TEMAS_DATA || {});

    const temaSelect = document.getElementById('tema_color') || document.getElementById('id_tema_color');
    const swatchCards = document.querySelectorAll('.tema-swatch-card');
    const temaNombreEl = document.getElementById('tema-live-nombre');
    const temaMockupEl = document.getElementById('tema-live-mockup');
    const temaButtonEl = document.getElementById('tema-live-button');
    const temaTextEl = document.getElementById('tema-live-text');
    const valPrimary = document.getElementById('val-indicator-primary');
    const valBg = document.getElementById('val-indicator-bg');
    const valText = document.getElementById('val-indicator-text');
    const cuadritoPrimary = document.getElementById('cuadrito-indicator-primary');
    const cuadritoBg = document.getElementById('cuadrito-indicator-bg');
    const cuadritoText = document.getElementById('cuadrito-indicator-text');

    function aplicarTema(codigo) {
      const t = TEMAS[codigo] || TEMAS.clasico || DEFAULT_TEMAS.clasico;
      if (temaSelect && temaSelect.value !== codigo) {
        temaSelect.value = codigo;
      }

      swatchCards.forEach(function (c) {
        c.classList.toggle('active', c.getAttribute('data-tema-codigo') === codigo);
      });

      if (temaNombreEl) temaNombreEl.textContent = t.nombre;
      if (temaMockupEl) temaMockupEl.style.backgroundColor = t.bg;
      if (temaButtonEl) temaButtonEl.style.backgroundColor = t.primary;
      if (temaTextEl) temaTextEl.style.color = t.text;

      if (valPrimary) valPrimary.textContent = t.primary;
      if (valBg) valBg.textContent = t.bg;
      if (valText) valText.textContent = t.text;
      if (cuadritoPrimary) cuadritoPrimary.style.backgroundColor = t.primary;
      if (cuadritoBg) cuadritoBg.style.backgroundColor = t.bg;
      if (cuadritoText) cuadritoText.style.backgroundColor = t.text;
    }

    swatchCards.forEach(function (card) {
      card.addEventListener('click', function () {
        const cod = this.getAttribute('data-tema-codigo');
        if (cod) aplicarTema(cod);
      });
    });

    if (temaSelect) {
      temaSelect.addEventListener('change', function () {
        aplicarTema(this.value);
      });
      if (temaSelect.value) {
        aplicarTema(temaSelect.value);
      }
    }

    // ----------------------------------------------------------------------
    // 5. SELECTOR DE MARCOS Y STAGE INTERACTIVO
    // ----------------------------------------------------------------------
    const MARCOS_PREVIEW = {
      '': { nombre: 'Sin marco seleccionado', badge: 'Vista previa', svg: '' },
      'ninguno': { nombre: 'Sin marco seleccionado', badge: 'Vista previa', svg: '' },
      'floral': {
        nombre: 'Floral Boda Elegante',
        badge: 'Estilo Romántico',
        svg: '<rect x="8" y="8" width="384" height="184" rx="10" fill="none" stroke="#ec4899" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/><circle cx="20" cy="20" r="12" fill="#fbcfe8" opacity="0.7"/><circle cx="380" cy="20" r="12" fill="#fbcfe8" opacity="0.7"/><circle cx="20" cy="180" r="12" fill="#fbcfe8" opacity="0.7"/><circle cx="380" cy="180" r="12" fill="#fbcfe8" opacity="0.7"/><text x="200" y="190" text-anchor="middle" font-family="Georgia" font-size="12" fill="#831843" letter-spacing="2">✨ AMOR ETERNO ✨</text>'
      },
      'destellos': {
        nombre: 'Destellos XV Años (VIP)',
        badge: 'Exclusivo VIP',
        svg: '<rect x="10" y="10" width="380" height="180" rx="8" fill="none" stroke="#f59e0b" stroke-width="3" opacity="0.8"/><polygon points="20,15 25,25 35,25 27,32 30,42 20,35 10,42 13,32 5,25 15,25" fill="#fbbf24"/><polygon points="380,15 385,25 395,25 387,32 390,42 380,35 370,42 373,32 365,25 375,25" fill="#fbbf24"/><text x="200" y="188" text-anchor="middle" font-weight="bold" font-size="13" fill="#d97706" letter-spacing="3">MIS XV AÑOS</text>'
      },
      'dorado': {
        nombre: 'Minimalista Dorado',
        badge: 'Gala & Fiesta',
        svg: '<rect x="14" y="14" width="372" height="172" fill="none" stroke="#d97706" stroke-width="1.5"/><rect x="18" y="18" width="364" height="164" fill="none" stroke="#f59e0b" stroke-width="0.75"/><line x1="14" y1="35" x2="35" y2="14" stroke="#d97706" stroke-width="2"/><line x1="386" y1="35" x2="365" y2="14" stroke="#d97706" stroke-width="2"/>'
      },
      'fiesta': {
        nombre: 'Guirnalda Festiva',
        badge: 'Cumpleaños & Posadas',
        svg: '<path d="M10 20 Q100 40 200 20 T390 20" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.7"/><polygon points="40,24 50,42 30,42" fill="#ec4899"/><polygon points="90,27 100,45 80,45" fill="#eab308"/><polygon points="140,24 150,42 130,42" fill="#10b981"/><polygon points="240,24 250,42 230,42" fill="#3b82f6"/><text x="200" y="190" text-anchor="middle" font-weight="bold" font-size="12" fill="#4f46e5">🎉 CELEBRANDO JUNTOS 🎉</text>'
      }
    };

    const marcoSelect = document.getElementById('marco_seleccionado') || document.getElementById('id_marco_seleccionado');
    const marcoPills = document.querySelectorAll('.marco-pill-btn');
    const marcoSvgOverlay = document.getElementById('marco-svg-overlay');
    const marcoEmptyState = document.getElementById('marco-empty-state');
    const marcoNombreEl = document.getElementById('marco-preview-nombre');
    const marcoBadgeEl = document.getElementById('marco-preview-badge');
    const marcoImgOverlay = document.getElementById('marco-overlay-img');

    function actualizarMarco(marcoId) {
      const strId = String(marcoId || '');
      marcoPills.forEach(function (p) {
        const pillId = p.getAttribute('data-marco-id') || '';
        p.classList.toggle('active', pillId === strId);
      });

      if (marcoSelect && marcoSelect.value !== strId) {
        marcoSelect.value = strId;
      }

      // 1. Revisar si viene de base de datos local
      const dbMarcos = window.MARCOS_PREVIEW_DATA || {};
      const dbMarco = dbMarcos[strId];

      if (dbMarco && dbMarco.tiene_preview && dbMarco.preview_url) {
        if (marcoNombreEl) marcoNombreEl.textContent = dbMarco.nombre;
        if (marcoBadgeEl) marcoBadgeEl.textContent = 'Vista previa activa';
        if (marcoSvgOverlay) marcoSvgOverlay.style.display = 'none';
        if (marcoEmptyState) marcoEmptyState.style.display = 'none';
        if (marcoImgOverlay) {
          marcoImgOverlay.src = dbMarco.preview_url;
          marcoImgOverlay.style.display = 'block';
        }
        return;
      }

      // 2. Fallback a catálogo SVG de preview visual
      const data = MARCOS_PREVIEW[strId] || MARCOS_PREVIEW[''];
      if (marcoNombreEl) marcoNombreEl.textContent = data.nombre;
      if (marcoBadgeEl) marcoBadgeEl.textContent = data.badge;

      if (marcoImgOverlay) marcoImgOverlay.style.display = 'none';

      if (data.svg) {
        if (marcoSvgOverlay) {
          marcoSvgOverlay.innerHTML = data.svg;
          marcoSvgOverlay.style.display = 'block';
        }
        if (marcoEmptyState) marcoEmptyState.style.display = 'none';
      } else {
        if (marcoSvgOverlay) marcoSvgOverlay.style.display = 'none';
        if (marcoEmptyState) marcoEmptyState.style.display = 'block';
      }
    }

    marcoPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        const marcoId = this.getAttribute('data-marco-id') || '';
        actualizarMarco(marcoId);
      });
    });

    if (marcoSelect) {
      marcoSelect.addEventListener('change', function () {
        actualizarMarco(this.value);
      });
    }

    // Preview de fondo personalizado
    const fondoInput = document.getElementById('fondo_personalizado') || document.getElementById('id_fondo_personalizado');
    const marcoStage = document.getElementById('marco-stage');
    if (fondoInput && marcoStage) {
      fondoInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (e) {
            marcoStage.style.backgroundImage = 'url(' + e.target.result + ')';
            marcoStage.style.backgroundSize = 'cover';
            marcoStage.style.backgroundPosition = 'center';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Mensaje de bienvenida en vivo
    const mensajeInput = document.getElementById('mensaje_bienvenida') || document.getElementById('id_mensaje_bienvenida');
    if (mensajeInput && temaTextEl) {
      mensajeInput.addEventListener('input', function () {
        temaTextEl.textContent = this.value.trim() ? '"' + this.value + '"' : '"¡Bienvenidos a nuestro gran día!"';
      });
    }

    // ----------------------------------------------------------------------
    // 6. GESTIÓN DE MODALES
    // ----------------------------------------------------------------------
    function openModal(id) {
      const m = document.getElementById(id);
      if (m) {
        m.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeModal(id) {
      const m = document.getElementById(id);
      if (m) {
        m.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    }

    // Modales accesibles (activados mediante data-close-modal o eventos específicos)
    window.openPhotoDomModal = openModal;
    window.closePhotoDomModal = closeModal;

    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetModal = this.getAttribute('data-close-modal');
        closeModal(targetModal);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === this) {
          closeModal(this.id);
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.is-open').forEach(function (m) {
          closeModal(m.id);
        });
      }
    });

    // ----------------------------------------------------------------------
    // ACCESO A GALERÍA (DUEÑO) DESDE EL INDEX
    // ----------------------------------------------------------------------
    const btnOpenAcceso = document.getElementById('btn-open-acceso-galeria');
    const btnOpenAccesoMobile = document.getElementById('btn-open-acceso-galeria-mobile');
    const formAcceso = document.getElementById('form-acceso-galeria');
    const inputPasswordAcceso = document.getElementById('input-password-acceso');
    const accesoErrorMsg = document.getElementById('acceso-error-msg');
    const btnSubmitAcceso = document.getElementById('btn-submit-acceso-galeria');

    function abrirModalAcceso() {
      openModal('modal-acceso-galeria');
      if (accesoErrorMsg) {
        accesoErrorMsg.style.display = 'none';
        accesoErrorMsg.textContent = '';
      }
      if (inputPasswordAcceso) {
        setTimeout(function () {
          inputPasswordAcceso.focus();
        }, 150);
      }
    }

    if (btnOpenAcceso) {
      btnOpenAcceso.addEventListener('click', abrirModalAcceso);
    }
    if (btnOpenAccesoMobile) {
      btnOpenAccesoMobile.addEventListener('click', function () {
        if (mobileDrawer) mobileDrawer.classList.remove('is-open');
        abrirModalAcceso();
      });
    }

    if (formAcceso) {
      formAcceso.addEventListener('submit', function (e) {
        e.preventDefault();
        const clave = (inputPasswordAcceso ? inputPasswordAcceso.value : '').trim();
        if (!clave) {
          if (accesoErrorMsg) {
            accesoErrorMsg.textContent = 'Por favor ingresa la contraseña de tu galería.';
            accesoErrorMsg.style.display = 'block';
          }
          return;
        }

        const csrfTokenEl = formAcceso.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = csrfTokenEl ? csrfTokenEl.value : '';

        if (btnSubmitAcceso) {
          btnSubmitAcceso.disabled = true;
          btnSubmitAcceso.innerHTML = '<span>Verificando...</span>';
        }
        if (accesoErrorMsg) {
          accesoErrorMsg.style.display = 'none';
          accesoErrorMsg.textContent = '';
        }

        fetch(formAcceso.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({ password_acceso: clave })
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (result.ok && result.data.success) {
              // Autorización completada: almacenar flag para galeria_dueno y redirigir
              if (result.data.evento_id) {
                sessionStorage.setItem('pin_valido_' + result.data.evento_id, 'true');
              }
              if (btnSubmitAcceso) {
                btnSubmitAcceso.innerHTML = '<span>¡Acceso concedido! Redirigiendo...</span>';
              }
              window.location.href = result.data.redirect_url;
            } else {
              if (btnSubmitAcceso) {
                btnSubmitAcceso.disabled = false;
                btnSubmitAcceso.innerHTML = '<span>Ingresar a mi galería</span>';
              }
              if (accesoErrorMsg) {
                accesoErrorMsg.textContent = result.data.error || 'La clave no coincide con ningún evento activo.';
                accesoErrorMsg.style.display = 'block';
              }
              if (inputPasswordAcceso) {
                inputPasswordAcceso.focus();
                inputPasswordAcceso.select();
              }
            }
          })
          .catch(function (err) {
            console.error('Error al verificar acceso:', err);
            if (btnSubmitAcceso) {
              btnSubmitAcceso.disabled = false;
              btnSubmitAcceso.innerHTML = '<span>Ingresar a mi galería</span>';
            }
            if (accesoErrorMsg) {
              accesoErrorMsg.textContent = 'Hubo un error de conexión al verificar tu clave. Intenta de nuevo.';
              accesoErrorMsg.style.display = 'block';
            }
          });
      });
    }

    // Reset button handler
    const form = document.getElementById('solicitud-form') || document.querySelector('.request-form__form');
    if (form) {
      form.addEventListener('reset', function () {
        setTimeout(function () {
          calcularCotizacion();
          aplicarTema('clasico');
          actualizarMarco('');
          if (marcoStage) {
            marcoStage.style.backgroundImage = '';
          }
        }, 50);
      });
    }
  });
})();