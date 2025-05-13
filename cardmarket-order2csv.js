// ==UserScript==
// @name         Cardmarket Order Exporter to CSV (Direct Rarity Title & data-language from TR)
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Extracts Cardmarket order details. Uses data-language from TR for Language. Hardcoded version on button for Violentmonkey. Debugging data-language.
// @author       Your Name (Modified by AI)
// @match        https://www.cardmarket.com/*/*/Orders/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // --- CONSTANTE PARA LA VERSIÓN (actualizar manualmente si se cambia @version) ---
    const SCRIPT_VERSION_DISPLAY = "2.0.0";

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
        str = str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
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
        console.log("Iniciando extractOrderData..."); // Depuración
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
                const dateTime = dateTimeDiv.textContent.trim().replace(/\s+/g, ' ');
                timeline[status] = dateTime;
            }
        });
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

        if (summaryDiv && summaryDiv.dataset.articleCount) {
            articleCount = summaryDiv.dataset.articleCount || '';
            itemValue = summaryDiv.dataset.itemValue || '';
            shippingPrice = summaryDiv.dataset.shippingPrice || '';
            totalPrice = summaryDiv.dataset.totalPrice || '';
            trustServiceCost = summaryDiv.dataset.internalInsurance || '0';
        } else {
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
            let firstChildNode = shippingMethodDd.childNodes[1];
            if (firstChildNode && firstChildNode.nodeType === Node.TEXT_NODE) {
                shippingMethodName = firstChildNode.textContent.trim();
            } else if (firstChildNode && firstChildNode.nodeType === Node.ELEMENT_NODE && firstChildNode.tagName === 'SPAN' && !firstChildNode.classList.contains('ms-1')) {
                 shippingMethodName = firstChildNode.textContent.trim();
            } else {
                const allNodes = Array.from(shippingMethodDd.childNodes);
                const textNode = allNodes.find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
                if (textNode) shippingMethodName = textNode.textContent.trim();
                else if (shippingMethodDd.querySelector('span:not([class])')) shippingMethodName = shippingMethodDd.querySelector('span:not([class])').textContent.trim();
            }

            const trackingInfoDiv = shippingMethodDd.querySelector('div.text-success, div.text-danger');
            if (trackingInfoDiv) {
                const trackingText = trackingInfoDiv.textContent.toLowerCase();
                if (trackingText.includes('con seguimiento') || trackingText.includes('with tracking')) shippingTracked = 'Sí';
                else if (trackingText.includes('envío no certificado') || trackingText.includes('untracked shipping')) shippingTracked = 'No';

                if (trackingText.includes('servicio trust') || trackingText.includes('trust service')) {
                    shippingTrust = trackingText.includes(' no') ? 'No' : 'Sí';
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
                    const ratingSpan = dd.querySelector('span[title], span[data-bs-original-title]');
                    const ratingTextItalic = dd.querySelector('.fst-italic');
                    let rating = '';

                    if (ratingSpan) rating = ratingSpan.getAttribute('title') || ratingSpan.getAttribute('data-bs-original-title');
                    if (ratingTextItalic && ratingTextItalic.textContent.trim()) {
                        rating = ratingTextItalic.textContent.trim() + (rating ? ` (${rating})` : '');
                    } else if (!rating && dd.textContent.trim()) {
                        rating = dd.textContent.trim();
                    }

                    const dtText = dt.textContent.toLowerCase();
                    if (dtText.includes('evaluación general') || dtText.includes('overall evaluation')) evalOverall = rating;
                    else if (dtText.includes('descripción del artículo') || dtText.includes('item description')) evalItemDesc = rating;
                    else if (dtText.includes('empaquetado') || dtText.includes('packaging')) evalPackaging = rating;
                    else if (dtText.includes('comentario') || dtText.includes('comment')) evalComment = dd.querySelector('.fst-italic')?.textContent.trim() || dd.textContent.trim();
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
        csvRows.push('');

        const articleTables = document.querySelectorAll('table.product-table');
        if (articleTables.length === 0) {
            console.error("No article tables found!");
            alert("No se pudo encontrar ninguna tabla de artículos.");
            return;
        }
        console.log(`Encontradas ${articleTables.length} tablas de artículos.`); // Depuración

        articleTables.forEach((articleTable, tableIndex) => {
            console.log(`Procesando tabla de artículos #${tableIndex + 1}`); // Depuración
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
            } else {
                articleHeaders.push('IsFoil', 'IsPlayset');
            }
            articleHeaders.push('IsSigned', 'IsAltered');
            articleHeaders.push('PricePerUnit', 'Comment');

            csvRows.push(articleHeaders.map(sanitizeForCSV).join(','));

            const articleRows = articleTable.querySelectorAll('tbody tr[data-article-id]');
            console.log(`Tabla #${tableIndex + 1}: Encontradas ${articleRows.length} filas de artículos (TRs).`); // Depuración

            articleRows.forEach((row, rowIndex) => { // row es el elemento <tr>
                // --- INICIO DE LA DEPURACIÓN DETALLADA PARA data-language ---
                const articleIdForDebug = row.dataset.articleId || 'ID DESCONOCIDO';
                console.log(`Procesando fila #${rowIndex + 1} (Article ID: ${articleIdForDebug})`);
                console.log('Elemento TR completo:', row); // Muestra el elemento TR en la consola
                const languageAttrValue = row.getAttribute('data-language');
                console.log(`Valor de data-language para Article ID ${articleIdForDebug}: "${languageAttrValue}" (Tipo: ${typeof languageAttrValue})`);
                // --- FIN DE LA DEPURACIÓN DETALLADA ---

                const articleData = [];

                articleData.push(row.dataset.articleId || '');
                articleData.push(row.dataset.productId || '');
                articleData.push(getText('td.amount', row).replace('x', '').trim());
                const cardName = getText('td.name a', row);
                const localizedCardName = getText('td.name div.small', row);
                articleData.push(cardName);
                articleData.push(localizedCardName);

                const infoCell = row.querySelector('td.info');

                articleData.push(infoCell ? (getAttr('div.expansion a', 'title', infoCell) || getAttr('div.expansion a', 'data-bs-original-title', infoCell) || row.dataset.expansionName || '') : (row.dataset.expansionName || ''));
                articleData.push(infoCell ? getText('span.collector-num', infoCell) : '');
                let rarityText = '';
                if (infoCell) {
                    const raritySymbolElement = infoCell.querySelector('span.rarity-symbol');
                    if (raritySymbolElement) {
                        rarityText = raritySymbolElement.querySelector('svg')?.getAttribute('title') ||
                                     raritySymbolElement.getAttribute('title') ||
                                     raritySymbolElement.getAttribute('data-bs-original-title');
                    }
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
                articleData.push(infoCell ? getText('a.article-condition span.badge', infoCell) : '');

                // Usar el valor obtenido en la depuración
                articleData.push(languageAttrValue || ''); // Usar la variable de la depuración

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

                articleData.push(getText('td.price', row).replace(/[€$]/g, '').trim());
                articleData.push(infoCell ? getText('p.comment', infoCell) : '');

                csvRows.push(articleData.map(sanitizeForCSV).join(','));
            });
            csvRows.push('');
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
        console.log("extractOrderData completado."); // Depuración
    }

    function downloadCSV(csvContent, fileName) {
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            console.error("Download attribute not supported. CSV content logged to console.");
            console.log(csvContent);
            GM_setClipboard(BOM + csvContent);
            alert("El navegador no soporta la descarga directa. El CSV se ha copiado al portapapeles y se ha mostrado en la consola. Asegúrate de pegar en un editor que entienda UTF-8.");
        }
    }

    // Crear y añadir el botón
    if (!document.querySelector('.export-csv-button')) {
        const exportButton = document.createElement('button');
        exportButton.textContent = `Exportar Pedido a CSV (v${SCRIPT_VERSION_DISPLAY})`;
        exportButton.className = 'export-csv-button';
        exportButton.addEventListener('click', extractOrderData);
        document.body.appendChild(exportButton);
        console.log("Botón 'Exportar Pedido a CSV' creado con texto:", exportButton.textContent); // Depuración
    } else {
        console.log("El botón 'Exportar Pedido a CSV' ya existe."); // Depuración
    }
    console.log("Script de exportación de pedidos de Cardmarket (Violentmonkey fix attempt) cargado."); // Depuración

})();
