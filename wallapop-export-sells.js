// ==UserScript==
// @name         Exportar Compras Wallapop a CSV
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extrae la lista de compras de Wallapop y la exporta a CSV
// @author       Tu Nombre
// @match        *://*.wallapop.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function downloadCSV(csv_data, filename) {
        const csvFile = new Blob([csv_data], {type: 'text/csv'});
        const downloadLink = document.createElement('a');
        downloadLink.download = filename;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    function escapeCSV(text) {
        text = text.replace(/"/g, '""');
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            text = `"${text}"`;
        }
        return text;
    }

    function parseWallapopEntries() {
        // Seleccionar los elementos que representan cada compra en la lista
        const entries = document.querySelectorAll('tsl-historic-element .HistoricElement');
        const data = [];

        entries.forEach(entry => {
            const title = entry.querySelector('.HistoricElement__title > div')?.innerText.trim() || '';
            const price = entry.querySelector('.HistoricElement__money-amount')?.innerText.trim() || '';
            // Estado y fecha están en el subdescription, pero la fecha puede estar en texto como "Completada el 23 mar."
            const subDesc = entry.querySelector('.HistoricElement__subDescription')?.innerText.trim() || '';
            // Extraer fecha con formato libre y posible estado (ej: "Completada el 23 mar.")
            const estadoFecha = subDesc.replace(/\s+/g, ' '); 

            // Tipo de envío (si aparece)
            const shippingType = entry.querySelector('.HistoricElement__description span:nth-child(2)')?.innerText.trim() || '';

            data.push({
                title: title,
                price: price,
                estado_fecha: estadoFecha,
                envio: shippingType
            });
        });

        return data;
    }

    function dataToCSV(data) {
        const headers = ['Título', 'Precio', 'Estado y Fecha', 'Tipo de envío'];
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const csvRow = [
                escapeCSV(row.title),
                escapeCSV(row.price),
                escapeCSV(row.estado_fecha),
                escapeCSV(row.envio)
            ].join(',');
            csvRows.push(csvRow);
        });

        return csvRows.join('\n');
    }

    const exportButton = document.createElement('button');
    exportButton.textContent = 'Exportar Compras a CSV';
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
        const data = parseWallapopEntries();
        if(data.length === 0) {
            alert('No se encontraron compras para exportar.');
            return;
        }
        const csvData = dataToCSV(data);
        downloadCSV(csvData, 'wallapop_compras.csv');
    });

    document.body.appendChild(exportButton);
})();
