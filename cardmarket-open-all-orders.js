// ==UserScript==
// @name        Cardmarket Bulk Order Opener
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/Magic/Orders/Received*
// @match       https://www.cardmarket.com/*/Magic/Sales/Sent*
// @grant       GM_openInTab
// @version     1.0
// @author      Cardmarket Power Tools
// @description Adds a button to open all order links in new tabs automatically.
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        // Find the location to insert the button
        // Usually, Cardmarket uses a div with class "table-responsive" or similar
        const targetContainer = document.querySelector('.table-responsive') || document.querySelector('main');
        if (!targetContainer || document.getElementById('bulk-order-opener-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'bulk-order-opener-btn';
        btn.innerHTML = '🚀 Abrir todos los pedidos';
        
        // Match Cardmarket's primary button style
        btn.className = 'btn btn-primary mb-3 mr-2';
        btn.style.fontWeight = 'bold';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

        btn.onclick = (e) => {
            e.preventDefault();
            // Select all links that point to an order detail page
            // Adjust the selector based on the specific page structure if needed
            const orderLinks = Array.from(document.querySelectorAll('a[href*="/Order/"]'));
            
            // Filter to get unique IDs to avoid opening the same order multiple times (if multiple links exist per row)
            const uniqueHrefs = [...new Set(orderLinks.map(a => a.href))];

            if (uniqueHrefs.length === 0) {
                alert('No orders found on this page!');
                return;
            }

            if (confirm(`Open ${uniqueHrefs.length} orders in new tabs?`)) {
                uniqueHrefs.forEach(href => {
                    GM_openInTab(href, { active: false, insert: true });
                });
            }
        };

        // Insert at the top of the table or main area
        targetContainer.parentNode.insertBefore(btn, targetContainer);
    }

    // Run on load and whenever the content changes (for AJAX pagination if applicable)
    window.addEventListener('load', init);
    
    // Fallback for dynamic content loading
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bulk-order-opener-btn')) {
            init();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
