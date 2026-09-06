let colaArchivos = [];
let fotoIdAEliminar = null;
let bannerErrorTimeout = null;

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

    // 1. Dibuja las previsualizaciones con el campo de mensaje y la capa de marco si aplica
    colaArchivos.forEach((file, index) => {
        const urlBlob = URL.createObjectURL(file);
        const esVideo = file.type.startsWith('video/');
        const mensajeExistente = file.mensaje || '';

        const inputMensajeHtml = permiteInteraccionEvento() ? `
            <!-- Campo de Mensaje Dinámico -->
            <input type="text" 
                placeholder="💬 Escribe un comentario..." 
                value="${mensajeExistente}"
                oninput="guardarMensajeEnCola(${index}, this.value)"
                class="w-full text-[11px] p-2 neu-pressed rounded-xl border-none focus:outline-none text-gray-700 placeholder-gray-400">
        ` : '';

        // Overlay de Marco PNG (solo para imágenes)
        const marcoOverlay = (!esVideo && urlMarco)
            ? `<img src="${urlMarco}" alt="Marco preview" class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none">`
            : '';

        const cardPreview = `
        <div class="neu-flat p-2.5 relative flex flex-col justify-between rounded-2xl">
            <button onclick="removerDeCola(${index})" aria-label="Quitar archivo" class="neu-btn-close absolute -top-2 -right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center text-red-500 text-xs font-bold">
                ✕
            </button>
            
            <div class="aspect-square neu-pressed relative overflow-hidden rounded-xl mb-2">
                ${esVideo
                ? `<video src="${urlBlob}" class="w-full h-full object-cover relative z-0" muted></video>`
                : `<img src="${urlBlob}" class="w-full h-full object-cover relative z-0" alt="Previsualización">`
            }
                ${marcoOverlay}
            </div>

            ${inputMensajeHtml}
        </div>
        `;
        contenedor.insertAdjacentHTML('beforeend', cardPreview);
    });

    // 2. Botón "+ Añadir más"
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
            const mediaTag = data.es_video
                ? `<video class="w-full h-full object-cover relative z-0" controls><source src="${data.archivo_url}" type="video/mp4"></video>`
                : `<img src="${data.archivo_url}" class="w-full h-full object-cover relative z-0" alt="Foto subida">`;

            // Superposición de marco dinámico
            const marcoOverlay = (!data.es_video && urlMarco)
                ? `<img src="${urlMarco}" alt="Marco" class="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none">`
                : '';

            // Renderizar la tarjeta completa con mensaje y likes solo si el plan lo permite
            const permiteInteraccion = permiteInteraccionEvento();
            const mensajeTag = (permiteInteraccion && data.mensaje)
                ? `<p class="text-xs text-gray-600 italic px-1 mb-2 line-clamp-2 leading-tight">"${data.mensaje}"</p>`
                : '';

            const interaccionesTag = permiteInteraccion ? `
                    <div class="flex items-center justify-between px-1 pt-2 border-t border-gray-200/50 text-xs text-gray-600">
                        <button onclick="darLike(${data.id})" class="flex items-center gap-1.5 hover:text-red-500 transition-colors">
                            <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span id="likes-count-${data.id}" class="font-bold">0</span>
                        </button>

                        <button onclick="abrirComentarios(${data.id})" class="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <span class="font-semibold">0</span>
                        </button>
                    </div>
            ` : '';

            const nuevaCard = `
                <div id="card-foto-${data.id}" class="photo-card neu-flat p-3 pt-4 relative group flex flex-col justify-between">
                    <button onclick="abrirModalEliminar(${data.id})" class="neu-btn-close absolute -top-2 -right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-red-500 font-bold">
                        ✕
                    </button>
                    
                    <div class="aspect-square neu-pressed relative overflow-hidden rounded-xl mb-2">
                        ${mediaTag}
                        ${marcoOverlay}
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
            // 1. Actualiza el número de likes
            document.getElementById(`likes-count-${fotoId}`).innerText = data.likes;
            
            // 2. Elementos del DOM
            const btnLike = document.getElementById(`btn-like-${fotoId}`);
            const iconLike = document.getElementById(`icon-like-${fotoId}`);

            if (btnLike && iconLike) {
                if (data.dio_like) {
                    // Estado ACTIVO (Rojo y Relleno)
                    btnLike.classList.add('text-red-500');
                    btnLike.classList.remove('text-gray-400');
                    
                    iconLike.classList.add('fill-current');
                    iconLike.classList.remove('fill-none', 'stroke-current', 'stroke-2');
                } else {
                    // Estado INACTIVO (Gris y Delineado)
                    btnLike.classList.remove('text-red-500');
                    btnLike.classList.add('text-gray-400');
                    
                    iconLike.classList.remove('fill-current');
                    iconLike.classList.add('fill-none', 'stroke-current', 'stroke-2');
                }
            }
        }
    })
    .catch(error => console.error('Error al dar me gusta:', error));
}

function abrirComentarios(fotoId) {
    console.log("Abrir modal de foto:", fotoId);
}