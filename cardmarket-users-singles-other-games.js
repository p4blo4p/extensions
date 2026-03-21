// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter - FIXED
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Cuenta cartas de otros juegos. Fix: Corregido error de inserción DOM.
// @author       TuAsistente
// @match        https://www.cardmarket.com/*/*/Users/*
// @match        https://www.cardmarket.com/*/*/Users/Offers/*
// @icon         https://www.cardmarket.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      www.cardmarket.com
// @run-at        document-end
// ==/UserScript==
 
(function() {
    'use strict';
 
    // --- CONFIGURACIÓN ---
    const TARGET_GAMES = {
        'Pokemon': 'Pokémon',
        'Magic': 'Magic',
        'YuGiOh': 'Yu-Gi-Oh!',
        'DragonBallSuper': 'Dragon Ball Super',
        'Lorcana': 'Lorcana',
        'Riftbound': 'Riftbound'
    };
 
    // Caché: 24 horas
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; 
    const CACHE_PREFIX = 'cm_mg_v10_'; // Versión actualizada
    const MAX_CONCURRENT_REQUESTS = 2; 
    const REQUEST_TIMEOUT_MS = 15000; 
 
    // --- ESTILOS CSS ---
    GM_addStyle(`
        .cm-multigame-container { margin-bottom: 1rem; }
        .cm-multigame-card {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            transition: background-color 0.2s;
            text-decoration: none !important;
            display: block;
            touch-action: pan-y; 
            user-select: none;
            -webkit-user-select: none;
        }
        .cm-multigame-card:hover, .cm-multigame-card:active {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
            text-decoration: none;
        }
        .cm-multigame-card .card-title { color: #fff; font-size: 1rem; margin-bottom: 0; }
        .cm-multigame-card .bracketed { color: #aaa !important; }
        .cm-multigame-card.loading .bracketed { color: #ffc107 !important; }
        .cm-multigame-card.error .bracketed { color: #dc3545 !important; }
        .cm-multigame-card.zero .bracketed { color: #6c757d !important; }
        @media (max-width: 768px) { .cm-multigame-card .card-title { font-size: 0.9rem; } }
    `);
 
    // --- GESTIÓN DE CACHÉ ---
 
    function getCacheKey(username, gameId) {
        return `${CACHE_PREFIX}${username}_${gameId}`;
    }
 
    function getFromCache(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const data = JSON.parse(item);
            if (Date.now() - data.timestamp > CACHE_DURATION_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return data.count;
        } catch (e) { 
            console.error('Error reading cache:', e);
            return null; 
        }
    }
 
    function saveToCache(key, count) {
        if (count === null || count === undefined) return;
        try {
            localStorage.setItem(key, JSON.stringify({ count: count, timestamp: Date.now() }));
        } catch (e) { console.error('Error saving cache:', e); }
    }
 
    // --- LÓGICA PRINCIPAL ---
 
    function getCurrentContext() {
        const path = window.location.pathname;
        const match = path.match(/^\/([a-z]{2})\/([a-zA-Z]+)\/Users\/([a-zA-Z0-9_-]+)/);
        if (match) {
            const username = match[3];
            if (username.length > 0 && username.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(username)) {
                return { lang: match[1], currentGame: match[2], username: username };
            }
        }
        return null;
    }
 
    /**
     * FUNCIÓN CORREGIDA - Manejo seguro de inserción DOM
     */
    function getContainer() {
        // 1. Intentar usar el contenedor móvil existente si está presente
        let container = document.querySelector('#UserProductsMobile');
        if (container) {
             if (!container.classList.contains('row')) container.classList.add('row', 'g-0');
             return container;
        }

        // 2. Si no, crear nuestro propio contenedor dentro de <main>
        const main = document.querySelector('main.container');
        if (main) {
            let existingDynamic = document.getElementById('cm-dynamic-container');
            if (existingDynamic) return existingDynamic.querySelector('#cm-dynamic-row');

            let dynamicContainer = document.createElement('div');
            dynamicContainer.id = 'cm-dynamic-container';
            dynamicContainer.className = 'container cm-multigame-container';
            dynamicContainer.innerHTML = '<div class="d-flex justify-content-between align-items-center w-100 mb-3 pb-1 border-bottom border-light"><h2>Otros Juegos</h2></div><div class="row g-0" id="cm-dynamic-row"></div>';
            
            // Lista de posibles elementos de referencia para insertar ANTES de ellos
            const referenceSelectors = [
                '#EvaluationsH2',         // Cabecera de evaluaciones
                '.table-responsive',      // Tabla de artículos
                'section',                // Sección general
                'h2',                     // Cualquier título H2
                '.row'                    // Cualquier fila
            ];
            
            let inserted = false;

            for (let selector of referenceSelectors) {
                const refElement = main.querySelector(selector);
                
                if (refElement) {
                    // IMPORTANTE: Debemos encontrar el ancestro que sea HIJO DIRECTO de <main>
                    // para que insertBefore funcione correctamente.
                    let insertionPoint = refElement;
                    while (insertionPoint && insertionPoint.parentNode !== main) {
                        insertionPoint = insertionPoint.parentNode;
                    }

                    // Si encontramos un hijo directo de main, insertamos antes de ese bloque
                    if (insertionPoint && insertionPoint.parentNode === main) {
                        main.insertBefore(dynamicContainer, insertionPoint);
                        inserted = true;
                        break; // Salimos del bucle porque ya insertamos
                    }
                }
            }
            
            // Si no encontramos ningún punto bueno, lo añadimos al final
            if (!inserted) {
                main.appendChild(dynamicContainer);
            }
            
            return dynamicContainer.querySelector('#cm-dynamic-row');
        }
        return null;
    }
 
    function createCardElement(gameName, initialCount = '...') {
        const div = document.createElement('div');
        div.className = 'col-12 col-md-6 col-xl-3';
        div.innerHTML = `
            <a href="#" class="card text-center w-100 galleryBox mb-3 mb-md-4 cm-multigame-card loading">
                <div class="card-body d-flex flex-column justify-content-center" style="min-height: 100px;">
                    <h3 class="card-title">
                        <span>${gameName}</span>
                        <span class="bracketed text-muted small ms-2">${initialCount}</span>
                    </h3>
                </div>
            </a>
        `;
        return div;
    }
 
    function updateCardElement(element, url, count) {
        const link = element.querySelector('a');
        const countSpan = element.querySelector('.bracketed');
        const card = element.querySelector('.cm-multigame-card');
        
        link.href = url;
        card.classList.remove('loading', 'error', 'zero');
        
        if (count === null) {
            countSpan.textContent = 'Err';
            card.classList.add('error');
        } else if (count === '...') {
            countSpan.textContent = '...';
            card.classList.add('loading');
        } else if (count === '0') {
            countSpan.textContent = '0';
            card.classList.add('zero');
        } else {
            countSpan.textContent = count;
        }
    }
 
    function extractCountFromDOM(doc) {
        try {
            // Estrategia 1: Selector principal estándar
            let productContainer = doc.querySelector('#UserProductsMobile');
            if (productContainer) {
                let singlesLink = productContainer.querySelector('a[href*="/Singles"]');
                if (singlesLink) {
                    let countSpan = singlesLink.querySelector('span.bracketed');
                    if (countSpan) {
                        let text = countSpan.textContent.trim();
                        if (/^\d+$/.test(text)) return text;
                    }
                    return '0';
                }
            }
            
            // Estrategia 2: Buscar link /Singles en otros lugares
            let allSinglesLinks = doc.querySelectorAll('a[href*="/Singles"]');
            for (let link of allSinglesLinks) {
                let countSpan = link.querySelector('span.bracketed, .text-muted');
                if (countSpan) {
                    let text = countSpan.textContent.trim();
                    let match = text.match(/\d+/);
                    if (match) return match[0];
                }
            }
            
            // Estrategia 3: Buscar números entre paréntesis
            let allElements = doc.querySelectorAll('span, div, a');
            for (let elem of allElements) {
                let text = elem.textContent.trim();
                if (text && /^\(\d+\)$/.test(text)) {
                    let num = text.replace(/[()]/g, '');
                    return num;
                }
            }
            
            return '0';
            
        } catch (e) {
            console.error('Error extrayendo conteo:', e);
            return null;
        }
    }
 
    // --- GESTIÓN DE SOLICITUDES ---
 
    let activeRequests = 0;
    const requestQueue = [];
 
    function makeGMRequest(url, callbacks) {
        if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
            requestQueue.push({ url, callbacks });
            return;
        }
 
        activeRequests++;
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': document.documentElement.lang || 'es'
            },
            onload: (response) => {
                activeRequests--;
                processQueue();
                if (callbacks.onload) callbacks.onload(response);
            },
            onerror: () => {
                activeRequests--;
                processQueue();
                if (callbacks.onerror) callbacks.onerror();
            },
            ontimeout: () => {
                activeRequests--;
                processQueue();
                if (callbacks.ontimeout) callbacks.ontimeout();
            }
        });
    }
 
    function processQueue() {
        if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
            const next = requestQueue.shift();
            makeGMRequest(next.url, next.callbacks);
        }
    }
 
    // --- EJECUCIÓN PRINCIPAL ---
 
    console.log('Iniciando Cardmarket Multi-Game Singles Counter...');
    
    const context = getCurrentContext();
    if (!context) return;
    
    const container = getContainer();
    if (!container) return;

    // 1. Guardar dato del juego actual
    const cacheKeyCurrent = getCacheKey(context.username, context.currentGame);
    const currentCount = extractCountFromDOM(document);
    if (currentCount !== null) saveToCache(cacheKeyCurrent, currentCount);

    // 2. Generar tarjetas para OTROS juegos
    const gamesToProcess = Object.entries(TARGET_GAMES).filter(([gameId]) => gameId !== context.currentGame);
 
    gamesToProcess.forEach(([gameId, gameName]) => {
        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;
        const cacheKey = getCacheKey(context.username, gameId);

        const cardElement = createCardElement(gameName, '...');
        container.appendChild(cardElement);

        const cachedCount = getFromCache(cacheKey);
 
        if (cachedCount !== null) {
            updateCardElement(cardElement, targetUrl, cachedCount);
        } else {
            makeGMRequest(targetUrl, {
                onload: function(response) {
                    if (response.status !== 200) {
                        updateCardElement(cardElement, targetUrl, null);
                        return;
                    }
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const count = extractCountFromDOM(doc);
                        if (count !== null) {
                            saveToCache(cacheKey, count);
                            updateCardElement(cardElement, targetUrl, count);
                        } else {
                            updateCardElement(cardElement, targetUrl, null);
                        }
                    } catch (e) {
                        updateCardElement(cardElement, targetUrl, null);
                    }
                },
                onerror: () => updateCardElement(cardElement, targetUrl, null),
                ontimeout: () => updateCardElement(cardElement, targetUrl, null)
            });
        }
    });
 
})();
