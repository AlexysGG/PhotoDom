document.addEventListener('DOMContentLoaded', function() {
            const planSelector = document.getElementById('plan-selector');
            const camposExperienciaPremium = document.getElementById('campos-experiencia-premium');
            const camposPremium = document.getElementById('campos-premium');
            const horasExtraInput = document.getElementById('horas-extra');

            // Precios base según el plan
            const preciosBase = {
                5000: 500,   // Esencial
                10000: 900,  // Experiencia
                15000: 1500  // Premium
            };

            function actualizarCamposSegunPlan() {
                const planSeleccionado = parseInt(planSelector.value);

                // Mostrar campos de Experiencia y Premium (marcos, fondo) para planes >= 10000
                if (planSeleccionado >= 10000) {
                    camposExperienciaPremium.classList.add('visible');
                } else {
                    camposExperienciaPremium.classList.remove('visible');
                }

                // Mostrar campos de Premium (mensaje bienvenida) solo para plan >= 15000
                if (planSeleccionado >= 15000) {
                    camposPremium.classList.add('visible');
                } else {
                    camposPremium.classList.remove('visible');
                }

                // Actualizar cotización
                actualizarCotizacion();
            }

            function actualizarCotizacion() {
                const planSeleccionado = parseInt(planSelector.value);
                const horasExtra = parseInt(horasExtraInput.value) || 0;

                const precioBase = preciosBase[planSeleccionado] || 500;
                const costoHorasExtra = horasExtra * 100;
                const costoTotal = precioBase + costoHorasExtra;

                document.getElementById('precio-base').textContent = `$${precioBase} MXN`;
                document.getElementById('costo-horas-extra').textContent = `$${costoHorasExtra} MXN`;
                document.getElementById('costo-total').textContent = `$${costoTotal} MXN`;
            }

            // Inicializar al cargar
            actualizarCamposSegunPlan();

            // Actualizar cuando cambia el plan
            planSelector.addEventListener('change', actualizarCamposSegunPlan);

            // Actualizar cuando cambian las horas extra
            horasExtraInput.addEventListener('input', actualizarCotizacion);
        });