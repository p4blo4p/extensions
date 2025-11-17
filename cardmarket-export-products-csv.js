
// ==UserScript==
// @name         Cardmarket Price History Extractor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Extract data, store history, export CSV, and enhance Cardmarket UI with Sortable Stock
// @author       You
// @match        https://www.cardmarket.com/*/*/Products/*
// @grant        none
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'cm_price_history_v1';
    
    // Helper to generate a unique key for the current page view
    const getAutoRunKey = () => {
        const key = window.location.pathname + window.location.search;
        return 'cm_last_auto_run_' + key;
    };

    // --- CSS INJECTION ---
    const addGlobalStyle = (css) => {
        const head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    };

    addGlobalStyle(`
        /* Enhanced Stock Column Styles */
        .cm-stock-cell { 
            font-weight: 700; 
            text-align: center; 
            display: block;
            width: 100%;
        }
        .cm-stock-low { color: #dc2626; } /* Red */
        .cm-stock-med { color: #ea580c; } /* Orange */
        .cm-stock-high { color: #16a34a; } /* Green */
        
        .cm-sort-header { 
            cursor: pointer; 
            color: #2563eb; 
            text-decoration: underline; 
            font-size: 0.85rem;
            user-select: none;
        }
        .cm-sort-header:hover { color: #1d4ed8; }
    `);

    // --- HELPERS ---
    const parsePrice = (str) => {
        if (!str) return 0;
        const clean = str.replace(/[^0-9,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const getText = (el) => el ? el.innerText.trim() : '';

    // --- TABLE ENHANCEMENT (SORTING & COLORS) ---
    const enhanceTable = () => {
        // 1. Fix Headers
        // Try to find the availability header. In product lists, it is often the last small column or has class col-availability
        const headers = document.querySelectorAll('.table-body > .row:first-child .col-availability, .table-body > .d-none .col-availability');
        headers.forEach(header => {
             // Replace icon with clickable text
             header.innerHTML = '<span class="cm-sort-header" title="Click to Sort">Stock ↕</span>';
             header.onclick = sortRows;
             // Ensure it is visible if it was hidden
             header.classList.remove('d-none');
             header.style.display = 'flex'; 
             header.style.justifyContent = 'center';
        });

        // 2. Fix Rows
        const rows = document.querySelectorAll('.table-body div[id^="productRow"]');
        rows.forEach(row => {
            const cell = row.querySelector('.col-availability');
            if (!cell) return;
            
            // Get number (it might be hidden in a span or just text)
            const text = cell.textContent || '0';
            const count = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            
            let colorClass = 'cm-stock-high';
            if (count < 10) colorClass = 'cm-stock-low';
            else if (count < 50) colorClass = 'cm-stock-med';

            // Replace content with clean number
            cell.innerHTML = `<span class="cm-stock-cell ${colorClass}">${count}</span>`;
            
            // Store raw value for sorting
            cell.setAttribute('data-stock', count);
            
            // Layout fixes
            cell.classList.remove('d-none');
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
        });
    };

    const sortRows = () => {
        const container = document.querySelector('.table-body');
        if(!container) return;
        
        const rows = Array.from(document.querySelectorAll('div[id^="productRow"]'));
        
        // Toggle sort direction
        const currentSort = container.getAttribute('data-sort-dir') || 'desc';
        const newSort = currentSort === 'desc' ? 'asc' : 'desc';
        container.setAttribute('data-sort-dir', newSort);
        
        // Sort logic
        rows.sort((a, b) => {
            const valA = parseInt(a.querySelector('.col-availability')?.getAttribute('data-stock') || '0');
            const valB = parseInt(b.querySelector('.col-availability')?.getAttribute('data-stock') || '0');
            return newSort === 'asc' ? valA - valB : valB - valA;
        });
        
        // Re-append to container to reorder visual position
        rows.forEach(row => container.appendChild(row));
        
        // Feedback
        const toast = document.createElement('div');
        toast.innerText = `Sorted by Stock (${newSort})`;
        toast.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 10px 20px; border-radius: 8px; z-index: 10000; pointer-events: none; transition: opacity 0.5s;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 800);
    };

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
                const availEl = row.querySelector('.col-availability');
                // We read from innerText which now contains our clean number
                const availability = parseInt(getText(availEl).replace(/[^0-9]/g, '')) || 0;
                
                // Price
                const priceEl = row.querySelector('.col-price');
                const price = parsePrice(getText(priceEl));

                // Image
                const imgIcon = row.querySelector('.thumbnail-icon');
                let image = '';
                if (imgIcon) {
                    const tooltipContent = imgIcon.getAttribute('data-bs-title') || imgIcon.getAttribute('data-original-title') || '';
                    const urlMatch = tooltipContent.match(/src=['"]?([^'"\s>]+)['"]?/); 
                    const entityMatch = tooltipContent.match(/src=&quot;(.*?)&quot;/);
                    
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
            const today = new Date().toDateString();
            localStorage.setItem(getAutoRunKey(), today);
        } else {
            console.log(`[CM Tracker] Auto-captured ${newData.length} items.`);
        }
    };

    // --- AUTO CAPTURE ---
    const checkAutoCapture = () => {
        const today = new Date().toDateString(); 
        const key = getAutoRunKey();
        const lastRun = localStorage.getItem(key);

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
        
        const headers = ['Timestamp', 'ID', 'Name', 'Expansion', 'Number', 'Rarity', 'Availability', 'Price', 'Link', 'Image'];
        
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
        container.id = 'cm-tracker-ui';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; overflow: hidden; width: 200px;';
        
        let isMinimized = false;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;';
        
        const title = document.createElement('div');
        title.innerHTML = '📊 <b>CM Tracker</b>';
        title.style.pointerEvents = 'none';
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';

        const minBtn = document.createElement('div');
        minBtn.innerText = '_';
        minBtn.style.cssText = 'cursor: pointer; font-weight: bold; padding: 0 4px; color: #64748b;';
        
        controls.appendChild(minBtn);
        header.appendChild(title);
        header.appendChild(controls);
        container.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #fff;';

        const createBtn = (label, color, onClick) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.cssText = `padding: 8px 12px; border: none; border-radius: 4px; background: ${color}; color: white; font-weight: 600; cursor: pointer;`;
            btn.onclick = onClick;
            return btn;
        };

        content.appendChild(createBtn('Refine Table & Sort', '#8b5cf6', enhanceTable));
        content.appendChild(createBtn('📥 Capture Data', '#3b82f6', () => {
            const data = extractData();
            saveData(data);
        }));
        content.appendChild(createBtn('💾 Export CSV', '#10b981', downloadCSV));
        content.appendChild(createBtn('🗑️ Reset', '#ef4444', clearHistory));

        container.appendChild(content);
        document.body.appendChild(container);

        // Minimize Logic
        minBtn.onclick = (e) => {
            e.stopPropagation();
            isMinimized = !isMinimized;
            if (isMinimized) {
                content.style.display = 'none';
                header.style.borderBottom = 'none';
                minBtn.innerText = '□';
            } else {
                content.style.display = 'flex';
                header.style.borderBottom = '1px solid #e5e7eb';
                minBtn.innerText = '_';
            }
        };
        
        // Draggable Logic
        let isDragging = false;
        let offset = { x: 0, y: 0 };
        header.onmousedown = (e) => {
            if (e.target === minBtn) return;
            isDragging = true;
            const rect = container.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = rect.left + 'px';
            container.style.top = rect.top + 'px';
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            container.style.left = (e.clientX - offset.x) + 'px';
            container.style.top = (e.clientY - offset.y) + 'px';
        };
        document.onmouseup = () => { isDragging = false; };
    };

    // Initialize
    setTimeout(() => {
        createUI();
        enhanceTable(); // Auto-enhance on load
        checkAutoCapture();
    }, 1500);
})();
