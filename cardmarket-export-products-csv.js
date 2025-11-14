// ==UserScript==
// @name         Cardmarket Wants Extractor to CSV
// @namespace    Violentmonkey Scripts
// @match        https://www.cardmarket.com/*/*/Products/*
// @grant        GM_download
// @grant        GM_setClipboard
// @version      1.5
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
        strText = strText.replace(/"/g, '""'); // Escape double quotes
        if (strText.includes(',') || strText.includes('\n') || strText.includes('"')) {
            strText = `"${strText}"`; // Enclose in double quotes if needed
        }
        return strText;
    }

    // --- FUNCIÓN DE EXTRACCIÓN TOTALMENTE REESCRITA ---
    function extractDataToCSV() {
        const data = [];
        data.push(['Nombre', 'Enlace Completo', 'URL Imagen']); // CSV Header
        const baseUrl = 'https://www.cardmarket.com';

        // Helper para extraer la imagen del nuevo popover (data-bs-content)
        function extractImageFromPopover(element) {
            if (!element) return '';
            const popoverHtml = element.getAttribute('data-bs-content'); // Atributo cambiado
            if (!popoverHtml) return '';
            const imgMatch = popoverHtml.match(/src="([^"]+)"/);
            // Decodificar &amp;
            return imgMatch && imgMatch[1] ? imgMatch[1].replace(/&amp;/g, '&') : '';
        }

        // 1. Intenta con la nueva tabla de ESCRITORIO
        let rows = document.querySelectorAll('#wants-list-table tbody tr'); // ID de tabla cambiado
        console.log(`Processing ${rows.length} rows from desktop view.`);

        if (rows.length > 0) { // Vista de Escritorio
            rows.forEach(row => {
                // Selectores de celda completamente cambiados
                const linkElement = row.querySelector('td[data-label="Nombre"] a');
                const popoverElement = row.querySelector('a[data-bs-toggle="popover"]'); // La imagen está aquí

                if (linkElement && popoverElement) {
                    const name = linkElement.textContent.trim();
                    let link = linkElement.getAttribute('href');
                    if (link && !link.startsWith('http')) {
                        link = baseUrl + link;
                    }
                    const imageUrl = extractImageFromPopover(popoverElement);
                    data.push([name, link, imageUrl]);
                } else {
                    console.warn('Skipping a row in desktop view, missing elements:', row);
                }
            });
        } else {
            // 2. Fallback a la nueva vista MÓVIL (ya no es un acordeón)
            rows = document.querySelectorAll('#wants-list-rows div.row.g-0'); // Selector de móvil cambiado
            console.log(`Processing ${rows.length} rows from mobile view.`);

            if (rows.length > 0) {
                rows.forEach(item => {
                    // Selectores de móvil completamente cambiados
                    const linkElement = item.querySelector('.article-name a');
                    const popoverElement = item.querySelector('a[data-bs-toggle="popover"]');

                    if (linkElement && popoverElement) {
                        const name = linkElement.textContent.trim();
                        let link = linkElement.getAttribute('href');
                        if (link && !link.startsWith('http')) {
                            link = baseUrl + link;
                        }
                        const imageUrl = extractImageFromPopover(popoverElement);
                        data.push([name, link, imageUrl]);
                    } else {
                        console.warn('Skipping an item in mobile view, missing elements:', item);
                    }
                });
            }
        }

        if (data.length <= 1) { // Solo cabecera
            alert('No se encontraron datos para extraer. La estructura de la página puede haber cambiado de nuevo.');
            return;
        }

        const csvContent = data.map(row => row.map(sanitizeForCSV).join(',')).join('\n');

        // --- Extracción de nombre de archivo MEJORADA ---
        let listName = "cardmarket_wants";
        // El selector '.page-title-container h1' ya no existe. Usamos el h1 principal.
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            listName = titleElement.textContent.trim()
                .replace("Wants List:", "") // Limpia el prefijo
                .trim()
                .replace(/[^a-z0-9]+/gi, '_') // Limpia caracteres especiales
                .toLowerCase();
        }
        if (listName === "" || listName.startsWith("_")) {
             listName = "cardmarket_wants"; // Fallback
        }
        const filename = `${listName}.csv`;

        // Descargar CSV
        GM_download({
            url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent),
            name: filename,
            saveAs: true,
            onload: () => {
                console.log('CSV descargado.');
                alert(`CSV "${filename}" descargado.`);
            },
            onerror: (err) => {
                console.error('Error al descargar:', err);
                alert('Error al descargar el CSV.');
            }
        });

        // Copiar al portapapeles
        try {
            GM_setClipboard(csvContent);
            console.log('Contenido CSV copiado al portapapeles.');
        } catch (e) {
            console.error('Error al copiar al portapapeles:', e);
        }
    }

    // Espera a que la página esté cargada para añadir el botón
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExtractButton);
    } else {
        addExtractButton();
    }

})();
