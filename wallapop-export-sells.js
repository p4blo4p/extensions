// ==UserScript==
// @name         Exportar Compras Wallapop a CSV (Mejorado)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Extrae la lista de compras de Wallapop y la exporta a CSV de manera más robusta.
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

    function parseWallapopEntries() {
        // Selector más general para las entradas de la lista de transacciones/historial
        // Puede que necesites ajustar este selector si Wallapop cambia mucho su estructura.
        // Busca un elemento que contenga la información de una transacción individual.
        const entries = document.querySelectorAll('tsl-historic-element, [data-testid="transaction-item"]'); // Posibles selectores para elementos de historial
        const data = [];

        entries.forEach(entry => {
            let title = '';
            let price = '';
            let estadoFecha = '';
            let shippingType = '';

            // Intentar extraer el título
            title = entry.querySelector('.HistoricElement__title > div, [data-testid="item-title"]')
                          ?.innerText.trim() || '';

            // Intentar extraer el precio
            price = entry.querySelector('.HistoricElement__money-amount, [data-testid="item-price"]')
                           ?.innerText.trim() || '';

            // Intentar extraer el estado y la fecha (subdescripción)
            estadoFecha = entry.querySelector('.HistoricElement__subDescription, [data-testid="item-status-date"]')
                                 ?.innerText.trim().replace(/\s+/g, ' ') || '';

            // Intentar extraer el tipo de envío
            // Este es un selector más específico y podría requerir ajustes.
            // A veces la información de envío está dentro de la descripción general o como un elemento separado.
            shippingType = entry.querySelector('.HistoricElement__description span:nth-child(2), [data-testid="item-shipping-type"]')
                                   ?.innerText.trim() || '';

            // Si no se encontró el título, puede que no sea una entrada válida o el selector es incorrecto.
            if (title || price || estadoFecha || shippingType) {
                data.push({
                    title: title,
                    price: price,
                    estado_fecha: estadoFecha,
                    envio: shippingType
                });
            }
        });

        return data;
    }

    function dataToCSV(data) {
        const headers = ['Título', 'Precio', 'Estado y Fecha', 'Tipo de envío'];
        const csvRows = [headers.map(h => escapeCSV(h)).join(',')]; // Asegúrate de escapar las cabeceras también

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
    exportButton.textContent = 'Exportar Historial a CSV'; // Cambiado a Historial para ser más general
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
        // Asegurarse de que estamos en la página correcta donde se muestran las compras/ventas
        // Un buen lugar es el historial de transacciones.
        // Por ejemplo, si la URL contiene '/app/user/transactions' o similar.
        if (!window.location.href.includes('/app/user/transactions') && !window.location.href.includes('/app/user/purchases')) {
             alert('Por favor, navega a tu sección de "Compras" o "Historial de Transacciones" en Wallapop para usar este script.');
             return;
        }

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
