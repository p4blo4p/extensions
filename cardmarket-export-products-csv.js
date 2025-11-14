// ==UserScript==
// @name         Cardmarket Wants Extractor to CSV
// @namespace    Violentmonkey Scripts
// @match        https://www.cardmarket.com/*/*/Wants/*
// @grant        GM_download
// @grant        GM_setClipboard
// @version      1.3
// @author       Your Name (corregido)
// @description  Extrae la lista de "Wants" de Cardmarket (imágenes, nombres, enlaces) a un archivo CSV.
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    function addExtractButton() {
        const button = document.createElement('button');
        button.textContent = 'Extraer a CSV';
        button.style.position = 'fixed';
        button.style.top = '120px'; // Adjusted to avoid overlapping with other CM elements
        button.style.right = '20px';
        button.style.zIndex = '10000';
        button.style.padding = '10px 15px';
        button.style.backgroundColor = '#28a745'; // Green
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.id = 'extract-csv-button';

        button.addEventListener('click', extractDataToCSV);
        document.body.appendChild(button);
    }

    function sanitizeForCSV(text) {
        if (text === null || typeof text === 'undefined') {
            return '';
        }
        let strText = String(text);
        // Replace " with "" for CSV escaping
        strText = strText.replace(/"/g, '""');
        // If the text contains a comma, newline, or double quote, enclose it in double quotes
        if (strText.includes(',') || strText.includes('\n') || strText.includes('"')) {
            strText = `"${strText}"`;
        }
        return strText;
    }

    function extractDataToCSV() {
        const data = [];
        data.push(['Nombre', 'Enlace Completo', 'URL Imagen']); // CSV Header

        const baseUrl = 'https://www.cardmarket.com';

        // Try desktop table first
        let rows = document.querySelectorAll('#WantsListTable tbody tr');

        if (rows.length > 0) { // Desktop view
            console.log(`Processing ${rows.length} rows from desktop view.`);
            rows.forEach(row => {
                const nameElement = row.querySelector('td.name a');
                const previewElement = row.querySelector('td.preview span[data-bs-title]');

                if (nameElement && previewElement) {
                    const name = nameElement.textContent.trim();
                    let link = nameElement.getAttribute('href');
                    if (link && !link.startsWith('http')) {
                        link = baseUrl + link;
                    }

                    const tooltipHtml = previewElement.getAttribute('data-bs-title');
                    const imgMatch = tooltipHtml.match(/src="([^"]+)"/);
                    
                    // --- CORRECCIÓN AQUÍ ---
                    // Decodifica &amp; a & para que las URLs de imagen funcionen
                    let imageUrl = imgMatch && imgMatch[1] ? imgMatch[1].replace(/&amp;/g, '&') : '';

                    data.push([name, link, imageUrl]);
                } else {
                    console.warn('Skipping a row in desktop view, missing elements:', row);
                }
            });
        } else {
            // Fallback to mobile list view (accordion items)
            rows = document.querySelectorAll('#MobileWantsList div.accordion-item');
            console.log(`Processing ${rows.length} rows from mobile view.`);
            if (rows.length > 0) {
                rows.forEach(item => {
                    const headerLink = item.querySelector('.accordion-header a');
                    const body = item.querySelector('.accordion-collapse .item-body-wrapper');

                    if (headerLink && body) {
                        const nameElement = headerLink.querySelector('.want-name');
                        const name = nameElement ? nameElement.textContent.trim() : 'N/A';

                        const linkElement = body.querySelector('dl dt a');
                        let link = linkElement ? linkElement.getAttribute('href') : '';
                        if (link && !link.startsWith('http')) {
                            link = baseUrl + link;
                        }

                        const imageSpan = body.querySelector('dl dd span[data-bs-title]');
                        let imageUrl = 'N/A';
                        if (imageSpan) {
                             const tooltipHtml = imageSpan.getAttribute('data-bs-title');
                             const imgMatch = tooltipHtml.match(/src="([^"]+)"/);
                             
                             // --- CORRECCIÓN AQUÍ ---
                             // Decodifica &amp; a & para que las URLs de imagen funcionen
                             imageUrl = imgMatch && imgMatch[1] ? imgMatch[1].replace(/&amp;/g, '&') : '';
                        }
                        data.push([name, link, imageUrl]);
                    } else {
                         console.warn('Skipping an item in mobile view, missing elements:', item);
                    }
                });
            }
        }


        if (data.length <= 1) { // Only header
            alert('No se encontraron datos para extraer.');
            return;
        }

        const csvContent = data.map(row => row.map(sanitizeForCSV).join(',')).join('\n');

        // Create filename from the list title
        let listName = "cardmarket_wants";
        const titleElement = document.querySelector('.page-title-container h1');
        if (titleElement) {
            listName = titleElement.textContent.trim().replace(/[^a-z0-9]+/gi, '_').toLowerCase();
        }
        const filename = `${listName}.csv`;

        // Download CSV
        GM_download({
            url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent),
            name: filename,
            saveAs: true, // Prompts user for filename and location
            onload: () => {
                console.log('CSV descargado.');
                alert(`CSV "${filename}" descargado.`);
            },
            onerror: (err) => {
                console.error('Error al descargar:', err);
                alert('Error al descargar el CSV.');
            }
        });

        // Copy to clipboard for convenience
        try {
            GM_setClipboard(csvContent);
            console.log('Contenido CSV copiado al portapapeles.');
            // Optionally notify user about clipboard copy
            // alert('Contenido CSV copiado al portapapeles.');
        } catch (e) {
            console.error('Error al copiar al portapapeles:', e);
        }
    }

    // Wait for the page to be fully loaded before adding the button
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExtractButton);
    } else {
        addExtractButton();
    }

})();
