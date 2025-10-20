// ==UserScript==
// @name         Exportar Compras Wallapop a CSV (Año en Fechas Corregido)
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Extrae la lista de compras de Wallapop y la exporta a CSV, incluyendo el año completo en las fechas, corrigiendo el año incorrecto.
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
        // Obtener el año actual CADA VEZ que se llama la función, para asegurar que es el correcto.
        const currentYear = new Date().getFullYear(); 
        
        const monthMap = {
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
            'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        // Regexp 1: "DD MMM. AAAA" o "DD de Mes de AAAA" (ya tiene el año completo)
        // Ojo: Añadida la posibilidad de que el año no tenga "de" antes (ej. "23 mar. 2023")
        let match = text.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\.?\s+(?:de\s+)?(\d{4})/i);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = monthMap[match[2].toLowerCase()];
            const year = match[3]; // Aquí el año siempre es de 4 dígitos
            if (day && month && year) {
                return `${day}/${month}/${year}`;
            }
        }

        // Regexp 2: "DD/MM/AAAA" (ya tiene el año)
        match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            let year = match[3];
            if (year.length === 2) { // Si el año es de 2 dígitos, asumir el siglo actual (ej. 23 -> 2023)
                year = `20${year}`; // Esto es una suposición, si Wallapop muestra 98, sería 1998, pero para Wallapop actual, 20xx es más probable.
            }
            return `${day}/${month}/${year}`;
        }

        // Regexp 3: "DD MMM." o "DD de Mes." (falta el año, asumimos el actual)
        match = text.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\.?/i);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = monthMap[match[2].toLowerCase()];
            if (day && month) {
                return `${day}/${month}/${currentYear}`; // Añadimos el año actual correctamente
            }
        }
        
        // Regexp 4: "Estado: DD/MM" (falta el año, asumimos el actual) - Ej: Enviada: 23/03
        match = text.match(/(?:Completada|Entregada|Finalizada|Enviada|Fecha de envío|Fecha):\s*(\d{1,2}\/\d{1,2})/i);
        if (match) {
            const day = match[1].split('/')[0].padStart(2, '0');
            const month = match[1].split('/')[1].padStart(2, '0');
            if (day && month) {
                return `${day}/${month}/${currentYear}`; // Añadimos el año actual correctamente
            }
        }

        return ''; // Si no se encuentra ninguna fecha válida
    }

    // El resto del script (parseWallapopEntries, dataToCSV, botón, MutationObserver)
    // permanece igual al de la versión 1.6
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
        const uniqueData = [];
        const seenRows = new Set();

        data.forEach(row => {
            const rowString = JSON.stringify(row);
            if (!seenRows.has(rowString)) {
                seenRows.add(rowString);
                uniqueData.push(row);
            }
        });

        const headers = ['Título', 'Precio', 'Estado y Fecha (Original)', 'Fecha Extraída', 'Tipo de envío', 'URL Imagen'];
        const csvRows = [headers.map(h => escapeCSV(h)).join(',')];

        uniqueData.forEach(row => {
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
    exportButton.style.display = 'none';

    let buttonActivated = false;

    function activateButton() {
        if (buttonActivated) return true;

        if (document.querySelector('tsl-historic-element, [data-testid="transaction-item"], .HistoricElement')) {
            exportButton.style.display = 'block';
            buttonActivated = true;
            return true;
        }
        return false;
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

    const observer = new MutationObserver((mutationsList, observer) => {
        if (!buttonActivated) {
            if (activateButton()) {
                observer.disconnect();
                console.log('MutationObserver desconectado: Botón activado y elementos encontrados.');
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    activateButton();

})();
