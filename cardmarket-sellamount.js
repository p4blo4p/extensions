// ==UserScript==
// @name        New script cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/Magic/Cards/*
// @match       https://www.cardmarket.com/*/Magic/*/*/*
// @grant       none
// @version     1.2
// @author      -
// @description 13/2/2025, 17:21:18
// ==/UserScript==

(function() {
    'use strict';

    function modifySellCountElements() {
        const elements = document.querySelectorAll('.sell-count');
        elements.forEach(element => {
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
        });
    }

    const observer = new MutationObserver((mutations) => {
        if (document.querySelectorAll('.sell-count').length > 0) {
            modifySellCountElements();
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Remove the DOMContentLoaded event listener
    // window.addEventListener('DOMContentLoaded', modifySellCountElements);
})();
