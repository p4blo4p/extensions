// ==UserScript==
// @name        New script cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/Magic/Cards/*
// @match       https://www.cardmarket.com/*/Magic/*/*/*
// @grant       none
// @version     1.3
// @description Ensures sell-count elements are visible and styled appropriately.
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    function modifySellCountElements() {
        const elements = document.querySelectorAll('.sell-count');
        elements.forEach(element => {
            if (!element.classList.contains('modified')) {
                element.classList.remove('d-none');
                const newText = element.getAttribute('data-bs-original-title');
                if (newText) {
                    const textToAppend = newText.match(/\|\s*(\d+)/);
                    if (textToAppend) {
                        const newSpan = document.createElement('span');
                        newSpan.textContent = "  | " + textToAppend[1];
                        const numberLength = textToAppend[1].length;
                        newSpan.style.color = numberLength >= 5 ? 'lime' : numberLength === 4 ? 'orange' : 'gray';
                        element.appendChild(newSpan);
                    }
                }
                element.style.width = 'auto';
                element.classList.add('modified'); // Mark the element as modified
            }
        });
    }

    function checkAndModifySellCountElements() {
        if (document.querySelectorAll('.sell-count').length > 0) {
            modifySellCountElements();
        } else {
            setTimeout(checkAndModifySellCountElements, 1000); // Check again after 1 second
        }
    }

    checkAndModifySellCountElements(); // Initial check
})();
