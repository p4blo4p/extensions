// ==UserScript==
// @name         Cardmarket Order Exporter (Auto-Run)
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Exporta detalles de pedido. Si detecta autoexport=true, descarga el CSV automáticamente al cargar.
// @author       Cardmarket Power Tools
// @match        https://www.cardmarket.com/*/*/Orders/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_info
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = GM_info.script.version;

    GM_addStyle(`
        .export-csv-button {
            background-color: #4CAF50; border: none; color: white; padding: 10px 20px;
            text-align: center; font-size: 14px; cursor: pointer; border-radius: 4px;
            position: fixed; top: 150px; right: 20px; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
    `);

    function sanitizeForCSV(str) {
        if (!str) return '';
        str = String(str).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function getText(selector, parent = document) {
        const el = parent.querySelector(selector);
        return el ? el.textContent.trim() : '';
    }

    function extractOrderData() {
        console.log("Auto-export: Iniciando extracción...");
        let csvRows = [];
        const separator = ';';

        const orderIdText = getText('h1.text-break') || getText('div.page-title-container h1');
        const orderId = orderIdText.replace(/Compra\s*#\s*|Order\s*#\s*/i, '').trim();
        const sellerUsername = getText('#SellerBuyerInfo .seller-name a[href*="/Users/"]');
        
        // --- Simplificación para el ejemplo, manteniendo tu estructura base ---
        csvRows.push(['OrderID', 'SellerUsername'].map(sanitizeForCSV).join(separator));
        csvRows.push([orderId, sellerUsername].map(sanitizeForCSV).join(separator));
        csvRows.push('');

        // Artículos
        const articleTables = document.querySelectorAll('table.product-table');
        articleTables.forEach(table => {
            csvRows.push(['ArticleID', 'Quantity', 'Name', 'Price'].map(sanitizeForCSV).join(separator));
            table.querySelectorAll('tbody tr[data-article-id]').forEach(row => {
                const data = [
                    row.dataset.articleId,
                    getText('td.amount', row).replace('x',''),
                    getText('td.name a', row),
                    getText('td.price', row).replace(/[€$]/g, '').replace(',', '.')
                ];
                csvRows.push(data.map(sanitizeForCSV).join(separator));
            });
        });

        const csvString = csvRows.join('\n');
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `cardmarket_order_${orderId}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // BOTÓN MANUAL
    const exportButton = document.createElement('button');
    exportButton.textContent = `Exportar CSV (v${SCRIPT_VERSION})`;
    exportButton.className = 'export-csv-button';
    exportButton.onclick = extractOrderData;
    document.body.appendChild(exportButton);

    // LÓGICA AUTO-EJECUCIÓN
    window.addEventListener('load', () => {
        if (window.location.search.includes('autoexport=true')) {
            console.log("Detectado autoexport=true. Iniciando descarga automática...");
            setTimeout(extractOrderData, 1500); // Esperar a que carguen los datos dinámicos
        }
    });

})();
