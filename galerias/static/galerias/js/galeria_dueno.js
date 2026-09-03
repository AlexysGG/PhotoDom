const PIN_CORRECTO = "{{ evento.pin_dueno }}"; // Inyectado desde el template
// Usamos la variable global pasada desde el HTML
let inputPin = "";

document.addEventListener("DOMContentLoaded", () => {
    // Si ya ingresó el PIN en la sesión actual
    if (sessionStorage.getItem(`pin_valido_${window.EVENTO_ID}`) === "true") {
        document.getElementById("pin-modal").classList.add("hidden");
    }
});

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
    // Compara contra window.PIN_CORRECTO
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