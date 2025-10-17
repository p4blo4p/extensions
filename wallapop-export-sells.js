// ==UserScript==
// @name         Exportar Compras Wallapop a CSV (Con Observador de DOM)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Extrae la lista de compras de Wallapop y la exporta a CSV de manera más robusta, esperando a que el DOM esté cargado.
// @author       Tu Nombre
// @match        *://*.wallapop.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function downloadCSV(csv_data, filename) {
        const csvFile = new Blob([csv_data], {type: 'text/csv;charset=utf-8;'});
        const downloadLink = document.createElement('a');
        downloadLink.download = filename;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    function escapeCSV(text) {
        if (text === null || text === undefined) {
            return '';
        }
        text = String(text).replace(/"/g, '""');
        if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
            text = `"${text}"`;
        }
        return text;
    }

    function extractDateFromText(text) {
        const dateRegexes = [
            /el\s+(\d{1,2}\s+[a-záéíóúñ]+\.)/i, // "el 23 mar." o "el 23 de marzo."
            /el\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/, // "el 23/03/2023"
            /(?:Completada|Entregada|Finalizada|Enviada|Fecha de envío|Fecha):\s*(\d{1,2}\s+[a-záéíóúñ]+\.?|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
            /(\d{1,2}\s+[a-záéíóúñ]+\.?\s*\d{4})/i, // "23 mar. 2023" (si el año aparece)
            /(\d{1,2}\/\d{1,2}\/\d{4})/ // "01/01/2023"
        ];

        for (const regex of dateRegexes) {
            const match = text.match(regex);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    function parseWallapopEntries() {
        const entries = document.querySelectorAll('tsl-historic-element, [data-testid="transaction-item"], .HistoricElement');
        const data = [];

        entries.forEach(entry => {
            let title = '';
            let price = '';
            let subDesc = '';
            let extractedDate = '';
            let shippingType = '';
            let imageUrl = '';

            title = entry.querySelector('.HistoricElement__title > div, [data-testid="item-title"]')
                          ?.innerText.trim() || '';

            price = entry.querySelector('.HistoricElement__money-amount, [data-testid="item-price"]')
                           ?.innerText.trim() || '';

            subDesc = entry.querySelector('.HistoricElement__subDescription, [data-testid="item-status-date"]')
                                 ?.innerText.trim().replace(/\s+/g, ' ') || '';

            extractedDate = extractDateFromText(subDesc);

            shippingType = entry.querySelector('.HistoricElement__description span:nth-child(2), [data-testid="item-shipping-type"]')
                                   ?.innerText.trim() || '';

            imageUrl = entry.querySelector('img[src], [data-testid="item-image"] img[src]')
                             ?.getAttribute('src') || '';

            if (title || price || subDesc || shippingType || imageUrl) {
                data.push({
                    title: title,
                    price: price,
                    estado_fecha_raw: subDesc,
                    fecha_extraida: extractedDate,
                    envio: shippingType,
                    imagen_url: imageUrl
                });
            }
        });

        return data;
    }

    function dataToCSV(data) {
        const headers = ['Título', 'Precio', 'Estado y Fecha (Original)', 'Fecha Extraída', 'Tipo de envío', 'URL Imagen'];
        const csvRows = [headers.map(h => escapeCSV(h)).join(',')];

        data.forEach(row => {
            const csvRow = [
                escapeCSV(row.title),
                escapeCSV(row.price),
                escapeCSV(row.estado_fecha_raw),
                escapeCSV(row.fecha_extraida),
                escapeCSV(row.envio),
                escapeCSV(row.imagen_url)
            ].join(',');
            csvRows.push(csvRow);
        });

        return csvRows.join('\n');
    }

    const exportButton = document.createElement('button');
    exportButton.textContent = 'Exportar Historial a CSV';
    exportButton.style.position = 'fixed';
    exportButton.style.top = '10px';
    exportButton.style.right = '10px';
    exportButton.style.zIndex = 10000;
    exportButton.style.padding = '8px 12px';
    exportButton.style.backgroundColor = '#007bff';
    exportButton.style.color = 'white';
    exportButton.style.border = 'none';
    exportButton.style.borderRadius = '4px';
    exportButton.style.cursor = 'pointer';
    exportButton.style.display = 'none'; // Oculto inicialmente

    // Función para activar el botón una vez que los elementos relevantes están presentes
    function activateButton() {
        // Buscamos si hay al menos una entrada de historial.
        // Los selectores aquí deben coincidir con los de parseWallapopEntries
        if (document.querySelector('tsl-historic-element, [data-testid="transaction-item"], .HistoricElement')) {
            exportButton.style.display = 'block'; // Mostrar el botón
            return true; // Indicamos que el botón se activó
        }
        return false; // El botón no se activó
    }

    exportButton.addEventListener('click', () => {
        const data = parseWallapopEntries();
        if(data.length === 0) {
            alert('No se encontraron entradas de historial para exportar. Asegúrate de estar en tu sección de compras/ventas y de que los elementos estén cargados.');
            return;
        }
        const csvData = dataToCSV(data);
        downloadCSV(csvData, 'wallapop_historial_transacciones.csv');
    });

    document.body.appendChild(exportButton);

    // --- MutationObserver para esperar a que el contenido se cargue ---
    const observer = new MutationObserver((mutationsList, observer) => {
        // Para cada mutación, intentamos activar el botón
        if (activateButton()) {
            // Si el botón se activó, ya encontramos los elementos, podemos dejar de observar
            observer.disconnect();
        }
    });

    // Observar cambios en el body (o un contenedor más específico si lo conoces)
    // childList: para detectar adiciones/eliminaciones de nodos hijos
    // subtree: para observar no solo el elemento objetivo, sino también sus descendientes
    observer.observe(document.body, { childList: true, subtree: true });

    // También intentamos activar el botón una vez por si el contenido ya estaba cargado
    // (ej. si el script se ejecuta más tarde).
    activateButton();

})();
