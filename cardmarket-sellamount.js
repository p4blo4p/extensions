// ==UserScript==
// @name        amountElements cardmarket.com
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant       none
// @version     1.51 // Incremented version
// @description Ensures sell-count elements are visible, styled, and handles dynamic loading.
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    const SELL_COUNT_SELECTOR = '.sell-count';
    const MODIFIED_CLASS = 'vm-sell-count-modified';
    const DEBUG = true; // Set to false for production to reduce logs

    function log(message, ...optionalParams) {
        if (DEBUG) {
            console.log(`[VM SellCount] ${message}`, ...optionalParams);
        }
    }

    function modifySingleElement(element) {
        // Check if the element is valid and not already processed
        if (!element || element.classList.contains(MODIFIED_CLASS)) {
            return; // Skip already processed elements
        }

        log('Processing element:', element);

        try {
            // Make the element visible
            element.classList.remove('d-none');
            if (window.getComputedStyle(element).display === 'none') {
                element.style.display = 'inline-block'; // Ensure visibility
                log('Forced display style for element:', element);
            }

            // Extract data from the title attribute
            const originalTitle = element.getAttribute('data-bs-original-title');
            if (!originalTitle) {
                log('Skipping element as it is missing the data-bs-original-title attribute.');
                return; // Exit early if the attribute is missing
            }

            log(`Element title attribute: "${originalTitle}"`);

            // Use regex to extract the sales count or other data
            const match = originalTitle.match(/\|\s*(\d+)/);
            if (match && match[1]) {
                const numberStr = match[1];
                const numberLength = numberStr.length;

                // Create or find the span for the appended number
                let numberSpan = element.querySelector('.vm-appended-count');
                if (!numberSpan) {
                    numberSpan = document.createElement('span');
                    numberSpan.className = 'vm-appended-count';
                    element.appendChild(numberSpan);
                }

                // Assign text and style
                numberSpan.textContent = " | " + numberStr;
                numberSpan.style.color = numberLength >= 5 ? 'lime'
                                         : numberLength === 4 ? 'orange'
                                         : 'gray'; // Default to gray for fewer than 4 digits

                log('Appended/Updated number span:', numberSpan.textContent, 'Color:', numberSpan.style.color);
            } else {
                log('Regex did not match or capture group missing in title:', originalTitle);

                // Optionally, remove existing span if no match
                const existingSpan = element.querySelector('.vm-appended-count');
                if (existingSpan) existingSpan.remove();
            }

            // Adjust width and mark as modified
            element.style.width = 'auto';
            element.classList.add(MODIFIED_CLASS); // Mark as processed
            log('Element modification complete.');
        } catch (error) {
            console.error('[VM SellCount] Error processing element:', element, error);
        }
    }

    function processAllVisibleSellCountElements() {
        // Select elements that are not yet processed
        const elements = document.querySelectorAll(SELL_COUNT_SELECTOR + ':not(.' + MODIFIED_CLASS + ')');
        if (elements.length > 0) {
            log(`Found ${elements.length} unprocessed elements. Processing...`);
            elements.forEach(modifySingleElement);
        }
    }

    // --- Execution Logic ---

    log('Script started. Setting up observer.');

    // Mutation observer for DOM changes
    const observer = new MutationObserver((mutationsList) => {
        let relevantChangeDetected = false;
        for (const mutation of mutationsList) {
            // Check if added nodes contain or are relevant elements
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType === Node.ELEMENT_NODE) {
                        if (addedNode.matches(SELL_COUNT_SELECTOR) || addedNode.querySelector(SELL_COUNT_SELECTOR)) {
                            relevantChangeDetected = true;
                            break; // Exit loop when relevant change is detected
                        }
                    }
                }
            }

            if (relevantChangeDetected) break;
        }

        // Re-scan elements if a relevant change was detected
        if (relevantChangeDetected) {
            log('Relevant DOM change detected. Re-scanning for elements.');
            window.requestAnimationFrame(processAllVisibleSellCountElements);
        }
    });

    // Observe the body for added/removed elements
    observer.observe(document.body, {
        childList: true, // Observe child node additions/removals
        subtree: true    // Observe the entire subtree
    });

    // Initial execution
    window.requestAnimationFrame(() => {
        log('Initial scan for elements.');
        processAllVisibleSellCountElements();
    });

    log('Observer initialized and initial scan scheduled.');

})();
