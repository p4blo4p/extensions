// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/Magic/Cards/*
// @match       https://www.cardmarket.com/*/Magic/*/*/*
// @grant       none
// @version     1.42
// @description Ensures sell-count elements are visible and styled appropriately.
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('Script started');

    function modifySellCountElements() {
        const elements = document.querySelectorAll('.sell-count');
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
                    }
                    element.style.width = 'auto';
                    element.classList.add('modified'); // Mark the element as modified
                }
            } catch (error) {
                console.error('Error processing element:', error);
            }
        });
    }
    
    function checkAndModifySellCountElements() {
        const elements = document.querySelectorAll('.sell-count');
        if (elements.length > 0) {
            console.log('Elements found, modifying...');
            modifySellCountElements();
        } else {
            console.log('Elements not found, checking again in 1 second...');
            setTimeout(checkAndModifySellCountElements, 1000); // Check again after 1 second
        }
    }
    
    checkAndModifySellCountElements(); // Initial check
})();
