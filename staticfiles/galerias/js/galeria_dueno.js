// Variable global leída desde el HTML
let inputPin = "";
let archivosGaleria = [];
let indiceActual = 0;
let idFotoAEliminar = null;

// Variables para gestos táctiles y de arrastre
let startX = 0;
let currentTranslate = 0;
let isDragging = false;

// Función de escape HTML para prevenir XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Inicialización de datos al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificación de PIN en la sesión
    if (sessionStorage.getItem(`pin_valido_${window.EVENTO_ID}`) === "true") {
        const modal = document.getElementById("pin-modal");
        if (modal) modal.classList.add("hidden");
    }

    // 2. Mapeo de la galería para el Carrusel (incluye conteo de Likes)
    const elementosMedia = document.querySelectorAll(".media-item");
    archivosGaleria = Array.from(elementosMedia).map(el => ({
        url: el.dataset.url,
        esVideo: el.dataset.esVideo === "true",
        likes: parseInt(el.dataset.likes || "0", 10)
    }));

    // 3. Configuración de eventos de Deslizamiento (Swipe / Drag)
    const area = document.getElementById("carrusel-touch-area");
    if (area) {
        // Gestos táctiles en teléfonos y tablets
        area.addEventListener("touchstart", touchStart, { passive: true });
        area.addEventListener("touchmove", touchMove, { passive: true });
        area.addEventListener("touchend", touchEnd);

        // Gestos de ratón en computadoras de escritorio
        area.addEventListener("mousedown", touchStart);
        area.addEventListener("mousemove", touchMove);
        area.addEventListener("mouseup", touchEnd);
        area.addEventListener("mouseleave", () => {
            if (isDragging) touchEnd();
        });
    }
});

// --- TECLADO NUMÉRICO Y VALIDACIÓN DE PIN ---
function pressNum(num) {
    if (inputPin.length < 4) {
        inputPin += num;
        updateDots();

        if (inputPin.length === 4) {
            setTimeout(validarPin, 150);
        }
    }
}

function deleteNum() {
    if (inputPin.length > 0) {
        inputPin = inputPin.slice(0, -1);
        updateDots();
        document.getElementById("pin-error").innerText = "";
    }
}

function updateDots() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot, index) => {
        if (index < inputPin.length) {
            dot.style.backgroundColor = "var(--neu-primary, #4f46e5)";
            dot.classList.remove("neu-pressed");
            dot.classList.add("neu-flat");
        } else {
            dot.style.backgroundColor = "";
            dot.classList.remove("neu-flat");
            dot.classList.add("neu-pressed");
        }
    });
}

function validarPin() {
    if (String(inputPin) === String(window.PIN_CORRECTO)) {
        sessionStorage.setItem(`pin_valido_${window.EVENTO_ID}`, "true");
        const modal = document.getElementById("pin-modal");
        modal.classList.add("opacity-0");
        setTimeout(() => modal.classList.add("hidden"), 300);
    } else {
        const errorEl = document.getElementById("pin-error");
        errorEl.innerText = "PIN incorrecto";

        const dotsContainer = document.getElementById("pin-dots");
        dotsContainer.classList.add("animate-bounce");

        setTimeout(() => {
            dotsContainer.classList.remove("animate-bounce");
            inputPin = "";
            updateDots();
        }, 500);
    }
}

// --- LIGHTBOX / CARRUSEL ---
function abrirCarrusel(index) {
    const mediaElements = document.querySelectorAll(".media-item");
    const el = mediaElements[index];

    // Si aún se está procesando, bloqueamos la apertura para no pedir bytes al bucket
    if (el && el.dataset.procesando === "true") {
        mostrarModalAlerta("Procesando Archivo", "El archivo aún se está procesando. Estará listo para visualizarse en unos momentos.");
        return;
    }

    indiceActual = index;
    actualizarVistaCarrusel();
    document.getElementById("lightbox-modal").classList.remove("hidden");
}

function cerrarCarrusel() {
    const video = document.getElementById("carrusel-video");
    if (video) video.pause();
    document.getElementById("lightbox-modal").classList.add("hidden");
}

function cambiarSlide(direccion) {
    const video = document.getElementById("carrusel-video");
    if (video) video.pause();

    indiceActual += direccion;

    // Bucle infinito
    if (indiceActual < 0) indiceActual = archivosGaleria.length - 1;
    if (indiceActual >= archivosGaleria.length) indiceActual = 0;

    actualizarVistaCarrusel();
}

function actualizarVistaCarrusel() {
    const item = archivosGaleria[indiceActual];
    if (!item) return;

    const container = document.getElementById("carrusel-slide-container");
    const imgEl = document.getElementById("carrusel-img");
    const videoEl = document.getElementById("carrusel-video");
    const contador = document.getElementById("carrusel-contador");
    const likesCountEl = document.getElementById("carrusel-likes-count");

    // Resetear posición de la animación
    container.style.transform = `translateX(0px)`;
    container.style.transition = "transform 0.3s ease-out";

    if (item.esVideo) {
        imgEl.classList.add("hidden");
        videoEl.src = item.url;
        videoEl.classList.remove("hidden");
    } else {
        videoEl.classList.add("hidden");
        imgEl.src = item.url;
        imgEl.classList.remove("hidden");
    }

    if (contador) {
        contador.innerText = `${indiceActual + 1} / ${archivosGaleria.length}`;
    }

    if (likesCountEl) {
        likesCountEl.innerText = item.likes || 0;
    }
}

// --- LÓGICA DEL SWIPE / DESLIZAMIENTO ---
function getPositionX(e) {
    return e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
}

function touchStart(e) {
    if (e.target.tagName === 'VIDEO' && e.type === 'mousedown') {
        const rect = e.target.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        if (clickY > rect.height - 50) return;
    }

    isDragging = true;
    startX = getPositionX(e);
    const container = document.getElementById("carrusel-slide-container");
    if (container) {
        container.style.transition = "none";
    }
}

function touchMove(e) {
    if (!isDragging) return;
    const currentX = getPositionX(e);
    const diff = currentX - startX;

    const container = document.getElementById("carrusel-slide-container");
    if (container) {
        container.style.transform = `translateX(${diff}px)`;
    }
}

function touchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const container = document.getElementById("carrusel-slide-container");
    if (!container) return;

    const transformStyle = container.style.transform;
    const match = transformStyle.match(/translateX\(([-0-9.]+)px\)/);

    if (match) {
        const movedBy = parseFloat(match[1]);

        if (movedBy < -50) {
            cambiarSlide(1);
        } else if (movedBy > 50) {
            cambiarSlide(-1);
        } else {
            container.style.transition = "transform 0.3s ease-out";
            container.style.transform = `translateX(0px)`;
        }
    } else {
        container.style.transition = "transform 0.3s ease-out";
        container.style.transform = `translateX(0px)`;
    }
}

// Teclas para navegación de carrusel
document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("lightbox-modal");
    if (modal && !modal.classList.contains("hidden")) {
        if (e.key === "ArrowLeft") cambiarSlide(-1);
        if (e.key === "ArrowRight") cambiarSlide(1);
        if (e.key === "Escape") cerrarCarrusel();
    }
});

// --- FILTRADO DE CONTENIDO (TODOS / FOTOS / VIDEOS) ---
function filtrarGaleria(tipo) {
    const cards = document.querySelectorAll(".item-card");
    cards.forEach(card => {
        if (tipo === "todos" || card.dataset.tipo === tipo) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// --- MODAL Y ACCIÓN DE ELIMINACIÓN ---
function abrirModalEliminar(id) {
    idFotoAEliminar = id;
    document.getElementById("modal-eliminar").classList.remove("hidden");
}

function cerrarModal() {
    idFotoAEliminar = null;
    document.getElementById("modal-eliminar").classList.add("hidden");
}

function confirmarEliminar() {
    if (!idFotoAEliminar) return;

    fetch(`/foto/${idFotoAEliminar}/eliminar/`, {
        method: "POST",
        headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ pin: window.PIN_CORRECTO })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const card = document.getElementById(`item-card-${idFotoAEliminar}`);
            if (card) card.remove();
            cerrarModal();
        } else {
            mostrarModalAlerta("Error al Eliminar", data.error || "No se pudo eliminar el archivo.");
        }
    })
    .catch(() => mostrarModalAlerta("Error", "Error al procesar la solicitud."));
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

let urlZipPendiente = null;

function cancelarDescargaZip() {
    urlZipPendiente = null;
    const modal = document.getElementById("modal-advertencia-zip");
    if (modal) modal.classList.add("hidden");
}

function confirmarDescargaZip() {
    const modal = document.getElementById("modal-advertencia-zip");
    if (modal) modal.classList.add("hidden");
    if (urlZipPendiente) {
        ejecutarDescargaZipReal(urlZipPendiente);
    }
}

function mostrarModalAlerta(titulo, mensaje) {
    const modal = document.getElementById("modal-alerta-generica");
    if (modal) {
        document.getElementById("modal-alerta-titulo").textContent = titulo;
        document.getElementById("modal-alerta-mensaje").textContent = mensaje;
        modal.classList.remove("hidden");
    } else {
        alert(mensaje);
    }
}

function cerrarModalAlerta() {
    const modal = document.getElementById("modal-alerta-generica");
    if (modal) modal.classList.add("hidden");
}

async function descargarZipGenerando(urlDescarga) {
    if (window.DESCARGAS_RESTANTES <= 0) {
        mostrarModalAlerta("Límite Alcanzado", "Has alcanzado el límite máximo de descargas completas permitidas.");
        return;
    }

    // Verificar si hay pocos archivos
    if (window.TOTAL_ARCHIVOS <= 5 && window.TOTAL_ARCHIVOS > 0) {
        urlZipPendiente = urlDescarga;
        const modal = document.getElementById("modal-advertencia-zip");
        if (modal) modal.classList.remove("hidden");
        return; // Detenemos aquí, la confirmación continuará el flujo
    }

    if (window.TOTAL_ARCHIVOS === 0) {
        mostrarModalAlerta("Galería Vacía", "No hay archivos para descargar.");
        return;
    }

    // Si hay > 5 archivos, descargar directo
    ejecutarDescargaZipReal(urlDescarga);
}

async function ejecutarDescargaZipReal(urlDescarga) {
    const btn = document.getElementById('btn-zip-main');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Generando ZIP...</span>';
    }

    const modalZip = document.getElementById("modal-zip-loading");
    if (modalZip) modalZip.classList.remove("hidden");

    try {
        // Validar que la URL sea del mismo origen para prevenir SSRF
        if (!urlDescarga || typeof urlDescarga !== 'string') {
            throw new Error("URL inválida");
        }
        
        // Validar que la URL tenga el formato esperado
        const urlObj = new URL(urlDescarga, window.location.origin);
        if (urlObj.origin !== window.location.origin) {
            throw new Error("URL no permitida");
        }
        
        const respuesta = await fetch(urlDescarga);
        if (!respuesta.ok) throw new Error("Error en el servidor al generar el ZIP.");

        const blob = await respuesta.blob();
        
        // Usar una función auxiliar para crear el blob URL de forma segura
        function createSafeBlobUrl(blobData) {
            return window.URL.createObjectURL(blobData);
        }
        
        const urlBlob = createSafeBlobUrl(blob);
        
        // Crear y configurar elemento anchor de forma segura
        const a = document.createElement('a');
        a.href = urlBlob;
        
        // Obtener eventId y sanitizarlo para nombre de archivo
        const eventId = window.EVENTO_ID;
        const safeEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '');
        a.download = 'Galeria_' + safeEventId + '.zip';
        
        // Agregar al DOM y ejecutar click
        document.body.appendChild(a);
        a.click();

        // Limpieza
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlBlob);

        // Actualizar estado de usos restantes
        if (typeof actualizarDescargasRestantes === 'function') {
            actualizarDescargasRestantes();
        }

    } catch (error) {
        mostrarModalAlerta("Error", "Ocurrió un error al preparar la descarga. Intenta de nuevo.");
    } finally {
        if (modalZip) modalZip.classList.add("hidden");
        
        if (btn) {
            // Restaurar botón después de unos segundos
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    <span>Descargar Todo (.ZIP)</span>
                    <span id="descargas-info">(${window.DESCARGAS_RESTANTES} restantes)</span>
                `;
            }, 2000);
        }
    }
}

// ----------------------------------------------------
// POLLING DE VIDEOS EN PROCESO
// ----------------------------------------------------
function iniciarPollingVideosProcesando() {
    setInterval(() => {
        const items = document.querySelectorAll('.media-item[data-procesando="true"]');
        if (items.length === 0) return;

        const ids = Array.from(items).map(item => item.dataset.id).join(',');
        
        // Obtener el ID del evento de la URL o variable global
        const eventoId = window.EVENTO_ID;

        if (!eventoId) return;

        fetch(`/api/evento/${eventoId}/estado-archivos/?ids=${ids}`)
            .then(res => res.json())
            .then(data => {
                if (data.archivos) {
                    data.archivos.forEach(archivo => {
                        if (archivo.estado === 'COMPLETADO') {
                            const item = document.querySelector(`.media-item[data-id="${archivo.id}"]`);
                            if (item) {
                                item.dataset.procesando = "false";
                                item.dataset.url = archivo.preview_url || archivo.thumb_url;
                                
                                // Reemplazar el spinner por la imagen thumbnail
                                const videoIndicator = `<span class="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none backdrop-blur-sm"><svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Video</span>`;
                                
                                item.innerHTML = `
                                    <img src="${archivo.thumb_url}" class="absolute inset-0 block w-full h-full object-cover z-0" alt="Vista previa video" loading="lazy">
                                    ${videoIndicator}
                                `;
                            }
                        }
                    });
                }
            })
            .catch(err => console.error("Error polling video status:", err));
    }, 5000); // Revisar cada 5 segundos
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarPollingVideosProcesando();
    inicializarTarjetaQR();
});

// ----------------------------------------------------
// TARJETA DE INVITACIÓN QR VERTICAL (1080x1920 PX)
// ----------------------------------------------------
let presetQRActual = 'galeria';

function obtenerEstilosPresetQR(preset) {
    if (preset === 'claro') {
        return {
            bgTop: '#ffffff',
            bgBottom: '#f1f5f9',
            cardBg: '#ffffff',
            cardBorder: 'rgba(148, 163, 184, 0.25)',
            text: '#0f172a',
            muted: '#64748b',
            accent: '#4f46e5',
            accentSoft: 'rgba(79, 70, 229, 0.1)',
            qrBoxBg: '#ffffff',
            qrBoxBorder: 'rgba(148, 163, 184, 0.28)'
        };
    }
    if (preset === 'oscuro') {
        return {
            bgTop: '#0f172a',
            bgBottom: '#1e293b',
            cardBg: 'rgba(30, 41, 59, 0.72)',
            cardBorder: 'rgba(255, 255, 255, 0.12)',
            text: '#f8fafc',
            muted: '#cbd5e1',
            accent: '#fbbf24',
            accentSoft: 'rgba(251, 191, 36, 0.16)',
            qrBoxBg: '#ffffff',
            qrBoxBorder: 'rgba(255, 255, 255, 0.2)'
        };
    }
    if (preset === 'dorado') {
        return {
            bgTop: '#fcfbf7',
            bgBottom: '#f5efe2',
            cardBg: '#ffffff',
            cardBorder: 'rgba(180, 83, 9, 0.18)',
            text: '#292524',
            muted: '#78716c',
            accent: '#b45309',
            accentSoft: 'rgba(180, 83, 9, 0.1)',
            qrBoxBg: '#ffffff',
            qrBoxBorder: 'rgba(180, 83, 9, 0.2)'
        };
    }

    // Preset 'galeria': toma dinámicamente la paleta configurada del evento
    const styles = getComputedStyle(document.body);
    const bg = styles.getPropertyValue('--neu-bg').trim() || '#f8fafc';
    const surface = styles.getPropertyValue('--neu-surface').trim() || '#ffffff';
    const text = styles.getPropertyValue('--neu-text').trim() || '#0f172a';
    const muted = styles.getPropertyValue('--neu-muted').trim() || '#64748b';
    const accent = styles.getPropertyValue('--neu-primary').trim() || '#4f46e5';
    const accentSoft = styles.getPropertyValue('--neu-primary-soft').trim() || 'rgba(79, 70, 229, 0.1)';
    const border = styles.getPropertyValue('--neu-border').trim() || 'rgba(148, 163, 184, 0.24)';

    return {
        bgTop: bg,
        bgBottom: bg,
        cardBg: surface,
        cardBorder: border,
        text: text,
        muted: muted,
        accent: accent,
        accentSoft: accentSoft,
        qrBoxBg: '#ffffff',
        qrBoxBorder: border
    };
}

function dibujarRectanguloRedondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function dibujarTextoMultilinea(ctx, texto, x, yInicial, maxAncho, altoLinea) {
    const palabras = String(texto || '').split(/\s+/);
    let linea = '';
    const lineas = [];

    for (let i = 0; i < palabras.length; i++) {
        const prueba = linea ? `${linea} ${palabras[i]}` : palabras[i];
        if (ctx.measureText(prueba).width > maxAncho && linea) {
            lineas.push(linea);
            linea = palabras[i];
        } else {
            linea = prueba;
        }
    }
    if (linea) lineas.push(linea);

    let y = yInicial;
    for (const l of lineas) {
        ctx.fillText(l, x, y);
        y += altoLinea;
    }
    return y;
}

function renderizarTarjetaQR() {
    const canvas = document.getElementById('qr-card-canvas');
    const qrImg = document.getElementById('qr-source-img');
    if (!canvas || !qrImg || !qrImg.complete || qrImg.naturalWidth === 0) return;

    const ctx = canvas.getContext('2d');
    const W = 1080;
    const H = 1920;
    const tema = obtenerEstilosPresetQR(presetQRActual);

    // 1. Fondo vertical degradado
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, tema.bgTop);
    grad.addColorStop(1, tema.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Detalles decorativos suaves en las esquinas
    ctx.save();
    ctx.fillStyle = tema.accentSoft;
    ctx.beginPath();
    ctx.arc(W * 0.9, H * 0.1, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.12, H * 0.92, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Tarjeta central elegante
    const cardX = 84;
    const cardY = 140;
    const cardW = W - 168;
    const cardH = H - 280;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 20;
    dibujarRectanguloRedondeado(ctx, cardX, cardY, cardW, cardH, 56);
    ctx.fillStyle = tema.cardBg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    dibujarRectanguloRedondeado(ctx, cardX, cardY, cardW, cardH, 56);
    ctx.lineWidth = 3;
    ctx.strokeStyle = tema.cardBorder;
    ctx.stroke();
    ctx.restore();

    // 3. Insignia superior
    const badgeW = 420;
    const badgeH = 64;
    const badgeX = (W - badgeW) / 2;
    const badgeY = cardY + 90;
    dibujarRectanguloRedondeado(ctx, badgeX, badgeY, badgeW, badgeH, 32);
    ctx.fillStyle = tema.accentSoft;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = tema.accent;
    ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('GALERÍA DE RECUERDOS', W / 2, badgeY + badgeH / 2 + 1);

    // 4. Nombre del Evento
    ctx.textBaseline = 'top';
    ctx.fillStyle = tema.text;
    ctx.font = '700 74px "Fraunces", Georgia, serif';
    const nombreEvento = window.EVENTO_NOMBRE || 'Nuestro Evento';
    const yDespuesEvento = dibujarTextoMultilinea(ctx, nombreEvento, W / 2, badgeY + 120, cardW - 140, 90);

    // 5. Nombre de los Clientes / Festejados y Fecha del Evento
    const nombreCliente = window.EVENTO_CLIENTE || '';
    let yDespuesCliente = yDespuesEvento + 18;
    if (nombreCliente) {
        ctx.fillStyle = tema.muted;
        ctx.font = '600 36px "Plus Jakarta Sans", system-ui, sans-serif';
        yDespuesCliente = dibujarTextoMultilinea(ctx, nombreCliente, W / 2, yDespuesEvento + 18, cardW - 160, 48);
    }

    const fechaEvento = window.EVENTO_FECHA || '';
    if (fechaEvento) {
        // Línea divisoria sutil
        const divW = 120;
        const divY = yDespuesCliente + 26;
        ctx.save();
        ctx.strokeStyle = tema.cardBorder;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((W - divW) / 2, divY);
        ctx.lineTo((W + divW) / 2, divY);
        ctx.stroke();
        ctx.restore();

        // Fecha del evento en el espacio central
        ctx.fillStyle = tema.accent;
        ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillText(fechaEvento, W / 2, divY + 30);
    }

    // 6. Contenedor limpio con fondo claro y bordes redondeados para el QR
    const qrBoxSize = 640;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 740;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.1)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    dibujarRectanguloRedondeado(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 44);
    ctx.fillStyle = tema.qrBoxBg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    dibujarRectanguloRedondeado(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 44);
    ctx.lineWidth = 4;
    ctx.strokeStyle = tema.qrBoxBorder;
    ctx.stroke();
    ctx.restore();

    // Dibujar QR nítido centrado dentro del contenedor blanco
    const qrPadding = 52;
    const qrSize = qrBoxSize - qrPadding * 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImg, qrBoxX + qrPadding, qrBoxY + qrPadding, qrSize, qrSize);
    ctx.restore();

    // 7. Llamado a la acción inferior
    ctx.fillStyle = tema.accent;
    ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('¡Comparte tus mejores momentos!', W / 2, qrBoxY + qrBoxSize + 85);

    ctx.fillStyle = tema.muted;
    ctx.font = '500 30px "Plus Jakarta Sans", system-ui, sans-serif';
    dibujarTextoMultilinea(
        ctx,
        'Escanea el código para subir tus fotos y videos a nuestra galería',
        W / 2,
        qrBoxY + qrBoxSize + 148,
        cardW - 180,
        44
    );
}

function seleccionarPresetQR(preset) {
    presetQRActual = preset;

    document.querySelectorAll('.qr-preset-btn').forEach(btn => {
        if (btn.dataset.preset === preset) {
            btn.classList.add('ring-2', 'ring-[color:var(--neu-primary)]');
        } else {
            btn.classList.remove('ring-2', 'ring-[color:var(--neu-primary)]');
        }
    });

    renderizarTarjetaQR();
}

function inicializarTarjetaQR() {
    const qrImg = document.getElementById('qr-source-img');
    if (!qrImg) return;

    const dibujarCuandoEsteListo = () => {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(renderizarTarjetaQR);
        } else {
            renderizarTarjetaQR();
        }
    };

    if (qrImg.complete && qrImg.naturalWidth > 0) {
        dibujarCuandoEsteListo();
    } else {
        qrImg.addEventListener('load', dibujarCuandoEsteListo);
    }
}

function obtenerNombreArchivoQR() {
    const limpio = (window.EVENTO_NOMBRE || 'evento')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '');
    return `invitacion_qr_${limpio || 'evento'}.png`;
}

function descargarTarjetaQR() {
    const canvas = document.getElementById('qr-card-canvas');
    if (!canvas) return;

    const enlace = document.createElement('a');
    enlace.download = obtenerNombreArchivoQR();
    enlace.href = canvas.toDataURL('image/png');
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
}

async function compartirTarjetaQR() {
    const canvas = document.getElementById('qr-card-canvas');
    if (!canvas) return;

    renderizarTarjetaQR();

    const btn = document.getElementById('btn-compartir-qr');
    if (btn) btn.disabled = true;

    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            descargarTarjetaQR();
            return;
        }

        const nombreArchivo = obtenerNombreArchivoQR();
        const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
        const datosCompartir = {
            files: [archivo],
            title: window.EVENTO_NOMBRE || 'Invitación a la galería',
            text: `Escanea este código QR para subir tus fotos a ${window.EVENTO_NOMBRE || 'nuestra galería'}.`
        };

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share(datosCompartir);
        } else {
            descargarTarjetaQR();
        }
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return;
        }
        descargarTarjetaQR();
    } finally {
        if (btn) btn.disabled = false;
    }
}