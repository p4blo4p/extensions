// ==UserScript==
// @name         Cardmarket Order Exporter to CSV (Direct Rarity Title & data-language from TR)
// @namespace    http://tampermonkey.net/
// @version      1.9.8
// @description  Extracts Cardmarket order details. Prioritizes rarity-symbol title for rarity. Uses data-language from TR for Language. Displays version on button.
// @author       Your Name (Modified by AI)
// @match        https://www.cardmarket.com/*/*/Orders/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : 'N/A';

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
            top: 150px; /* Ajustado para evitar superposición con la barra de navegación de MKM */
            right: 20px;
            z-index: 9999;
        }
    `);

    function sanitizeForCSV(str) {
        if (str === null || str === undefined) {
            return '';
        }
        str = String(str);
        str = str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim(); // Reemplaza saltos de línea y múltiples espacios
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`; // Envuelve en comillas si contiene coma, comillas o saltos de línea
        }
        return str;
    }

    function sanitizeForFilename(str) {
        if (str === null || str === undefined) {
            return '';
        }
        return String(str).replace(/[^a-z0-9_\-\s.]/gi, '_').replace(/\s+/g, '_');
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
        const orderId = orderIdText.replace(/Compra\s*#\s*|Order\s*#\s*/i, '').trim();

        const sellerUsername = getText('#SellerBuyerInfo .seller-name a[href*="/Users/"]');
        const sellerLocationIcon = document.querySelector('#SellerBuyerInfo .seller-name span.icon[title*="Ubicación del artículo"], #SellerBuyerInfo .seller-name span.icon[title*="Item location"], #SellerBuyerInfo .seller-name span.icon[data-bs-original-title*="Ubicación del artículo"], #SellerBuyerInfo .seller-name span.icon[data-bs-original-title*="Item location"]');
        const sellerLocationRaw = sellerLocationIcon ? (sellerLocationIcon.getAttribute('title') || sellerLocationIcon.getAttribute('data-bs-original-title')) : '';
        const sellerLocation = sellerLocationRaw.replace(/Ubicación del artículo:\s*|Item location:\s*/i, '').trim();


        const timeline = {};
        document.querySelectorAll('#Timeline .timeline-box').forEach(box => {
            const statusDiv = box.querySelector('div:nth-child(1)');
            const dateTimeDiv = box.querySelector('div:nth-child(2)');
            if (statusDiv && dateTimeDiv) {
                const status = statusDiv.textContent.replace(':', '').trim();
                const dateTime = dateTimeDiv.textContent.trim().replace(/\s+/g, ' '); // Normaliza espacios
                timeline[status] = dateTime;
            }
        });
         // Fallback si la estructura anterior no funciona (menos específico)
         if (Object.keys(timeline).length === 0) {
             document.querySelectorAll('#Timeline .timeline-box').forEach(box => {
                const parts = box.textContent.trim().split(':');
                if (parts.length >= 2) {
                    const status = parts[0].trim();
                    const dateTime = parts.slice(1).join(':').trim().replace(/\s+/g, ' ');
                    timeline[status] = dateTime;
                }
            });
        }

        const summaryDiv = document.querySelector('#collapsibleBuyerShipmentSummary .summary');
        let articleCount = '', itemValue = '', shippingPrice = '', totalPrice = '', trustServiceCost = '0';

        if (summaryDiv && summaryDiv.dataset.articleCount) { // Nueva estructura con data-attributes
            articleCount = summaryDiv.dataset.articleCount || '';
            itemValue = summaryDiv.dataset.itemValue || '';
            shippingPrice = summaryDiv.dataset.shippingPrice || '';
            totalPrice = summaryDiv.dataset.totalPrice || '';
            trustServiceCost = summaryDiv.dataset.internalInsurance || '0'; // Puede llamarse diferente, ajustar si es necesario
        } else { // Estructura antigua o fallback
            articleCount = getText('#collapsibleBuyerShipmentSummary .d-flex span.article-count, #collapsibleBuyerShipmentSummary span.article-count')?.replace(/\s*Artículos|\s*Articles/i, '').trim();
            itemValue = getText('#collapsibleBuyerShipmentSummary .d-flex span.item-value, #collapsibleBuyerShipmentSummary span.item-value')?.replace(/[€$]/g, '').trim();
            shippingPrice = getText('#collapsibleBuyerShipmentSummary .d-flex span.shipping-price, #collapsibleBuyerShipmentSummary span.shipping-price')?.replace(/[€$]/g, '').trim();
            const trustServiceElement = Array.from(document.querySelectorAll('#collapsibleBuyerShipmentSummary .d-flex'))
                                          .find(el => el.querySelector('span.flex-grow-1')?.textContent.match(/Servicio TRUST|TRUST Service/i));
            if (trustServiceElement) {
                trustServiceCost = trustServiceElement.querySelector('span:not(.flex-grow-1)')?.textContent.replace(/[€$]/g, '').trim() || '0';
            }
            totalPrice = getText('#labelBuyerShipmentSummary strong, #collapsibleBuyerShipmentSummary .d-flex.total span.strong.total, #collapsibleBuyerShipmentSummary .d-flex span.total.strong')?.replace(/[()€$\s]/g, '').trim();
        }


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
            // Intenta obtener el nombre del método de envío, que puede ser un nodo de texto o un span
            let firstChildNode = shippingMethodDd.childNodes[1]; // Saltar el icono de info
            if (firstChildNode && firstChildNode.nodeType === Node.TEXT_NODE) {
                shippingMethodName = firstChildNode.textContent.trim();
            } else if (firstChildNode && firstChildNode.nodeType === Node.ELEMENT_NODE && firstChildNode.tagName === 'SPAN' && !firstChildNode.classList.contains('ms-1') /*Evitar el "(max. Xg)"*/) {
                 shippingMethodName = firstChildNode.textContent.trim();
            } else {
                // Fallback más general si la estructura es diferente
                const allNodes = Array.from(shippingMethodDd.childNodes);
                const textNode = allNodes.find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
                if (textNode) shippingMethodName = textNode.textContent.trim();
                else if (shippingMethodDd.querySelector('span:not([class])')) shippingMethodName = shippingMethodDd.querySelector('span:not([class])').textContent.trim(); // Último recurso
            }

            const trackingInfoDiv = shippingMethodDd.querySelector('div.text-success, div.text-danger'); // Contenedor de "con seguimiento" / "Servicio TRUST"
            if (trackingInfoDiv) {
                const trackingText = trackingInfoDiv.textContent.toLowerCase();
                if (trackingText.includes('con seguimiento') || trackingText.includes('with tracking')) shippingTracked = 'Sí';
                else if (trackingText.includes('envío no certificado') || trackingText.includes('untracked shipping')) shippingTracked = 'No';

                if (trackingText.includes('servicio trust') || trackingText.includes('trust service')) {
                    shippingTrust = trackingText.includes(' no') ? 'No' : 'Sí'; // "Servicio TRUST Sí" o "Servicio TRUST No"
                }
            }
        }


        const evalDiv = document.querySelector('#collapsibleEvaluation');
        let evalDate = '', evalOverall = '', evalItemDesc = '', evalPackaging = '', evalComment = '';
        if (evalDiv) {
            const evalDateEl = evalDiv.querySelector('.d-flex.justify-content-between > div'); // La fecha está en un div al lado del título "Evaluación"
            evalDate = evalDateEl ? evalDateEl.textContent.trim().replace(/\s+/g, ' ') : '';

            const dts = evalDiv.querySelectorAll('dl dt'); // Títulos de las categorías de evaluación
            dts.forEach(dt => {
                const dd = dt.nextElementSibling; // El valor de la evaluación
                if (dd) {
                    const ratingSpan = dd.querySelector('span[title], span[data-bs-original-title]'); // El icono con el tooltip
                    const ratingTextItalic = dd.querySelector('.fst-italic'); // El texto en cursiva (Muy Bien, Bien, etc.)
                    let rating = '';

                    if (ratingSpan) rating = ratingSpan.getAttribute('title') || ratingSpan.getAttribute('data-bs-original-title'); // Obtener el valor del tooltip (p.ej. "Very Good")
                    if (ratingTextItalic && ratingTextItalic.textContent.trim()) { // Obtener el texto visible
                        rating = ratingTextItalic.textContent.trim() + (rating ? ` (${rating})` : ''); // Combinarlos si ambos existen
                    } else if (!rating && dd.textContent.trim()) { // Fallback al texto completo del dd si no hay estructura específica
                        rating = dd.textContent.trim();
                    }

                    const dtText = dt.textContent.toLowerCase();
                    if (dtText.includes('evaluación general') || dtText.includes('overall evaluation')) evalOverall = rating;
                    else if (dtText.includes('descripción del artículo') || dtText.includes('item description')) evalItemDesc = rating;
                    else if (dtText.includes('empaquetado') || dtText.includes('packaging')) evalPackaging = rating;
                    else if (dtText.includes('comentario') || dtText.includes('comment')) evalComment = dd.querySelector('.fst-italic')?.textContent.trim() || dd.textContent.trim(); // Para el comentario, solo el texto
                }
            });
        }

        const generalHeaders = [
            'OrderID', 'SellerUsername', 'SellerLocation', 'SellerDisplayName', 'SellerStreet', 'SellerCityZip', 'SellerCountry',
            'DatePaid', 'DateShipped', 'DateReceived',
            'ArticleCount', 'ItemValue', 'ShippingCost', 'TrustServiceCost', 'TotalPrice',
            'BuyerName', 'BuyerStreet', 'BuyerCityZip', 'BuyerCountry',
            'ShippingMethod', 'ShippingTracked', 'ShippingTrustService',
            'EvaluationDate', 'EvalOverall', 'EvalItemDesc', 'EvalPackaging', 'EvalComment'
        ];
        csvRows.push(generalHeaders.map(sanitizeForCSV).join(','));
        const generalData = [
            orderId, sellerUsername, sellerLocation, sellerDisplayName, sellerStreet, sellerCityZip, sellerCountry,
            timeline['Pagado'] || timeline['Paid'] || '',
            timeline['Enviado'] || timeline['Shipped'] || '',
            timeline['Recibido'] || timeline['Received'] || '',
            articleCount, itemValue, shippingPrice, trustServiceCost, totalPrice,
            buyerName, buyerStreet, buyerCityZip, buyerCountry,
            shippingMethodName, shippingTracked, shippingTrust,
            evalDate, evalOverall, evalItemDesc, evalPackaging, evalComment
        ];
        csvRows.push(generalData.map(sanitizeForCSV).join(','));
        csvRows.push(''); // Blank row

        const articleTables = document.querySelectorAll('table.product-table');
        if (articleTables.length === 0) {
            console.error("No article tables found!");
            alert("No se pudo encontrar ninguna tabla de artículos.");
            return;
        }

        articleTables.forEach(articleTable => {
            const categoryHeaderElement = articleTable.closest('.category-subsection')?.querySelector('h3');
            const categoryName = categoryHeaderElement ? categoryHeaderElement.textContent.trim() : 'Artículos';
            const isPokemonCategory = categoryName.toLowerCase().includes('pokémon') || categoryName.toLowerCase().includes('pokemon');

            csvRows.push([sanitizeForCSV(`--- ${categoryName} ---`)].join(','));

            let articleHeaders = [
                'ArticleID', 'ProductID', 'Quantity', 'Name', 'LocalizedName', 'Expansion',
                'CollectorNum', 'Rarity', 'Condition', 'Language'
            ];

            if (isPokemonCategory) {
                articleHeaders.push('IsReverseHolo', 'IsFirstEdition');
            } else { // For Magic and others
                articleHeaders.push('IsFoil', 'IsPlayset');
            }
            // Common extras for all (after game-specific ones)
            articleHeaders.push('IsSigned', 'IsAltered');
            // Common final columns
            articleHeaders.push('PricePerUnit', 'Comment');

            csvRows.push(articleHeaders.map(sanitizeForCSV).join(','));

            const articleRows = articleTable.querySelectorAll('tbody tr[data-article-id]'); // Filas de artículos
            articleRows.forEach(row => { // row es el elemento <tr>
                const articleData = [];

                // Datos directamente del <tr> o sus celdas más predecibles
                articleData.push(row.dataset.articleId || '');
                articleData.push(row.dataset.productId || '');
                articleData.push(getText('td.amount', row).replace('x', '').trim());
                const cardName = getText('td.name a', row); // Nombre principal
                const localizedCardName = getText('td.name div.small', row); // Nombre localizado/secundario
                articleData.push(cardName);
                articleData.push(localizedCardName);

                const infoCell = row.querySelector('td.info'); // Celda "Información"

                // Expansión
                articleData.push(infoCell ? (getAttr('div.expansion a', 'title', infoCell) || getAttr('div.expansion a', 'data-bs-original-title', infoCell) || row.dataset.expansionName || '') : (row.dataset.expansionName || ''));
                // Número de coleccionista
                articleData.push(infoCell ? getText('span.collector-num', infoCell) : '');
                // Rareza
                let rarityText = '';
                if (infoCell) {
                    const raritySymbolElement = infoCell.querySelector('span.rarity-symbol');
                    if (raritySymbolElement) {
                        // Prioridad: title del SVG, title del span, data-bs-original-title del span
                        rarityText = raritySymbolElement.querySelector('svg')?.getAttribute('title') ||
                                     raritySymbolElement.getAttribute('title') ||
                                     raritySymbolElement.getAttribute('data-bs-original-title');
                    }
                    // Fallback para Pokémon si no se encontró rareza en el símbolo
                    if (!rarityText && isPokemonCategory) {
                        const textElements = infoCell.querySelectorAll('div:not(.expansion):not(.col-icon):not(.col-extras) > *:not(a):not(span.badge):not(span.icon):not(.collector-num):not(.rarity-symbol), span:not(.badge):not(.icon):not(.collector-num):not(.extras):not(.expansion-symbol):not(.rarity-symbol)');
                        for (const el of textElements) {
                            const text = el.textContent.trim();
                            if (text && text.length > 1 && text.length < 40 && text !== localizedCardName && text !== cardName &&
                                text.match(/\b(Common|Uncommon|Rare|Mythic|Special|Holo|Reverse|Radiant|Amazing|Secret|Hyper|Art|Illustration|VMAX|VSTAR|GX|ex|EX|V|BREAK|Promo|Trainer Gallery|CHR|CSR)\b/i)) {
                                rarityText = text;
                                break;
                            }
                        }
                    }
                }
                articleData.push(rarityText || '');
                // Condición
                articleData.push(infoCell ? getText('a.article-condition span.badge', infoCell) : '');

                // === Language (SIEMPRE de data-language del <tr>) ===
                const languageValue = row.getAttribute('data-language');
                articleData.push(languageValue || '');
                // === Fin Language ===

                // Extras (Foil, Playset, Signed, Altered)
                let isFoil = 'No', isReverseHolo = 'No', isFirstEdition = 'No',
                    isSigned = 'No', isAltered = 'No', isPlayset = 'No';

                if (infoCell) {
                    const extrasSpan = infoCell.querySelector('span.extras');
                    if (extrasSpan) {
                        const icons = extrasSpan.querySelectorAll('span.icon');
                        icons.forEach(icon => {
                            const title = (icon.getAttribute('title') || icon.getAttribute('data-bs-original-title') || '').toLowerCase();
                            if (isPokemonCategory) {
                                if (title.includes('reverse holo') || title.includes('reverse foil')) isReverseHolo = 'Sí';
                                if (title.includes('first edition') || title.includes('primera edición')) isFirstEdition = 'Sí';
                            } else {
                                if ((title.includes('foil') || title.includes('holo')) && !title.includes('reverse')) isFoil = 'Sí';
                                if (title.includes('playset')) isPlayset = 'Sí';
                            }
                            if (title.includes('firmado') || title.includes('signed')) isSigned = 'Sí';
                            if (title.includes('alterado') || title.includes('altered')) isAltered = 'Sí';
                        });
                    }
                }

                if (isPokemonCategory) {
                    articleData.push(isReverseHolo, isFirstEdition);
                } else {
                    articleData.push(isFoil, isPlayset);
                }
                articleData.push(isSigned, isAltered);

                // Precio por unidad
                articleData.push(getText('td.price', row).replace(/[€$]/g, '').trim());
                // Comentario
                articleData.push(infoCell ? getText('p.comment', infoCell) : '');

                csvRows.push(articleData.map(sanitizeForCSV).join(','));
            });
            csvRows.push(''); // Blank row after each category
        });

        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${year}${month}${day}`;
        const safeSellerUsername = sanitizeForFilename(sellerUsername);

        const csvFilename = `cardmarket_${formattedDate}_${safeSellerUsername}_order_${orderId || 'export'}.csv`;
        const csvString = csvRows.join('\n');
        downloadCSV(csvString, csvFilename);
    }

    function downloadCSV(csvContent, fileName) {
        const BOM = "\uFEFF"; // Byte Order Mark para UTF-8
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) { // Check for browser support
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up
        } else {
            // Fallback for browsers that don't support the download attribute
            console.error("Download attribute not supported. CSV content logged to console.");
            console.log(csvContent);
            GM_setClipboard(BOM + csvContent);
            alert("El navegador no soporta la descarga directa. El CSV se ha copiado al portapapeles y se ha mostrado en la consola. Asegúrate de pegar en un editor que entienda UTF-8.");
        }
    }

    // Crear y añadir el botón
    if (!document.querySelector('.export-csv-button')) {
        const exportButton = document.createElement('button');
        exportButton.textContent = `Exportar Pedido a CSV (v${SCRIPT_VERSION})`;
        exportButton.className = 'export-csv-button';
        exportButton.addEventListener('click', extractOrderData);
        document.body.appendChild(exportButton);
    }

})();
