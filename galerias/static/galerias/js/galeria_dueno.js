// Variable global leída desde el HTML (sin sintaxis de Django Jinja)
let inputPin = "";
let archivosGaleria = [];
let indiceActual = 0;
let idFotoAEliminar = null;

// Inicialización de datos al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificación de PIN en la sesión
    if (sessionStorage.getItem(`pin_valido_${window.EVENTO_ID}`) === "true") {
        const modal = document.getElementById("pin-modal");
        if (modal) modal.classList.add("hidden");
    }

    // 2. Mapeo de la galería para el Carrusel
    const elementosMedia = document.querySelectorAll(".media-item");
    archivosGaleria = Array.from(elementosMedia).map(el => ({
        url: el.dataset.url,
        esVideo: el.dataset.esVideo === "true"
    }));
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

// --- DESCARGA DIRECTA (EVITA PESTAÑA DEL STORAGE) ---
async function descargarArchivoDirecto(url, nombreArchivo) {
    try {
        const respuesta = await fetch(url);
        const blob = await respuesta.blob();
        const urlBlob = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = nombreArchivo || 'archivo_galeria';
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlBlob);
    } catch (error) {
        window.open(url, '_blank');
    }
}

// --- LIGHTBOX / CARRUSEL ---
function abrirCarrusel(index) {
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

    if (indiceActual < 0) indiceActual = archivosGaleria.length - 1;
    if (indiceActual >= archivosGaleria.length) indiceActual = 0;

    actualizarVistaCarrusel();
}

function actualizarVistaCarrusel() {
    const item = archivosGaleria[indiceActual];
    if (!item) return;

    const imgEl = document.getElementById("carrusel-img");
    const videoEl = document.getElementById("carrusel-video");

    if (item.esVideo) {
        imgEl.classList.add("hidden");
        videoEl.src = item.url;
        videoEl.classList.remove("hidden");
    } else {
        videoEl.classList.add("hidden");
        imgEl.src = item.url;
        imgEl.classList.remove("hidden");
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

    fetch(`/eliminar-foto/${idFotoAEliminar}/`, {
        method: "POST",
        headers: {
            "X-CSRFToken": getCookie("csrftoken")
        }
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const card = document.getElementById(`item-card-${idFotoAEliminar}`);
                if (card) card.remove();
                cerrarModal();
            } else {
                alert(data.error || "No se pudo eliminar el archivo.");
            }
        })
        .catch(() => alert("Error al procesar la solicitud."));
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