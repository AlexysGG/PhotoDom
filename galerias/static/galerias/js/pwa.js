/**
 * PhotoDom - PWA Helper & Service Worker Registration
 */

(function () {
    'use strict';

    // 1. Registro del Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then(function (registration) {
                    console.log(' PhotoDom PWA: Service Worker activo con scope:', registration.scope);

                    // Detectar si hay una nueva versión del Service Worker disponible
                    registration.addEventListener('updatefound', function () {
                        const newWorker = registration.installing;
                        if (!newWorker) return;

                        newWorker.addEventListener('statechange', function () {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log(' PhotoDom PWA: Nueva versión disponible.');
                            }
                        });
                    });
                })
                .catch(function (error) {
                    console.warn(' PhotoDom PWA: No se pudo registrar el Service Worker:', error);
                });
        });
    }

    // 2. Manejo de instalación PWA (beforeinstallprompt)
    let deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', function (event) {
        // Prevenir el prompt automático por defecto para controlarlo
        event.preventDefault();
        deferredInstallPrompt = event;

        // Mostrar botones de instalación si existen en la página
        const installButtons = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn');
        installButtons.forEach(function (btn) {
            btn.classList.remove('hidden');
            btn.style.display = 'inline-flex';
            btn.removeAttribute('hidden');
        });
    });

    // Función para invocar el diálogo de instalación
    window.instalarPhotoDomPWA = async function () {
        if (!deferredInstallPrompt) {
            return;
        }

        try {
            deferredInstallPrompt.prompt();
            const choiceResult = await deferredInstallPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log(' PhotoDom PWA: El usuario aceptó la instalación.');
            } else {
                console.log(' PhotoDom PWA: El usuario rechazó la instalación.');
            }
        } catch (err) {
            console.error('Error al solicitar instalación PWA:', err);
        } finally {
            deferredInstallPrompt = null;
            const installButtons = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn');
            installButtons.forEach(function (btn) {
                btn.style.display = 'none';
            });
        }
    };

    // Vincular clic a cualquier botón de instalación
    document.addEventListener('DOMContentLoaded', function () {
        const installButtons = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn');
        installButtons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.instalarPhotoDomPWA();
            });
        });
    });

    // 3. Evento cuando la PWA se ha instalado con éxito
    window.addEventListener('appinstalled', function () {
        console.log(' ¡PhotoDom fue instalada exitosamente como PWA!');
        deferredInstallPrompt = null;
        const installButtons = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn');
        installButtons.forEach(function (btn) {
            btn.style.display = 'none';
        });
    });

    // 4. Notificaciones sutiles de conexión (Online / Offline)
    function mostrarAvisoConexion(mensaje, esError) {
        let toast = document.getElementById('pwa-connection-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pwa-connection-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.zIndex = '99999';
            toast.style.padding = '12px 18px';
            toast.style.borderRadius = '999px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '600';
            toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            toast.style.transition = 'all 0.3s ease';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '8px';
            document.body.appendChild(toast);
        }

        toast.style.background = esError ? '#ef4444' : '#10b981';
        toast.style.color = '#ffffff';
        toast.innerHTML = (esError ? '⚠️ ' : '✅ ') + mensaje;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(function () {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
            }
        }, 3500);
    }

    window.addEventListener('online', function () {
        mostrarAvisoConexion('Conexión a internet restablecida', false);
    });

    window.addEventListener('offline', function () {
        mostrarAvisoConexion('Sin conexión a internet (Modo sin conexión)', true);
    });
})();
