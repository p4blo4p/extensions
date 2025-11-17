
// ==UserScript==
// @name         Cardmarket Price History Extractor
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Extract data, store history, and export CSV from Cardmarket
// @author       You
// @match        https://www.cardmarket.com/*/*/Products/*
// @grant        none
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'cm_price_history_v1';

    // Helper to parse price string "0,03 €" -> 0.03
    const parsePrice = (str) => {
        if (!str) return 0;
        const clean = str.replace(/[^0-9,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    // Helper to get clean text
    const getText = (el) => el ? el.innerText.trim() : '';

    const extractData = () => {
        const rows = document.querySelectorAll('.table-body div[id^="productRow"]');
        const currentData = [];
        const timestamp = new Date().toISOString();

        rows.forEach(row => {
            try {
                const id = row.id.replace('productRow', '');
                const nameEl = row.querySelector('.col-10 .d-flex a') || row.querySelector('.col-10 a');
                const name = getText(nameEl);
                
                const expansionEl = row.querySelector('.col-icon.small a');
                const expansion = expansionEl ? expansionEl.getAttribute('aria-label') : 'Unknown';
                
                const numberEl = row.querySelector('.col-md-2 div');
                const number = getText(numberEl);
                
                const rarityEl = row.querySelector('.col-sm-2 svg');
                const rarity = rarityEl ? rarityEl.getAttribute('aria-label') : 'Unknown';
                
                const availEl = row.querySelector('.col-availability span');
                const availability = parseInt(getText(availEl)) || 0;
                
                const priceEl = row.querySelector('.col-price');
                const price = parsePrice(getText(priceEl));

                currentData.push({
                    id,
                    name,
                    expansion,
                    number,
                    rarity,
                    availability,
                    price,
                    timestamp
                });
            } catch (e) {
                console.error('Error parsing row', e);
            }
        });
        return currentData;
    };

    const saveData = (newData) => {
        const existingStoreStr = localStorage.getItem(STORAGE_KEY);
        let store = existingStoreStr ? JSON.parse(existingStoreStr) : { history: [] };
        
        // Append new data to history
        store.history.push(...newData);
        
        // Optional: Limit history size if needed, but for text data localStorage is usually fine for a while
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        
        alert(`Captured ${newData.length} items. Total history size: ${store.history.length} records.`);
    };

    const downloadCSV = () => {
        const existingStoreStr = localStorage.getItem(STORAGE_KEY);
        if (!existingStoreStr) {
            alert('No history found. Please click "Capture Prices" first.');
            return;
        }
        const store = JSON.parse(existingStoreStr);
        
        const headers = ['Timestamp', 'ID', 'Name', 'Expansion', 'Number', 'Rarity', 'Availability', 'Price'];
        const rows = store.history.map(item => [
            item.timestamp,
            item.id,
            `"${item.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
            `"${item.expansion.replace(/"/g, '""')}"`,
            item.number,
            item.rarity,
            item.availability,
            item.price
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
        if(confirm('Are you sure you want to clear all price history?')) {
            localStorage.removeItem(STORAGE_KEY);
            alert('History cleared.');
        }
    };

    // Create UI
    const createUI = () => {
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 5px; border: 1px solid #ccc;';
        
        const title = document.createElement('div');
        title.innerText = 'CM Tracker';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        title.style.textAlign = 'center';
        container.appendChild(title);

        const btnCapture = document.createElement('button');
        btnCapture.innerText = '📥 Capture Current';
        btnCapture.style.cssText = 'padding: 5px 10px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 4px;';
        btnCapture.onclick = () => {
            const data = extractData();
            saveData(data);
        };
        container.appendChild(btnCapture);

        const btnDownload = document.createElement('button');
        btnDownload.innerText = '💾 Download CSV';
        btnDownload.style.cssText = 'padding: 5px 10px; cursor: pointer; background: #10b981; color: white; border: none; border-radius: 4px;';
        btnDownload.onclick = downloadCSV;
        container.appendChild(btnDownload);

        const btnClear = document.createElement('button');
        btnClear.innerText = '🗑️ Clear History';
        btnClear.style.cssText = 'padding: 5px 10px; cursor: pointer; background: #ef4444; color: white; border: none; border-radius: 4px; font-size: 10px;';
        btnClear.onclick = clearHistory;
        container.appendChild(btnClear);

        document.body.appendChild(container);
    };

    // Initialize
    setTimeout(createUI, 2000); // Wait for dynamic content if any
})();
