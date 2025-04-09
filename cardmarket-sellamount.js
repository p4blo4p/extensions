// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant       none
// @version     1.48
// @description Ensures sell-count elements are visible and styled appropriately.
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script started');

    // Definir selectores como constantes
    const SELL_COUNT_SELECTOR = '.sell-count';

    function modifySellCountElements() {
        const elements = document.querySelectorAll(SELL_COUNT_SELECTOR);
        console.log('Found elements:', elements.length);

        elements.forEach(element => {
            try {
                if (!element.classList.contains('modified')) {
                    element.classList.remove('d-none');
                    const newText = element.getAttribute('data-bs-original-title');
                    console.log('Processing element:', newText);

                    if (newText) {
                        const textToAppend = newText.match(/\|\s*(\d+)/);
                        if (textToAppend) {
                            const newSpan = document.createElement('span');
                            newSpan.textContent = "  | " + textToAppend[1];
                            const numberLength = textToAppend[1].length;
                            newSpan.style.color = numberLength >= 5 ? 'lime' : numberLength === 4 ? 'orange' : 'gray';
                            element.appendChild(newSpan);
                        }
                    } else {
                        console.warn('Element missing data-bs-original-title attribute:', element);
                    }
                    element.style.width = 'auto';
                    element.classList.add('modified'); // Marcar el elemento como modificado
                }
            } catch (error) {
                console.error('Error processing element:', error);
            }
        });
    }

    // Usar MutationObserver para observar cambios en el DOM
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