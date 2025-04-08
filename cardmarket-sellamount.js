// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant       none
// @version     1.46
// @description Ensures sell-count elements are visible and styled appropriately.
// @run-at      document-end
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
                    const newText = element.getAttribute('title');
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
                    } else

