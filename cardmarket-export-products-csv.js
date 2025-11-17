
// ==UserScript==
// @name         Cardmarket Price History Extractor
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Extract data, store history, and export CSV from Cardmarket
// @author       You
// @match        https://www.cardmarket.com/*/*/Products/*
// @grant        none
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'cm_price_history_v1';
    
    // Helper to generate a unique key for the current page view
    // This ensures we track daily captures per specific URL (including filters/pages)
    const getAutoRunKey = () => {
        // We use pathname + search to distinguish between different filters/pages
        // e.g., /Magic/Products/Singles?idExpansion=123 vs /Magic/Products/Singles?site=2
        const key = window.location.pathname + window.location.search;
        return 'cm_last_auto_run_' + key;
    };

    // --- CSS INJECTION FOR MOBILE VISIBILITY ---
    const addGlobalStyle = (css) => {
        const head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    };

    // Force availability count to be visible on mobile
    // We override the bootstrap 'd-none' classes specifically for the availability column
    addGlobalStyle(`
        .col-availability span.d-none { display: inline !important; }
        .col-availability span { display: inline !important; }
        
        /* Adjust font size and layout on mobile to fit the extra data */
        @media (max-width: 768px) {
            .col-availability { 
                font-size: 0.75rem; 
                display: flex !important;
                align-items: center;
                justify-content: flex-end;
            }
        }
    `);

    // --- HELPERS ---
    const parsePrice = (str) => {
        if (!str) return 0;
        const clean = str.replace(/[^0-9,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const getText = (el) => el ? el.innerText.trim() : '';

    // --- EXTRACTION LOGIC ---
    const extractData = () => {
        const rows = document.querySelectorAll('.table-body div[id^="productRow"]');
        const currentData = [];
        const timestamp = new Date().toISOString();

        rows.forEach(row => {
            try {
                const id = row.id.replace('productRow', '');
                
                // Name & Link
                const nameEl = row.querySelector('.col-10 .d-flex a') || row.querySelector('.col-10 a');
                const name = getText(nameEl);
                const link = nameEl ? nameEl.href : '';
                
                // Expansion
                const expansionEl = row.querySelector('.col-icon.small a');
                const expansion = expansionEl ? expansionEl.getAttribute('aria-label') : 'Unknown';
                
                // Number
                const numberEl = row.querySelector('.col-md-2 div');
                const number = getText(numberEl);
                
                // Rarity
                const rarityEl = row.querySelector('.col-sm-2 svg');
                const rarity = rarityEl ? rarityEl.getAttribute('aria-label') : 'Unknown';
                
                // Availability
                // On mobile/desktop Cardmarket uses different spans, sometimes hidden.
                // We grab text from the whole container or visible spans.
                const availEl = row.querySelector('.col-availability');
                const availability = parseInt(availEl ? availEl.innerText.replace(/[^0-9]/g, '') : '0') || 0;
                
                // Price
                const priceEl = row.querySelector('.col-price');
                const price = parsePrice(getText(priceEl));

                // Image
                // Images are often inside a tooltip in data-bs-title or data-original-title.
                // The content is HTML escaped: <img src=&quot;...&quot;>
                const imgIcon = row.querySelector('.thumbnail-icon');
                let image = '';
                if (imgIcon) {
                    const tooltipContent = imgIcon.getAttribute('data-bs-title') || imgIcon.getAttribute('data-original-title') || '';
                    // Match src=&quot;URL&quot; or src="URL"
                    const match = tooltipContent.match(/src=[\"|&quot;]*(.*?)[\"|&quot;]*/);
                    // Simple regex check to grab the url between potential quotes/entities
                    const urlMatch = tooltipContent.match(/src=['"]?([^'"s>]+)['"]?/); // Standard HTML
                    const entityMatch = tooltipContent.match(/src=&quot;(.*?)&quot;/); // Escaped HTML
                    
                    if (entityMatch && entityMatch[1]) {
                        image = entityMatch[1];
                    } else if (urlMatch && urlMatch[1]) {
                        image = urlMatch[1];
                    }
                }

                currentData.push({
                    id,
                    name,
                    expansion,
                    number,
                    rarity,
                    availability,
                    price,
                    timestamp,
                    link,
                    image
                });
            } catch (e) {
                console.error('Error parsing row', e);
            }
        });
        return currentData;
    };

    const saveData = (newData, isAuto = false) => {
        const existingStoreStr = localStorage.getItem(STORAGE_KEY);
        let store = existingStoreStr ? JSON.parse(existingStoreStr) : { history: [] };
        
        store.history.push(...newData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        
        if (!isAuto) {
            alert(`Captured ${newData.length} items. Total history: ${store.history.length}.`);
            // Update the auto-run key manually so we don't auto-capture again today for this URL
            const today = new Date().toDateString();
            localStorage.setItem(getAutoRunKey(), today);
        } else {
            console.log(`[CM Tracker] Auto-captured ${newData.length} items.`);
            const toast = document.createElement('div');
            toast.innerText = `✅ Auto-captured ${newData.length} prices`;
            toast.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #4ade80; color: #064e3b; padding: 5px 10px; border-radius: 4px; z-index: 10000; font-size: 12px; opacity: 0.9; pointer-events: none;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    };

    // --- AUTO CAPTURE ---
    const checkAutoCapture = () => {
        const today = new Date().toDateString(); 
        const key = getAutoRunKey();
        const lastRun = localStorage.getItem(key);

        // If we haven't run for THIS specific URL today, do it.
        if (lastRun !== today) {
            const data = extractData();
            if (data.length > 0) {
                saveData(data, true);
                localStorage.setItem(key, today);
            }
        }
    };

    // --- CSV EXPORT ---
    const downloadCSV = () => {
        const existingStoreStr = localStorage.getItem(STORAGE_KEY);
        if (!existingStoreStr) {
            alert('No history found.');
            return;
        }
        const store = JSON.parse(existingStoreStr);
        
        // CSV Headers
        const headers = ['Timestamp', 'ID', 'Name', 'Expansion', 'Number', 'Rarity', 'Availability', 'Price', 'Link', 'Image'];
        
        // Map data to CSV rows
        const rows = store.history.map(item => [
            item.timestamp,
            item.id,
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.expansion || '').replace(/"/g, '""')}"`,
            item.number,
            item.rarity,
            item.availability,
            item.price,
            `"${(item.link || '')}"`,
            `"${(item.image || '')}"`
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'cardmarket_history.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearHistory = () => {
        if(confirm('Clear all price history?')) {
            localStorage.removeItem(STORAGE_KEY);
            // Also clear all auto-run keys to allow immediate re-capture
            Object.keys(localStorage).forEach(key => {
                if(key.startsWith('cm_last_auto_run_')) {
                    localStorage.removeItem(key);
                }
            });
            alert('History cleared.');
        }
    };

    // --- UI CREATION ---
    const createUI = () => {
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 5px; border: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';
        
        const title = document.createElement('div');
        title.innerText = 'CM Tracker v1.8';
        title.style.fontWeight = 'bold';
        title.style.textAlign = 'center';
        title.style.marginBottom = '5px';
        container.appendChild(title);

        const btnCapture = document.createElement('button');
        btnCapture.innerText = '📥 Capture Now';
        btnCapture.style.cssText = 'padding: 5px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 4px;';
        btnCapture.onclick = () => {
            const data = extractData();
            saveData(data);
        };
        container.appendChild(btnCapture);

        const btnDownload = document.createElement('button');
        btnDownload.innerText = '💾 CSV Export';
        btnDownload.style.cssText = 'padding: 5px; cursor: pointer; background: #10b981; color: white; border: none; border-radius: 4px;';
        btnDownload.onclick = downloadCSV;
        container.appendChild(btnDownload);

        const btnClear = document.createElement('button');
        btnClear.innerText = '🗑️ Reset';
        btnClear.style.cssText = 'padding: 5px; cursor: pointer; background: #ef4444; color: white; border: none; border-radius: 4px;';
        btnClear.onclick = clearHistory;
        container.appendChild(btnClear);

        document.body.appendChild(container);
    };

    // Initialize
    setTimeout(() => {
        createUI();
        checkAutoCapture();
    }, 1500);
})();
