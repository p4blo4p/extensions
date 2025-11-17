
// ==UserScript==
// @name         Cardmarket Price History Extractor
// @namespace    http://tampermonkey.net/
// @version      2.1
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
        /* Enhanced Stock Badges */
        .cm-stock-tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.85em;
            min-width: 32px;
            text-align: center;
            line-height: 1.2;
        }
        /* Force colors with !important to override Cardmarket defaults */
        .cm-stock-low { background-color: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fca5a5; }
        .cm-stock-med { background-color: #ffedd5 !important; color: #9a3412 !important; border: 1px solid #fdba74; }
        .cm-stock-high { background-color: #dcfce7 !important; color: #166534 !important; border: 1px solid #86efac; }
        
        /* New Header/Tools Row */
        .cm-tools-row {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 8px 12px;
            background-color: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 4px;
        }
        
        .cm-sort-btn {
            cursor: pointer;
            background: white;
            border: 1px solid #cbd5e1;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.2s;
            user-select: none;
        }
        .cm-sort-btn:hover {
            background: #f1f5f9;
            color: #0f172a;
            border-color: #94a3b8;
        }
        .cm-sort-btn:active {
            transform: translateY(1px);
        }
    `);

    // --- HELPERS ---
    const parsePrice = (str) => {
        if (!str) return 0;
        const clean = str.replace(/[^0-9,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const getText = (el) => el ? el.innerText.trim() : '';

    // --- TABLE ENHANCEMENT ---
    const enhanceTable = () => {
        const container = document.querySelector('.table-body');
        if (!container) return;

        // 1. Inject Custom Header/Sort Bar as the FIRST row
        if (!document.querySelector('.cm-tools-row')) {
            const toolsRow = document.createElement('div');
            toolsRow.className = 'cm-tools-row';
            // We use window.cmSortRows which we define below
            toolsRow.innerHTML = `
                <div class="cm-sort-btn" onclick="window.cmSortRows()">
                    <span>Sort by Stock</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="m17 20v-11"/><path d="m3 8 4-4 4 4"/><path d="m7 4v11"/></svg>
                </div>
            `;
            // Insert at the very top of the table body
            container.insertBefore(toolsRow, container.firstChild);
        }

        // 2. Format Stock Cells
        const rows = document.querySelectorAll('.table-body div[id^="productRow"]');
        rows.forEach(row => {
            const cell = row.querySelector('.col-availability');
            if (!cell) return;
            
            // Prevent double formatting
            if(cell.querySelector('.cm-stock-tag')) return;

            // Get clean number
            const rawText = cell.textContent || '0';
            const count = parseInt(rawText.replace(/[^0-9]/g, '')) || 0;
            
            let colorClass = 'cm-stock-high';
            if (count < 10) colorClass = 'cm-stock-low';
            else if (count < 50) colorClass = 'cm-stock-med';

            // Use a badge-style span
            cell.innerHTML = `<span class="cm-stock-tag ${colorClass}">${count}</span>`;
            
            // Store raw value for sorting
            cell.setAttribute('data-stock', count);
            
            // Ensure cell is visible and centered
            cell.classList.remove('d-none');
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
        });
    };

    // --- SORT FUNCTION ---
    // Attached to window so the injected HTML onclick can find it
    window.cmSortRows = () => {
        const container = document.querySelector('.table-body');
        if(!container) return;
        
        const rows = Array.from(document.querySelectorAll('div[id^="productRow"]'));
        
        // Toggle Sort Direction
        const currentSort = container.getAttribute('data-sort-dir') || 'desc';
        const newSort = currentSort === 'desc' ? 'asc' : 'desc';
        container.setAttribute('data-sort-dir', newSort);
        
        // Sort Logic
        rows.sort((a, b) => {
            const valA = parseInt(a.querySelector('.col-availability')?.getAttribute('data-stock') || '0');
            const valB = parseInt(b.querySelector('.col-availability')?.getAttribute('data-stock') || '0');
            return newSort === 'asc' ? valA - valB : valB - valA;
        });
        
        // Re-append rows (this moves them to the end, keeping the header at top)
        rows.forEach(row => container.appendChild(row));
        
        // Update Button Text
        const btnText = document.querySelector('.cm-sort-btn span');
        if(btnText) btnText.innerText = `Stock (${newSort === 'asc' ? 'Low' : 'High'})`;
    };

    // --- EXTRACTION LOGIC ---
    const extractData = () => {
        const rows = document.querySelectorAll('.table-body div[id^="productRow"]');
        const currentData = [];
        const timestamp = new Date().toISOString();

        rows.forEach(row => {
            try {
                const id = row.id.replace('productRow', '');
                
                const nameEl = row.querySelector('.col-10 .d-flex a') || row.querySelector('.col-10 a');
                const name = getText(nameEl);
                const link = nameEl ? nameEl.href : '';
                
                const expansionEl = row.querySelector('.col-icon.small a');
                const expansion = expansionEl ? expansionEl.getAttribute('aria-label') : 'Unknown';
                
                const numberEl = row.querySelector('.col-md-2 div');
                const number = getText(numberEl);
                
                const rarityEl = row.querySelector('.col-sm-2 svg');
                const rarity = rarityEl ? rarityEl.getAttribute('aria-label') : 'Unknown';
                
                const availEl = row.querySelector('.col-availability');
                // Support both our new badge and original text
                const availability = parseInt(getText(availEl).replace(/[^0-9]/g, '')) || 0;
                
                const priceEl = row.querySelector('.col-price');
                const price = parsePrice(getText(priceEl));

                const imgIcon = row.querySelector('.thumbnail-icon');
                let image = '';
                if (imgIcon) {
                    const tooltipContent = imgIcon.getAttribute('data-bs-title') || imgIcon.getAttribute('data-original-title') || '';
                    const urlMatch = tooltipContent.match(/src=['"]?([^'"\s>]+)['"]?/); 
                    const entityMatch = tooltipContent.match(/src=&quot;(.*?)&quot;/);
                    if (entityMatch && entityMatch[1]) image = entityMatch[1];
                    else if (urlMatch && urlMatch[1]) image = urlMatch[1];
                }

                currentData.push({ id, name, expansion, number, rarity, availability, price, timestamp, link, image });
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
            localStorage.setItem(getAutoRunKey(), new Date().toDateString());
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
            item.timestamp, item.id,
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.expansion || '').replace(/"/g, '""')}"`,
            item.number, item.rarity, item.availability, item.price,
            `"${(item.link || '')}"`, `"${(item.image || '')}"`
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cardmarket_history.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearHistory = () => {
        if(confirm('Clear all price history?')) {
            localStorage.removeItem(STORAGE_KEY);
            Object.keys(localStorage).forEach(k => { if(k.startsWith('cm_last_auto_run_')) localStorage.removeItem(k); });
            alert('History cleared.');
        }
    };

    // --- UI CREATION ---
    const createUI = () => {
        const container = document.createElement('div');
        container.id = 'cm-tracker-ui';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; font-family: sans-serif; font-size: 13px; overflow: hidden; width: 200px;';
        
        let isMinimized = false;
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; cursor: move; user-select: none;';
        header.innerHTML = '<span>📊 <b>CM Tracker</b></span>';
        
        const minBtn = document.createElement('div');
        minBtn.innerText = '_';
        minBtn.style.cssText = 'cursor: pointer; font-weight: bold; padding: 0 4px; color: #64748b;';
        header.appendChild(minBtn);
        container.appendChild(header);

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
        content.appendChild(createBtn('📥 Capture Data', '#3b82f6', () => saveData(extractData())));
        content.appendChild(createBtn('💾 Export CSV', '#10b981', downloadCSV));
        content.appendChild(createBtn('🗑️ Reset', '#ef4444', clearHistory));

        container.appendChild(content);
        document.body.appendChild(container);

        minBtn.onclick = (e) => {
            e.stopPropagation();
            isMinimized = !isMinimized;
            content.style.display = isMinimized ? 'none' : 'flex';
            header.style.borderBottom = isMinimized ? 'none' : '1px solid #e5e7eb';
            minBtn.innerText = isMinimized ? '□' : '_';
        };
        
        // Draggable logic
        let isDragging = false, offset = { x: 0, y: 0 };
        header.onmousedown = (e) => {
            if (e.target === minBtn) return;
            isDragging = true;
            const rect = container.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
            container.style.left = rect.left + 'px';
            container.style.top = rect.top + 'px';
            container.style.bottom = 'auto';
            container.style.right = 'auto';
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
        enhanceTable();
        checkAutoCapture();
    }, 1500);
})();
