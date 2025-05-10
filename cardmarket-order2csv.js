// ==UserScript==
// @name         Cardmarket Order Exporter to CSV
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Extracts Cardmarket order details to CSV format.
// @author       Your Name
// @match        https://www.cardmarket.com/*/Magic/Orders/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .export-csv-button {
            background-color: #4CAF50;
            border: none;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
            margin: 10px 2px;
            cursor: pointer;
            border-radius: 4px;
            position: fixed;
            top: 150px;
            right: 20px;
            z-index: 9999;
        }
    `);

    function sanitizeForCSV(str) {
        if (str === null || str === undefined) {
            return '';
        }
        str = String(str);
        // Replace newlines with a space, remove extra whitespace
        str = str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
        // If the string contains a comma, double quotes, or newline, enclose in double quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            // Escape existing double quotes by doubling them
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function getText(selector, parent = document) {
        const el = parent.querySelector(selector);
        return el ? el.textContent.trim() : '';
    }

    function getAttr(selector, attribute, parent = document) {
        const el = parent.querySelector(selector);
        return el ? el.getAttribute(attribute) : '';
    }

    function extractOrderData() {
        let csvRows = [];

        // --- General Order Info ---
        const orderIdText = getText('h1.text-break') || getText('div.page-title-container h1');
        const orderId = orderIdText.replace('Compra #', '').trim();

        const sellerUsername = getText('#SellerBuyerInfo .seller-name a[href*="/Users/"]');
        const sellerLocationIcon = document.querySelector('#SellerBuyerInfo .seller-name span.icon[title*="Ubicación del artículo"]');
        const sellerLocation = sellerLocationIcon ? sellerLocationIcon.getAttribute('title').replace('Ubicación del artículo: ', '') : '';

        const timeline = {};
        document.querySelectorAll('#Timeline .timeline-box').forEach(box => {
            const parts = box.textContent.trim().split(':');
            if (parts.length >= 2) {
                const status = parts[0].trim();
                const dateTime = parts.slice(1).join(':').trim().replace(/\s+/g, ' ');
                timeline[status] = dateTime;
            }
        });

        const summaryDiv = document.querySelector('#collapsibleBuyerShipmentSummary .summary');
        const articleCount = summaryDiv ? summaryDiv.dataset.articleCount : getText('#collapsibleBuyerShipmentSummary .article-count').replace(' Artículos', '');
        const itemValue = summaryDiv ? summaryDiv.dataset.itemValue : getText('#collapsibleBuyerShipmentSummary .item-value').replace(' €', '');
        const shippingPrice = summaryDiv ? summaryDiv.dataset.shippingPrice : getText('#collapsibleBuyerShipmentSummary .shipping-price').replace(' €', '');
        const totalPrice = summaryDiv ? summaryDiv.dataset.totalPrice : getText('#labelBuyerShipmentSummary strong').replace('(', '').replace(')', '').replace(' €', '');


        const sellerAddressDiv = document.querySelector('#collapsibleSellerAddress .text-break');
        const sellerDisplayName = sellerAddressDiv ? getText('.Name', sellerAddressDiv) : '';
        const sellerStreet = sellerAddressDiv ? getText('.Street', sellerAddressDiv) : '';
        const sellerCityZip = sellerAddressDiv ? getText('.City', sellerAddressDiv) : '';
        const sellerCountry = sellerAddressDiv ? getText('.Country', sellerAddressDiv) : '';

        const shippingAddressDiv = document.querySelector('#collapsibleShippingAddress #ShippingAddress');
        const buyerName = shippingAddressDiv ? getText('.Name', shippingAddressDiv) : '';
        const buyerStreet = shippingAddressDiv ? getText('.Street', shippingAddressDiv) : '';
        const buyerCityZip = shippingAddressDiv ? getText('.City', shippingAddressDiv) : '';
        const buyerCountry = shippingAddressDiv ? getText('.Country', shippingAddressDiv) : '';

        const shippingMethodDd = document.querySelector('#collapsibleOtherInfo dd');
        let shippingMethodName = '';
        let shippingTracked = 'No';
        let shippingTrust = 'No';
        if (shippingMethodDd) {
            shippingMethodName = shippingMethodDd.childNodes[1] ? shippingMethodDd.childNodes[1].textContent.trim() : ''; // First span after info icon
             const trackingInfoDiv = shippingMethodDd.querySelector('div.text-danger');
             if (trackingInfoDiv) {
                if (trackingInfoDiv.textContent.includes('Envío no certificado')) {
                    shippingTracked = 'No';
                } else if (trackingInfoDiv.textContent.includes('Envío certificado')) { // Assuming it might say this
                    shippingTracked = 'Sí';
                }
                if (trackingInfoDiv.textContent.includes('Servicio TRUST') && trackingInfoDiv.textContent.includes('No')) {
                     shippingTrust = 'No';
                } else if (trackingInfoDiv.textContent.includes('Servicio TRUST') && !trackingInfoDiv.textContent.includes('No')) { // If it just says "Servicio TRUST"
                     shippingTrust = 'Sí';
                }
             }
        }


        const evalDiv = document.querySelector('#collapsibleEvaluation');
        let evalDate = '', evalOverall = '', evalItemDesc = '', evalPackaging = '', evalComment = '';
        if (evalDiv) {
            const evalDateEl = evalDiv.querySelector('.d-flex.justify-content-between > div');
            evalDate = evalDateEl ? evalDateEl.textContent.trim().replace(/\s+/g, ' ') : '';

            const dts = evalDiv.querySelectorAll('dl dt');
            dts.forEach(dt => {
                const dd = dt.nextElementSibling;
                if (dd) {
                    const ratingSpan = dd.querySelector('span[title]');
                    const ratingText = ratingSpan ? ratingSpan.getAttribute('title') : (dd.querySelector('.fst-italic') ? dd.querySelector('.fst-italic').textContent.trim() : '');

                    if (dt.textContent.includes('Evaluación general:')) evalOverall = ratingText;
                    else if (dt.textContent.includes('Descripción del artículo:')) evalItemDesc = ratingText;
                    else if (dt.textContent.includes('Empaquetado:')) evalPackaging = ratingText;
                    else if (dt.textContent.includes('Comentario:')) evalComment = ratingText;
                }
            });
        }


        // General Info Headers & Row
        const generalHeaders = [
            'OrderID', 'SellerUsername', 'SellerLocation', 'SellerDisplayName', 'SellerStreet', 'SellerCityZip', 'SellerCountry',
            'DatePaid', 'DateShipped', 'DateReceived',
            'ArticleCount', 'ItemValue', 'ShippingCost', 'TotalPrice',
            'BuyerName', 'BuyerStreet', 'BuyerCityZip', 'BuyerCountry',
            'ShippingMethod', 'ShippingTracked', 'ShippingTrustService',
            'EvaluationDate', 'EvalOverall', 'EvalItemDesc', 'EvalPackaging', 'EvalComment'
        ];
        csvRows.push(generalHeaders.map(sanitizeForCSV).join(','));

        const generalData = [
            orderId, sellerUsername, sellerLocation, sellerDisplayName, sellerStreet, sellerCityZip, sellerCountry,
            timeline['Pagado'] || '', timeline['Enviado'] || '', timeline['Recibido'] || '',
            articleCount, itemValue, shippingPrice, totalPrice,
            buyerName, buyerStreet, buyerCityZip, buyerCountry,
            shippingMethodName, shippingTracked, shippingTrust,
            evalDate, evalOverall, evalItemDesc, evalPackaging, evalComment
        ];
        csvRows.push(generalData.map(sanitizeForCSV).join(','));
        csvRows.push(''); // Spacer row

        // --- Articles ---
        const articleTable = document.querySelector('table.product-table'); // More robust selector
        if (!articleTable) {
            console.error("Article table not found!");
            alert("No se pudo encontrar la tabla de artículos.");
            return;
        }

        const articleHeaders = [
            'ArticleID', 'ProductID', 'Quantity', 'Name', 'LocalizedName', 'Expansion',
            'CollectorNum', 'Rarity', 'Condition', 'Language', 'IsFoil', 'PricePerUnit', 'Comment'
        ];
        csvRows.push(articleHeaders.map(sanitizeForCSV).join(','));

        const articleRows = articleTable.querySelectorAll('tbody tr[data-article-id]');
        articleRows.forEach(row => {
            const articleData = [];
            articleData.push(row.dataset.articleId || '');
            articleData.push(row.dataset.productId || '');
            articleData.push(getText('td.amount', row).replace('x', '').trim());
            articleData.push(getText('td.name a', row));
            articleData.push(getText('td.name div.small', row));
            articleData.push(getAttr('div.expansion a', 'title', row.querySelector('td.info')) || row.dataset.expansionName || '');
            articleData.push(getText('span.collector-num', row.querySelector('td.info')));

            const raritySymbol = row.querySelector('td.info span.rarity-symbol svg[title]');
            articleData.push(raritySymbol ? raritySymbol.getAttribute('title') : '');

            articleData.push(getText('a.article-condition span.badge', row.querySelector('td.info')));

            const langIcon = row.querySelector('td.info div.col-icon span.icon[title]');
            articleData.push(langIcon ? langIcon.getAttribute('title') : '');

            const foilIcon = row.querySelector('td.info span.extras span.icon[title="Foil"]');
            articleData.push(foilIcon ? 'Sí' : 'No');

            articleData.push(getText('td.price', row).replace('€', '').trim());
            articleData.push(getText('p.comment', row.querySelector('td.info')));

            csvRows.push(articleData.map(sanitizeForCSV).join(','));
        });

        const csvString = csvRows.join('\n');
        downloadCSV(csvString, `cardmarket_order_${orderId || 'export'}.csv`);
    }

    function downloadCSV(csvContent, fileName) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            // Fallback for older browsers (or if download attribute is not supported)
            console.error("Download attribute not supported. CSV content logged to console.");
            console.log(csvContent);
            GM_setClipboard(csvContent);
            alert("El navegador no soporta la descarga directa. El CSV se ha copiado al portapapeles y se ha mostrado en la consola.");
        }
    }

    // --- Add Button to Page ---
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Exportar Pedido a CSV';
    exportButton.className = 'export-csv-button';
    exportButton.addEventListener('click', extractOrderData);
    document.body.appendChild(exportButton);

})();
