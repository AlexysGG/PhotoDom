let colaArchivos = [];
let fotoIdAEliminar = null;
let bannerErrorTimeout = null;

// --- CARRUSEL / LIGHTBOX ---
let archivosGaleria = [];   // [{ url, esVideo, id, liked, likes }]
let indiceActual = 0;

// Variables para gestos táctiles y de arrastre
let startX = 0;
let isDragging = false;

// Constantes y utilidades de configuración
const TAMANO_MAX_ARCHIVO_MB = 1000; // Máximo por archivo individual (1 GB)

function obtenerCsrfToken() {
    if (window.APP_CONFIG && window.APP_CONFIG.csrfToken) {
        return window.APP_CONFIG.csrfToken;
    }
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}

function obtenerSubirUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.subirUrl) {
        return window.APP_CONFIG.subirUrl;
    }
    return window.location.pathname.replace(/\/?$/, '/subir/');
}

function obtenerPlanMaxMB() {
    return (window.APP_CONFIG && window.APP_CONFIG.planMaxMb) || 200;
}

// Obtener peso inicial de los archivos ya subidos que están en el DOM
function obtenerEspacioUsadoEnServidorMB() {
    return (window.APP_CONFIG && window.APP_CONFIG.espacioUsadoMb) || 0;
}

function permiteInteraccionEvento() {
    return Boolean(window.APP_CONFIG && window.APP_CONFIG.permiteInteraccion);
}

function obtenerUrlMarco() {
    return (window.APP_CONFIG && window.APP_CONFIG.urlMarco) || '';
}

function calcularEspacioColaMB() {
    const bytesTotales = colaArchivos.reduce((acum, file) => acum + file.size, 0);
    return bytesTotales / (1024 * 1024);
}

function mostrarError(mensaje) {
    const banner = document.getElementById('banner-error');
    document.getElementById('banner-error-texto').innerText = mensaje;
    banner.classList.remove('hidden');

    clearTimeout(bannerErrorTimeout);
    bannerErrorTimeout = setTimeout(cerrarBannerError, 5000);
}

function cerrarBannerError() {
    document.getElementById('banner-error').classList.add('hidden');
}

function procesarSeleccion(input) {
    if (!input.files || input.files.length === 0) return;

    const rechazados = [];
    const espacioUsadoServer = obtenerEspacioUsadoEnServidorMB();
    let espacioColaActual = calcularEspacioColaMB();
    const planMaxMb = obtenerPlanMaxMB();

    Array.from(input.files).forEach(file => {
        const esValido = file.type.startsWith('image/') || file.type.startsWith('video/');
        const pesoArchivoMB = file.size / (1024 * 1024);
        const pesoOk = pesoArchivoMB <= TAMANO_MAX_ARCHIVO_MB;

        // Validar espacio restante disponible en el plan
        const espacioDisponible = planMaxMb - (espacioUsadoServer + espacioColaActual);

        if (!esValido) {
            rechazados.push(`${file.name} (formato no soportado)`);
        } else if (!pesoOk) {
            rechazados.push(`${file.name} (supera ${TAMANO_MAX_ARCHIVO_MB}MB)`);
        } else if (pesoArchivoMB > espacioDisponible) {
            const libre = Math.max(0, espacioDisponible).toFixed(1);
            rechazados.push(`${file.name} (excede los ${libre}MB disponibles del plan)`);
        } else {
            colaArchivos.push(file);
            espacioColaActual += pesoArchivoMB; // Sumar al espacio acumulado temporal
        }
    });

    if (rechazados.length > 0) {
        mostrarError(`Algunos archivos no se agregaron:\n${rechazados.join('\n')}`);
    }

    renderizarPrevisualizaciones();
    actualizarBotonesFlotantes();
    input.value = '';
}

function renderizarPrevisualizaciones() {
    const contenedor = document.getElementById('grid-preview');
    const seccion = document.getElementById('seccion-previsualizacion');

    document.getElementById('contador-preview').innerText = `(${colaArchivos.length})`;

    if (colaArchivos.length === 0) {
        seccion.classList.add('hidden');
        contenedor.innerHTML = '';
        return;
    }

    seccion.classList.remove('hidden');
    contenedor.innerHTML = '';

    const urlMarco = obtenerUrlMarco();

    colaArchivos.forEach((file, index) => {
        const urlBlob = URL.createObjectURL(file);
        const esVideo = file.type.startsWith('video/');
        const mensajeExistente = file.mensaje || '';

        const inputMensajeHtml = permiteInteraccionEvento() ? `
            <input type="text" 
                placeholder="💬 Escribe un comentario..." 
                value="${mensajeExistente}"
                oninput="guardarMensajeEnCola(${index}, this.value)"
                class="w-full text-[11px] p-2 neu-pressed rounded-xl border-none focus:outline-none text-gray-700 placeholder-gray-400">
        ` : '';

        const marcoOverlay = (!esVideo && urlMarco)
            ? `<img src="${urlMarco}" alt="Marco preview" class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none">`
            : '';

        const cardPreview = `
        <div class="neu-flat p-2.5 relative flex flex-col justify-between rounded-2xl h-full">
            <button onclick="removerDeCola(${index})" aria-label="Quitar archivo" class="neu-btn-close absolute -top-2 -right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center text-red-500 text-xs font-bold">
                ✕
            </button>
            
            <div class="aspect-square neu-pressed relative overflow-hidden rounded-xl mb-2 w-full shrink-0">
                ${esVideo
                ? `<video src="${urlBlob}" class="absolute inset-0 block w-full h-full object-cover z-0" muted></video>`
                : `<img src="${urlBlob}" class="absolute inset-0 block w-full h-full object-cover z-0" alt="Previsualización">`
            }
                ${marcoOverlay}
            </div>

            ${inputMensajeHtml}
        </div>
        `;
        contenedor.insertAdjacentHTML('beforeend', cardPreview);
    });

    const botonAgregarMas = `
    <button onclick="document.getElementById('input-fotos').click()" type="button" 
        class="aspect-square neu-button rounded-2xl flex flex-col items-center justify-center gap-1 text-indigo-600 font-bold p-2 border-2 border-dashed border-indigo-300/50 hover:bg-indigo-50/30 transition-all">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-[11px] uppercase tracking-wider text-center">Añadir más</span>
    </button>
    `;
    contenedor.insertAdjacentHTML('beforeend', botonAgregarMas);
}

// Función auxiliar para actualizar el texto en la cola al escribir
function guardarMensajeEnCola(index, texto) {
    if (colaArchivos[index]) {
        colaArchivos[index].mensaje = texto;
    }
}

function removerDeCola(index) {
    colaArchivos.splice(index, 1);
    renderizarPrevisualizaciones();
    actualizarBotonesFlotantes();
}

function limpiarSeleccion() {
    colaArchivos = [];
    renderizarPrevisualizaciones();
    actualizarBotonesFlotantes();
}

function verificarGaleriaVacia() {
    const grid = document.getElementById('grid-fotos');
    if (grid.children.length === 0) {
        const tarjetaVacia = `
                <div id="sin-fotos" class="col-span-full w-full neu-pressed p-10 rounded-3xl text-center my-6 flex flex-col items-center justify-center min-h-[220px]">
                    <p class="text-gray-500 font-bold text-lg mb-1">Aún no hay recuerdos.</p>
                    <p class="text-gray-400 text-sm mb-6">¡Sé el primero en compartir tus fotos o videos!</p>
                    <button onclick="document.getElementById('input-fotos').click()" type="button"
                        class="neu-flat px-6 py-3 rounded-2xl text-indigo-600 font-bold text-sm flex items-center gap-2 hover:text-indigo-700 transition-all active:scale-95">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        SELECCIONAR FOTOS/VIDEOS
                    </button>
                </div>
            `;
        grid.innerHTML = tarjetaVacia;
    }
}

function subirArchivoXHR(file, numActual, total) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('foto', file);

        // Adjuntar el mensaje guardado en el archivo (o string vacío si no escribió nada)
        formData.append('mensaje', file.mensaje || '');

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const porcentaje = Math.round((e.loaded / e.total) * 100);
                const txt = document.getElementById('progreso-texto');

                if (txt) {
                    if (porcentaje === 100) {
                        txt.innerText = `Procesando en la nube... (${numActual} de ${total})`;
                    } else {
                        txt.innerText = `Subiendo ${numActual} de ${total}...`;
                    }
                }
            }
        });

        xhr.addEventListener('load', () => {
            let data = {};
            try {
                data = JSON.parse(xhr.responseText || '{}');
            } catch (e) {
                return reject('Error interno en el servidor (500). Revisa la consola o logs de Render.');
            }

            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                resolve(data);
            } else {
                reject(data.error || `Error del servidor (${xhr.status})`);
            }
        });

        xhr.addEventListener('error', () => reject('Error de red al conectar con el servidor.'));

        xhr.open('POST', obtenerSubirUrl(), true);
        xhr.setRequestHeader('X-CSRFToken', obtenerCsrfToken());
        xhr.send(formData);
    });
}

async function subirTodosLosArchivos() {
    if (colaArchivos.length === 0) return;

    const modalProgreso = document.getElementById('modal-progreso');
    const txt = document.getElementById('progreso-texto');

    if (txt) txt.innerText = "Iniciando subida...";
    if (modalProgreso) modalProgreso.classList.remove('hidden');

    const total = colaArchivos.length;
    let subidasExitosas = 0;
    const urlMarco = obtenerUrlMarco();

    for (let i = 0; i < total; i++) {
        try {
            const data = await subirArchivoXHR(colaArchivos[i], i + 1, total);

            const sinFotos = document.getElementById('sin-fotos');
            if (sinFotos) sinFotos.remove();

            const grid = document.getElementById('grid-fotos');
            
            let mediaTag = '';
            if (data.es_video) {
                if (data.estado === 'PROCESANDO') {
                    mediaTag = `
                        <div class="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-20">
                            <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                            <span class="text-[10px] font-bold text-gray-500">Procesando video...</span>
                        </div>
                    `;
                } else if (data.thumb_url) {
                    mediaTag = `<img src="${data.thumb_url}" class="absolute inset-0 block w-full h-full object-cover z-0" loading="lazy">`;
                } else {
                    mediaTag = `<video class="absolute inset-0 block w-full h-full object-cover z-0 pointer-events-none" preload="metadata"><source src="${data.archivo_url}#t=0.5" type="video/mp4"></video>`;
                }
            } else {
                mediaTag = `<img src="${data.thumb_url || data.archivo_url}" class="absolute inset-0 block w-full h-full object-cover z-0" alt="Foto subida">`;
            }

            // Superposición de marco dinámico
            const marcoOverlay = (!data.es_video && urlMarco)
                ? `<img src="${urlMarco}" alt="Marco" class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none">`
                : '';

            // Badge de tipo Video
            const videoBadge = data.es_video
                ? `<span class="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none backdrop-blur-sm"><svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Video</span>`
                : '';

            // Renderizar la tarjeta completa con mensaje y likes solo si el plan lo permite
            const permiteInteraccion = permiteInteraccionEvento();
            const mensajeTag = (permiteInteraccion && data.mensaje)
                ? `<p class="text-xs text-gray-600 italic px-1 mb-2 line-clamp-2 leading-tight">"${data.mensaje}"</p>`
                : '';

            const interaccionesTag = permiteInteraccion ? `
                <div class="flex items-center justify-between px-1 pt-2 border-t border-gray-200/50 text-xs text-gray-600">
                    <button id="btn-like-${data.id}" onclick="darLike(${data.id})" class="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <svg id="icon-like-${data.id}" class="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        <span id="likes-count-${data.id}" class="font-bold">0</span>
                    </button>

                    
                </div>
            ` : '';

            const nuevaCard = `
                <div id="card-foto-${data.id}" class="photo-card neu-flat p-3 pt-4 relative group flex flex-col justify-between">
                    <button onclick="abrirModalEliminar(${data.id})" class="neu-btn-close absolute -top-2 -right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-red-500 font-bold">
                        ✕
                    </button>
                    
                    <div class="media-item aspect-square neu-pressed relative overflow-hidden rounded-xl mb-2 cursor-pointer"
                        data-url="${data.preview_url || data.archivo_url}"
                        data-es-video="${data.es_video ? 'true' : 'false'}"
                        data-id="${data.id}"
                        data-estado="${data.estado}"
                        data-liked="false"
                        data-likes="0"
                        onclick="${data.estado !== 'PROCESANDO' ? `abrirCarrusel(0)` : ''}">
                        ${mediaTag}
                        ${marcoOverlay}
                        ${videoBadge}
                    </div>

                    ${mensajeTag}
                    ${interaccionesTag}
                </div>
            `;
            if (grid) grid.insertAdjacentHTML('afterbegin', nuevaCard);
            subidasExitosas++;

        } catch (err) {
            mostrarError(`Ocurrió un problema: ${err}`);
            break;
        }
    }

    if (modalProgreso) modalProgreso.classList.add('hidden');

    if (subidasExitosas > 0) {
        limpiarSeleccion();
        // Re-sincronizar el array del carrusel con las nuevas fotos insertadas
        sincronizarGaleriaCarrusel();
        // Corregir el índice onclick de las nuevas tarjetas
        actualizarOnclickCarrusel();
        const modalGracias = document.getElementById('modal-gracias');
        if (modalGracias) modalGracias.classList.remove('hidden');
    }
}

function cerrarModalGracias() {
    document.getElementById('modal-gracias').classList.add('hidden');
}

function abrirModalEliminar(id) {
    fotoIdAEliminar = id;
    document.getElementById('modal-eliminar').classList.remove('hidden');
}

function cerrarModalEliminar() {
    fotoIdAEliminar = null;
    document.getElementById('modal-eliminar').classList.add('hidden');
}

function confirmarEliminar() {
    if (!fotoIdAEliminar) return;

    fetch(`/foto/${fotoIdAEliminar}/eliminar/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': obtenerCsrfToken() }
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const card = document.getElementById(`card-foto-${fotoIdAEliminar}`);
                if (card) card.remove();
                cerrarModalEliminar();
                verificarGaleriaVacia();
            } else {
                mostrarError('Error al eliminar: ' + data.error);
            }
        })
        .catch(() => mostrarError('No se pudo eliminar la imagen.'));
}

function actualizarBotonesFlotantes() {
    const btnSeleccionar = document.getElementById('btn-seleccionar-flotante');
    const btnSubir = document.getElementById('btn-subir-flotante');
    const badgeCant = document.getElementById('cant-archivos-btn');
    const sinFotosCard = document.getElementById('sin-fotos');

    if (colaArchivos.length > 0) {
        if (btnSeleccionar) btnSeleccionar.classList.add('hidden');
        if (btnSubir) btnSubir.classList.remove('hidden');
        if (badgeCant) badgeCant.innerText = colaArchivos.length;

        if (sinFotosCard) sinFotosCard.classList.add('hidden');
    } else {
        if (btnSeleccionar) btnSeleccionar.classList.remove('hidden');
        if (btnSubir) btnSubir.classList.add('hidden');

        if (sinFotosCard) sinFotosCard.classList.remove('hidden');
    }
}

function darLike(fotoId) {
    fetch(`/foto/${fotoId}/like/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': obtenerCsrfToken(),
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.likes !== undefined) {
            // 1. Sincronizar UI de la malla externa
            actualizarUiLikeMalla(fotoId, data.dio_like, data.likes);
            
            // 2. Persistir en el dataset DOM
            const mediaItem = document.querySelector(`.media-item[data-id="${fotoId}"]`);
            if (mediaItem) {
                mediaItem.dataset.liked = data.dio_like ? "true" : "false";
                mediaItem.dataset.likes = data.likes;
            }

            // 3. Sincronizar array en memoria del carrusel
            if (typeof archivosGaleria !== 'undefined') {
                const item = archivosGaleria.find(f => f.id == fotoId);
                if (item) {
                    item.liked = data.dio_like;
                    item.likes = data.likes;
                }
            }
        }
    })
    .catch(error => console.error('Error al dar me gusta:', error));
}



// --- INICIALIZACIÓN DEL CARRUSEL ---
document.addEventListener("DOMContentLoaded", () => {
    sincronizarGaleriaCarrusel();
    actualizarOnclickCarrusel();

    const area = document.getElementById("carrusel-touch-area");
    if (area) {
        area.addEventListener("touchstart", touchStart, { passive: true });
        area.addEventListener("touchmove", touchMove, { passive: true });
        area.addEventListener("touchend", touchEnd);

        area.addEventListener("mousedown", touchStart);
        area.addEventListener("mousemove", touchMove);
        area.addEventListener("mouseup", touchEnd);
        area.addEventListener("mouseleave", () => { if (typeof isDragging !== 'undefined' && isDragging) touchEnd(); });
    }
});

function sincronizarGaleriaCarrusel() {
    const elementos = document.querySelectorAll(".media-item");
    archivosGaleria = Array.from(elementos).map(el => ({
        url: el.dataset.url,
        esVideo: el.dataset.esVideo === "true",
        id: parseInt(el.dataset.id, 10) || null,
        liked: el.dataset.liked === "true",
        likes: parseInt(el.dataset.likes, 10) || 0
    }));
}

function actualizarOnclickCarrusel() {
    const elementos = document.querySelectorAll(".media-item");
    elementos.forEach((el, idx) => {
        el.onclick = () => abrirCarrusel(idx);
    });
}

// --- LIGHTBOX: ABRIR / CERRAR ---
function abrirCarrusel(index) {
    indiceActual = index;
    const mediaElements = document.querySelectorAll('.media-item');
    const el = mediaElements[index];
    if (el && el.dataset.procesando === "true") {
        alert("Este archivo aún se está optimizando. Estará listo en unos segundos.");
        return; // Evita abrir el modal y evita pedir bytes al bucket
    }

    if (el) {
        const liked = el.dataset.liked === "true";
        const likes = parseInt(el.dataset.likes, 10) || 0;

        if (archivosGaleria[index]) {
            archivosGaleria[index].liked = liked;
            archivosGaleria[index].likes = likes;
        }
    }

    document.getElementById('lightbox-modal').classList.remove('hidden');
    
    // Renderiza el slide e icono del carrusel con la info sincronizada
    actualizarVistaCarrusel();
}

function cerrarCarrusel() {
    const video = document.getElementById("carrusel-video");
    if (video) video.pause();
    document.getElementById("lightbox-modal").classList.add("hidden");
    document.body.style.overflow = "";
}

function cambiarSlide(direccion) {
    const video = document.getElementById("carrusel-video");
    if (video) video.pause();

    indiceActual += direccion;
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

    if (container) {
        container.style.transform = "translateX(0px)";
        container.style.transition = "transform 0.3s ease-out";
    }

    if (videoEl) {
        videoEl.pause();
        videoEl.currentTime = 0;
    }

    if (item.esVideo) {
        if (imgEl) imgEl.classList.add("hidden");
        if (videoEl) { 
            videoEl.src = item.url; 
            videoEl.classList.remove("hidden"); 
        }
    } else {
        if (videoEl) videoEl.classList.add("hidden");
        if (imgEl) { 
            imgEl.src = item.url; 
            imgEl.classList.remove("hidden"); 
        }
    }

    if (contador) {
        contador.innerText = `${indiceActual + 1} / ${archivosGaleria.length}`;
    }

    actualizarBtnLikeCarrusel(item.liked, item.likes);
}

function actualizarBtnLikeCarrusel(liked, likes) {
    const btnLike = document.getElementById("carrusel-btn-like");
    const iconLike = document.getElementById("carrusel-icon-like");
    const countEl = document.getElementById("carrusel-likes-count");

    if (!btnLike) return;

    if (countEl) countEl.innerText = likes;

    if (liked) {
        btnLike.classList.add("text-red-500");
        btnLike.classList.remove("text-gray-400");
        if (iconLike) {
            iconLike.setAttribute("fill", "currentColor");
            iconLike.style.fill = "currentColor";
            iconLike.setAttribute("stroke", "currentColor");
        }
    } else {
        btnLike.classList.remove("text-red-500");
        btnLike.classList.add("text-gray-400");
        if (iconLike) {
            iconLike.setAttribute("fill", "none");
            iconLike.style.fill = "none";
            iconLike.setAttribute("stroke", "currentColor");
        }
    }
}

function darLikeCarrusel() {
    const item = archivosGaleria[indiceActual];
    if (!item || !item.id) return;

    fetch(`/foto/${item.id}/like/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': obtenerCsrfToken(),
            'Content-Type': 'application/json'
        }
    })
    .then(r => r.json())
    .then(data => {
        if (data.likes !== undefined) {
            // 1. Actualizar objeto en memoria
            item.liked = data.dio_like;
            item.likes = data.likes;

            // 2. Persistir dataset en el DOM
            const mediaItem = document.querySelector(`.media-item[data-id="${item.id}"]`);
            if (mediaItem) {
                mediaItem.dataset.liked = data.dio_like ? "true" : "false";
                mediaItem.dataset.likes = data.likes;
            }

            // 3. Reflejar UI en carrusel y malla
            actualizarBtnLikeCarrusel(data.dio_like, data.likes);
            actualizarUiLikeMalla(item.id, data.dio_like, data.likes);
        }
    })
    .catch(err => console.error("Error al dar like desde el carrusel:", err));
}

function actualizarUiLikeMalla(id, dioLike, totalLikes) {
    const btn = document.getElementById(`btn-like-${id}`);
    const icon = document.getElementById(`icon-like-${id}`);
    const count = document.getElementById(`likes-count-${id}`);

    if (count) count.innerText = totalLikes;

    if (btn && icon) {
        if (dioLike) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-red-500');
            icon.setAttribute('fill', 'currentColor');
            icon.style.fill = 'currentColor';
        } else {
            btn.classList.remove('text-red-500');
            btn.classList.add('text-gray-400');
            icon.setAttribute('fill', 'none');
            icon.style.fill = 'none';
        }
    }
}

// --- GESTOS SWIPE / DRAG ---
function getPositionX(e) {
    return e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
}

function touchStart(e) {
    if (e.target.tagName === 'VIDEO' && e.type === 'mousedown') {
        const rect   = e.target.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        if (clickY > rect.height - 50) return;
    }
    isDragging = true;
    startX = getPositionX(e);
    const container = document.getElementById("carrusel-slide-container");
    if (container) container.style.transition = "none";
}

function touchMove(e) {
    if (!isDragging) return;
    const diff      = getPositionX(e) - startX;
    const container = document.getElementById("carrusel-slide-container");
    if (container) container.style.transform = `translateX(${diff}px)`;
}

function touchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const container = document.getElementById("carrusel-slide-container");
    if (!container) return;

    const match = container.style.transform.match(/translateX\(([-0-9.]+)px\)/);
    if (match) {
        const movedBy = parseFloat(match[1]);
        if (movedBy < -50)      cambiarSlide(1);
        else if (movedBy > 50)  cambiarSlide(-1);
        else {
            container.style.transition = "transform 0.3s ease-out";
            container.style.transform  = "translateX(0px)";
        }
    } else {
        container.style.transition = "transform 0.3s ease-out";
        container.style.transform  = "translateX(0px)";
    }
}

// Navegación con teclado
document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("lightbox-modal");
    if (modal && !modal.classList.contains("hidden")) {
        if (e.key === "ArrowLeft")  cambiarSlide(-1);
        if (e.key === "ArrowRight") cambiarSlide(1);
        if (e.key === "Escape")     cerrarCarrusel();
    }
});

// --- POLLING ESTADO DE ARCHIVOS ---
let intervalPolling = null;

function iniciarPollingEstado() {
    if (intervalPolling) clearInterval(intervalPolling);
    
    intervalPolling = setInterval(async () => {
        const procesando = document.querySelectorAll('.media-item[data-estado="PROCESANDO"]');
        if (procesando.length === 0) return;
        
        const ids = Array.from(procesando).map(el => el.dataset.id).join(',');
        
        const match = window.location.pathname.match(/\/evento\/([^\/]+)/);
        if (!match) return;
        const eventoId = match[1];
        
        try {
            const resp = await fetch(`/api/evento/${eventoId}/estado-archivos/?ids=${ids}`);
            const data = await resp.json();
            
            if (data.archivos && data.archivos.length > 0) {
                data.archivos.forEach(archivo => {
                    if (archivo.estado === 'COMPLETADO') {
                        const mediaItem = document.querySelector(`.media-item[data-id="${archivo.id}"]`);
                        if (!mediaItem) return;
                        
                        mediaItem.dataset.estado = 'COMPLETADO';
                        mediaItem.dataset.url = archivo.preview_url || archivo.archivo_url;
                        
                        const allMediaItems = document.querySelectorAll('.media-item');
                        const index = Array.from(allMediaItems).indexOf(mediaItem);
                        mediaItem.setAttribute('onclick', `abrirCarrusel(${index})`);
                        
                        let mediaTag = '';
                        if (archivo.es_video) {
                            if (archivo.thumb_url) {
                                mediaTag = `<img src="${archivo.thumb_url}" alt="Video thumbnail" class="absolute inset-0 block w-full h-full object-cover z-0" loading="lazy">`;
                            } else {
                                mediaTag = `<video class="absolute inset-0 block w-full h-full object-cover z-0 pointer-events-none" preload="metadata"><source src="${archivo.archivo_url}#t=0.5" type="video/mp4"></video>`;
                            }
                            mediaTag += `<span class="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none backdrop-blur-sm"><svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Video</span>`;
                        } else {
                            mediaTag = `<img src="${archivo.thumb_url || archivo.archivo_url}" alt="Foto de evento" class="absolute inset-0 block w-full h-full object-cover z-0" loading="lazy">`;
                        }
                        
                        const urlMarco = obtenerUrlMarco();
                        const marcoOverlay = (!archivo.es_video && urlMarco)
                            ? `<img src="${urlMarco}" alt="Marco" class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none">`
                            : '';
                        
                        mediaItem.innerHTML = mediaTag + marcoOverlay;
                        
                        sincronizarGaleriaCarrusel();
                    }
                });
            }
        } catch (e) {
            console.error("Error en polling:", e);
        }
    }, 4000);
}

// Arrancamos el polling también al iniciar
document.addEventListener("DOMContentLoaded", () => {
    iniciarPollingEstado();
});