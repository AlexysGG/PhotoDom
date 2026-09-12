// Configuración del proyector
const CONFIG = {
    intervaloFotos: 6000, // 6 segundos para fotos
    intervaloPolling: 10000, // 10 segundos para polling
    transicionNuevoArchivo: 2000 // duración de animación para archivos nuevos
};

// Estado del proyector
let archivos = [];
let indiceActual = 0;
let timerFotos = null;
let timerPolling = null;
let ultimoIdProcesado = 0;

// Elementos DOM
const imgDisplay = document.getElementById('media-display');
const videoDisplay = document.getElementById('media-display-video');
const mensajeOverlay = document.getElementById('mensaje-overlay');
const loadingIndicator = document.getElementById('loading-indicator');

// Inicialización
function inicializarProyector() {
    // Cargar archivos iniciales desde el contexto
    archivos = window.ARCHIVOS_INICIALES || [];
    
    console.log('Archivos iniciales cargados:', archivos.length);
    console.log('Archivos:', archivos);
    
    // Mostrar loading inicialmente
    loadingIndicator.style.display = 'block';
    loadingIndicator.textContent = 'Cargando proyector...';
    
    if (archivos.length === 0) {
        loadingIndicator.textContent = 'Esperando fotos...';
    } else {
        // Establecer el último ID procesado
        ultimoIdProcesado = Math.max(...archivos.map(a => a.id));
        console.log('Último ID procesado:', ultimoIdProcesado);
        console.log('Índice actual:', indiceActual);
        
        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            mostrarArchivoActual();
            
            // Solo iniciar ciclo si no es video (los videos manejan su propio ciclo)
            if (!archivos[indiceActual].es_video) {
                iniciarCicloReproduccion();
            }
        }, 100);
    }
    
    // Iniciar polling para archivos nuevos
    iniciarPolling();
}

// Mostrar archivo actual en pantalla
function mostrarArchivoActual(esNuevo = false) {
    if (archivos.length === 0) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = 'Esperando fotos...';
        return;
    }
    
    loadingIndicator.style.display = 'none';
    
    const archivo = archivos[indiceActual];
    console.log('Mostrando archivo:', archivo);
    
    // Ocultar ambos elementos primero
    imgDisplay.style.display = 'none';
    videoDisplay.style.display = 'none';
    videoDisplay.pause();
    
    if (archivo.es_video) {
        // Mostrar video
        videoDisplay.src = archivo.url;
        videoDisplay.style.display = 'block';
        videoDisplay.load();
        
        // Evento cuando el video termina
        videoDisplay.onended = () => {
            console.log('Video terminado, pasando al siguiente');
            pasarAlSiguiente();
        };
        
        // Manejo de errores de carga
        videoDisplay.onerror = () => {
            console.error('Error al cargar video:', archivo.url);
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Error al cargar video. Pasando al siguiente...';
            setTimeout(() => pasarAlSiguiente(), 2000);
        };
        
        // Iniciar reproducción
        videoDisplay.play().catch(e => {
            console.error('Error al reproducir video:', e);
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Video no soportado. Pasando al siguiente...';
            setTimeout(() => pasarAlSiguiente(), 2000);
        });
        
        // Pausar el timer de fotos mientras se reproduce el video
        if (timerFotos) {
            clearTimeout(timerFotos);
            timerFotos = null;
        }
    } else {
        // Mostrar imagen
        imgDisplay.src = archivo.url;
        imgDisplay.style.display = 'block';
        
        // Manejo de errores de carga de imagen
        imgDisplay.onerror = () => {
            console.error('Error al cargar imagen:', archivo.url);
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Error al cargar imagen. Pasando al siguiente...';
            setTimeout(() => pasarAlSiguiente(), 2000);
        };
        
        // Reiniciar timer para fotos
        reiniciarTimerFotos();
    }
    
    // Mostrar mensaje si existe
    if (archivo.mensaje && archivo.mensaje.trim()) {
        mensajeOverlay.textContent = archivo.mensaje;
        mensajeOverlay.style.display = 'block';
    } else {
        mensajeOverlay.style.display = 'none';
    }
    
    // Animación para archivos nuevos
    if (esNuevo) {
        const elementoActivo = archivo.es_video ? videoDisplay : imgDisplay;
        elementoActivo.classList.add('nuevo-archivo-animation');
        setTimeout(() => {
            elementoActivo.classList.remove('nuevo-archivo-animation');
        }, CONFIG.transicionNuevoArchivo);
    }
}

// Pasar al siguiente archivo (cíclico)
function pasarAlSiguiente() {
    if (archivos.length === 0) return;
    
    indiceActual = (indiceActual + 1) % archivos.length;
    mostrarArchivoActual();
}

// Reiniciar timer para fotos
function reiniciarTimerFotos() {
    if (timerFotos) {
        clearTimeout(timerFotos);
    }
    
    timerFotos = setTimeout(() => {
        pasarAlSiguiente();
    }, CONFIG.intervaloFotos);
}

// Iniciar ciclo de reproducción
function iniciarCicloReproduccion() {
    reiniciarTimerFotos();
}

// Polling para archivos nuevos
function iniciarPolling() {
    // Ejecutar inmediatamente y luego cada intervalo
    verificarArchivosNuevos();
    
    timerPolling = setInterval(() => {
        verificarArchivosNuevos();
    }, CONFIG.intervaloPolling);
}

// Verificar archivos nuevos mediante API
async function verificarArchivosNuevos() {
    try {
        const url = `/api/evento/${window.EVENTO_ID}/archivos-recientes/?ultimoid=${ultimoIdProcesado}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Error en la respuesta de la API');
        }
        
        const data = await response.json();
        
        if (data.archivos && data.archivos.length > 0) {
            // Procesar archivos nuevos
            procesarArchivosNuevos(data.archivos);
        }
    } catch (error) {
        console.error('Error al verificar archivos nuevos:', error);
    }
}

// Procesar archivos nuevos y añadirlos al inicio de la cola
function procesarArchivosNuevos(nuevosArchivos) {
    if (nuevosArchivos.length === 0) return;
    
    // Filtrar archivos que ya tenemos
    const idsConocidos = new Set(archivos.map(a => a.id));
    const archivosRealesNuevos = nuevosArchivos.filter(a => !idsConocidos.has(a.id));
    
    if (archivosRealesNuevos.length === 0) return;
    
    // Ordenar por ID descendente para mantener el orden cronológico
    archivosRealesNuevos.sort((a, b) => b.id - a.id);
    
    // Anteponer nuevos archivos al inicio de la lista
    archivos = [...archivosRealesNuevos, ...archivos];
    
    // Actualizar el último ID procesado
    const maxId = Math.max(...archivosRealesNuevos.map(a => a.id));
    ultimoIdProcesado = Math.max(ultimoIdProcesado, maxId);
    
    // Mostrar inmediatamente el archivo más nuevo
    indiceActual = 0;
    mostrarArchivoActual(true); // true = es nuevo archivo
    
    console.log(`Se añadieron ${nuevosArchivos.length} archivos nuevos al proyector`);
}

// Toggle pantalla completa
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error al entrar en pantalla completa:', err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Manejar cambios de pantalla completa
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreen-btn');
    if (document.fullscreenElement) {
        btn.textContent = '⛶ Salir de Pantalla Completa';
    } else {
        btn.textContent = '⛶ Pantalla Completa';
    }
});

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarProyector);
} else {
    inicializarProyector();
}

// Limpiar timers al cerrar la página
window.addEventListener('beforeunload', () => {
    if (timerFotos) clearTimeout(timerFotos);
    if (timerPolling) clearInterval(timerPolling);
});