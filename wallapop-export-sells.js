// ==UserScript==
// @name         Exportar Compras Wallapop a CSV (Mejorado con Fechas e Imágenes - URL Fix)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Extrae la lista de compras de Wallapop y la exporta a CSV de manera más robusta, incluyendo fecha y URL de imagen.
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

    // Función para intentar extraer la fecha de una cadena de texto
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
        return ''; // Si no se encuentra ninguna fecha
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

    exportButton.addEventListener('click', () => {
        // *** CAMBIO AQUÍ ***
        // Log la URL actual para depuración
        console.log('Current Wallapop URL:', window.location.href);

        // Intenta hacer la comprobación de URL más general o incluso eliminarla si quieres
        // que el botón aparezca en cualquier página de Wallapop.
        // La siguiente línea hace una comprobación más laxa, buscando "transactions" o "purchases"
        // en cualquier parte de la URL, lo cual debería ser suficiente.
        const isTransactionPage = window.location.href.includes('/app/user/transactions') ||
                                  window.location.href.includes('/app/user/purchases') ||
                                  window.location.href.includes('/app/profile/transactions') || // Otra posible ruta
                                  window.location.href.includes('/app/profile/purchases') ||    // Otra posible ruta
                                  window.location.href.includes('/app/user/history'); // Otra posible ruta para el historial general

        if (!isTransactionPage) {
             alert('Por favor, navega a tu sección de "Compras" o "Historial de Transacciones" en Wallapop para usar este script.');
             return;
        }
        // *** FIN CAMBIO ***

        const data = parseWallapopEntries();
        if(data.length === 0) {
            alert('No se encontraron entradas de historial para exportar. Asegúrate de estar en tu sección de compras/ventas y de que los elementos estén cargados.');
            return;
        }
        const csvData = dataToCSV(data);
        downloadCSV(csvData, 'wallapop_historial_transacciones.csv');
    });

    document.body.appendChild(exportButton);
})();
