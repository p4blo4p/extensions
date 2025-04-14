// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant       none
// @version     1.50 // Incremented version
// @description Ensures sell-count elements are visible, styled, and handles dynamic loading.
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    const SELL_COUNT_SELECTOR = '.sell-count';
    // Usar una clase más específica para evitar conflictos
    const MODIFIED_CLASS = 'vm-sell-count-modified';
    const DEBUG = true; // Poner a false para reducir logs en producción

    function log(message, ...optionalParams) {
        if (DEBUG) {
            console.log(`[VM SellCount] ${message}`, ...optionalParams);
        }
    }

    function modifySingleElement(element) {
        // Comprobar si el elemento ya fue procesado o no es válido
        if (!element || element.classList.contains(MODIFIED_CLASS)) {
            return; // Saltar elemento
        }

        log('Processing element:', element);
        try {
            // 1. Hacer visible (quitar d-none)
            element.classList.remove('d-none');
            // Forzar visibilidad si 'd-none' no era la única razón
            if (window.getComputedStyle(element).display === 'none') {
                element.style.display = 'inline-block'; // O 'block', 'flex' según el contexto original
                log('Forced display style for element:', element);
            }

            // 2. Extraer datos del título y añadir el span
            const originalTitle = element.getAttribute('data-bs-original-title');
            log(`Element title attribute: "${originalTitle}"`);

            if (originalTitle) {
                // Regex para buscar "| numero" (con espacio opcional)
                const match = originalTitle.match(/\|\s*(\d+)/);

                if (match && match[1]) { // Asegurarse que el match y el grupo capturado existen
                    const numberStr = match[1];
                    const numberLength = numberStr.length;

                    // Crear o encontrar el span para el número añadido
                    let numberSpan = element.querySelector('.vm-appended-count');
                    if (!numberSpan) {
                        numberSpan = document.createElement('span');
                        numberSpan.className = 'vm-appended-count'; // Añadir clase al span
                        element.appendChild(numberSpan);
                    }

                    // Asignar texto y estilo
                    numberSpan.textContent = " | " + numberStr; // Usar textContent es más seguro
                    numberSpan.style.color = numberLength >= 5 ? 'lime'
                                             : numberLength === 4 ? 'orange'
                                             : 'gray'; // Gris por defecto (< 4 digitos)

                    log('Appended/Updated number span:', numberSpan.textContent, 'Color:', numberSpan.style.color);

                } else {
                    log('Regex did not match or capture group missing in title:', originalTitle);
                    // Opcional: limpiar span si existía y ahora no hay match?
                    const existingSpan = element.querySelector('.vm-appended-count');
                    if (existingSpan) existingSpan.remove();
                }
            } else {
                log('Element missing data-bs-original-title attribute.');
                 // Opcional: limpiar span si existía y ahora no hay atributo?
                 const existingSpan = element.querySelector('.vm-appended-count');
                 if (existingSpan) existingSpan.remove();
            }

            // 3. Ajustar ancho y marcar como modificado
            element.style.width = 'auto';
            element.classList.add(MODIFIED_CLASS); // Marcar como procesado
            log('Element modification complete.');

        } catch (error) {
            console.error('[VM SellCount] Error processing element:', element, error);
        }
    }

    function processAllVisibleSellCountElements() {
        // Seleccionar solo los que no han sido modificados aún
        const elements = document.querySelectorAll(SELL_COUNT_SELECTOR + ':not(.' + MODIFIED_CLASS + ')');
        if (elements.length > 0) {
             log(`Found ${elements.length} unprocessed elements. Processing...`);
             elements.forEach(modifySingleElement);
        }
    }

    // --- Lógica de Ejecución ---

    log('Script started. Setting up observer.');

    // 1. Observador para Cambios en el DOM (elementos añadidos/quitados)
    const observer = new MutationObserver((mutationsList) => {
        let relevantChangeDetected = false;
        for (const mutation of mutationsList) {
            // Comprobar si se añadieron nodos que son o contienen nuestro selector
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 for (const addedNode of mutation.addedNodes) {
                    // Asegurarse que es un Element Node antes de usar querySelector o matches
                    if (addedNode.nodeType === Node.ELEMENT_NODE) {
                        if (addedNode.matches(SELL_COUNT_SELECTOR) || addedNode.querySelector(SELL_COUNT_SELECTOR)) {
                            relevantChangeDetected = true;
                            break; // Salir del bucle de nodos añadidos
                        }
                    }
                 }
            }
             // Podrías añadir comprobación de 'attributes' si sospechas que data-bs-original-title cambia
             // if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-original-title') { ... }

            if (relevantChangeDetected) break; // Salir del bucle de mutaciones
        }

        // Si se detectó un cambio relevante, volver a procesar
        if (relevantChangeDetected) {
            log('Relevant DOM change detected. Re-scanning for elements.');
            // Usar requestAnimationFrame para procesar en el siguiente ciclo de renderizado,
            // ayuda a evitar procesar estados intermedios y agrupa ejecuciones.
            window.requestAnimationFrame(processAllVisibleSellCountElements);
            // Alternativa con debounce simple (si hay muchas mutaciones seguidas):
            // clearTimeout(observer.debounceTimeout);
            // observer.debounceTimeout = setTimeout(processAllVisibleSellCountElements, 100);
        }
    });

    // Observar el body para elementos añadidos/quitados en todo el subárbol
    observer.observe(document.body, {
        childList: true, // Observar adición/eliminación de nodos hijos
        subtree: true    // Observar en todo el árbol descendiente
        // attributes: true, // Descomentar si necesitas detectar cambios de atributos
        // attributeFilter: ['data-bs-original-title', 'class'] // Solo si 'attributes' es true
    });

    // 2. Ejecución Inicial
    // Dar un pequeño respiro antes de la ejecución inicial puede ayudar
    // a que el JS de la página termine su trabajo inicial.
    // setTimeout(processAllVisibleSellCountElements, 500); // Esperar 500ms
    // O usar requestAnimationFrame para ejecutar justo antes del siguiente repintado:
    window.requestAnimationFrame(() => {
        log('Initial scan for elements.');
        processAllVisibleSellCountElements();
    });

    log('Observer initialized and initial scan scheduled.');

})();
