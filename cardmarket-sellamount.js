// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant       none
// @version     1.49
// @description Ensures sell-count elements are visible and styled appropriately.
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script started');

    const SELL_COUNT_SELECTOR = '.sell-count';

    function modifySellCountElements() {
        const elements = document.querySelectorAll(SELL_COUNT_SELECTOR);
        console.log('Found elements:', elements.length);

        elements.forEach(element => {
            try {
                if (!element.classList.contains('modified')) {
                    console.log('Modifying element:', element);

                    // Eliminar la clase d-none
                    element.classList.remove('d-none');

                    // Obtener el texto del atributo data-bs-original-title
                    const newText = element.getAttribute('data-bs-original-title');
                    console.log('Attribute data-bs-original-title:', newText);

                    if (newText) {
                        const textToAppend = newText.match(/\|\s*(\d+)/);
                        if (textToAppend) {
                            const newSpan = document.createElement('span');
                            newSpan.textContent = "  | " + textToAppend[1];
                            const numberLength = textToAppend[1].length;

                            // Cambiar el color del texto según la longitud del número
                            newSpan.style.color = numberLength >= 5
                                ? 'lime'
                                : numberLength === 4
                                ? 'orange'
                                : 'gray';

                            element.appendChild(newSpan);
                            console.log('Appended new span:', newSpan.textContent);
                        } else {
                            console.warn('Regex did not match:', newText);
                        }
                    } else {
                        console.warn('Element missing data-bs-original-title attribute:', element);
                    }

                    // Ajustar el ancho y marcar como modificado
                    element.style.width = 'auto';
                    element.classList.add('modified'); // Marcar el elemento como modificado
                    console.log('Element modified:', element);
                } else {
                    console.log('Element already modified:', element);
                }
            } catch (error) {
                console.error('Error processing element:', error);
            }
        });
    }

    // Usar MutationObserver para detectar cambios en el DOM
    const observer = new MutationObserver(() => {
        const elements = document.querySelectorAll(SELL_COUNT_SELECTOR);
        if (elements.length > 0) {
            console.log('Elements found, modifying...');
            modifySellCountElements();
        }
    });

    // Configuración del observador
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('MutationObserver initialized');
})();