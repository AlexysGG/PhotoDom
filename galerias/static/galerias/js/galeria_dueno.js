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
});