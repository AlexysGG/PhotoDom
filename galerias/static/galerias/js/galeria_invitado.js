let colaArchivos = [];
let fotoIdAEliminar = null;
let bannerErrorTimeout = null;

// Constantes de límites de almacenamiento
const TAMANO_MAX_ARCHIVO_MB = 1000; // Máximo por archivo individual (1 GB)
const PLAN_MAX_MB = parseFloat("{{ evento.plan_almacenamiento }}") || 200;

// Obtener peso inicial de los archivos ya subidos que están en el DOM
function obtenerEspacioUsadoEnServidorMB() {
    // Se puede inyectar desde el backend o calcular leyendo el DOM si tienes data attributes
    return parseFloat("{{ espacio_usado_mb|default:'0' }}") || 0;
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

    Array.from(input.files).forEach(file => {
        const esValido = file.type.startsWith('image/') || file.type.startsWith('video/');
        const pesoArchivoMB = file.size / (1024 * 1024);
        const pesoOk = pesoArchivoMB <= TAMANO_MAX_ARCHIVO_MB;

        // Validar espacio restante disponible en el plan
        const espacioDisponible = PLAN_MAX_MB - (espacioUsadoServer + espacioColaActual);

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

    // 1. Dibuja las previsualizaciones existentes
    colaArchivos.forEach((file, index) => {
        const urlBlob = URL.createObjectURL(file);
        const esVideo = file.type.startsWith('video/');

        const cardPreview = `
        <div class="neu-flat p-2 relative">
            <button onclick="removerDeCola(${index})" aria-label="Quitar archivo" class="neu-btn-close absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-red-500 text-xs font-bold">
                ✕
            </button>
            <div class="aspect-square neu-pressed overflow-hidden rounded-lg">
                ${esVideo
                ? `<video src="${urlBlob}" class="w-full h-full object-cover" muted></video>`
                : `<img src="${urlBlob}" class="w-full h-full object-cover" alt="Previsualización">`
            }
            </div>
        </div>
    `;
        contenedor.insertAdjacentHTML('beforeend', cardPreview);
    });

    // 2. Agrega el botón "+ Añadir más" al final de la cuadrícula de previsualización
    const botonAgregarMas = `
    <button onclick="document.getElementById('input-fotos').click()" type="button" 
        class="aspect-square neu-button rounded-xl flex flex-col items-center justify-center gap-1 text-indigo-600 font-bold p-2 border-2 border-dashed border-indigo-300/50 hover:bg-indigo-50/30 transition-all">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-[11px] uppercase tracking-wider text-center">Añadir más</span>
    </button>
`;
    contenedor.insertAdjacentHTML('beforeend', botonAgregarMas);
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
                // Ocurre cuando el servidor responde con HTML (ej. Error 500)
                return reject('Error interno en el servidor (500). Revisa la consola o logs de Render.');
            }

            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                resolve(data);
            } else {
                reject(data.error || `Error del servidor (${xhr.status})`);
            }
        });

        xhr.addEventListener('error', () => reject('Error de red al conectar con el servidor.'));

        xhr.open('POST', "{% url 'subir_foto_ajax' evento.id %}", true);
        xhr.setRequestHeader('X-CSRFToken', '{{ csrf_token }}');
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

    for (let i = 0; i < total; i++) {
        try {
            const data = await subirArchivoXHR(colaArchivos[i], i + 1, total);

            const sinFotos = document.getElementById('sin-fotos');
            if (sinFotos) sinFotos.remove();

            const grid = document.getElementById('grid-fotos');
            const mediaTag = data.es_video
                ? `<video class="w-full h-full object-cover" controls><source src="${data.archivo_url}" type="video/mp4"></video>`
                : `<img src="${data.archivo_url}" class="w-full h-full object-cover">`;

            const nuevaCard = `
                    <div id="card-foto-${data.id}" class="neu-flat p-3 relative group">
                        <button onclick="abrirModalEliminar(${data.id})" class="neu-btn-close absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-red-500 font-bold">
                            ✕
                        </button>
                        <div class="aspect-square neu-pressed overflow-hidden rounded-xl">
                            ${mediaTag}
                        </div>
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
        headers: { 'X-CSRFToken': '{{ csrf_token }}' }
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