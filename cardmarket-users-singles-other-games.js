// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Cuenta cartas de otros juegos. Status 200 sin tarjeta = 0. Cache optimizado.
// @author       TuAsistente
// @match        https://www.cardmarket.com/*/*/Users/*
// @match        https://www.cardmarket.com/*/*/Users/Offers/*
// @icon         https://www.cardmarket.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      www.cardmarket.com
// @run-at       document-end
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
    const CACHE_PREFIX = 'cm_mg_v7_'; // Nueva versión para limpiar cachés anteriores
    const MAX_CONCURRENT_REQUESTS = 3; // Límite de solicitudes simultáneas
    const REQUEST_TIMEOUT_MS = 10000;
 
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
        // Guardamos incluso si es '0' para no repetir peticiones innecesarias
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
            // Validación básica del username
            if (username.length > 0 && username.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(username)) {
                return { lang: match[1], currentGame: match[2], username: username };
            }
        }
        return null;
    }
 
    function getContainer() {
        let container = document.querySelector('#UserProductsMobile');
        if (container) {
             if (!container.classList.contains('row')) container.classList.add('row', 'g-0');
             return container;
        }
 
        const main = document.querySelector('main.container');
        if (main) {
            let existingDynamic = document.getElementById('cm-dynamic-container');
            if (existingDynamic) return existingDynamic.querySelector('#cm-dynamic-row');
 
            let dynamicContainer = document.createElement('div');
            dynamicContainer.id = 'cm-dynamic-container';
            dynamicContainer.className = 'container cm-multigame-container';
            dynamicContainer.innerHTML = '<div class="d-flex justify-content-between align-items-center w-100 mb-3 pb-1 border-bottom border-light"><h2>Otros Juegos</h2></div><div class="row g-0" id="cm-dynamic-row"></div>';
            
            // Mejoramos la lógica de inserción con múltiples fallbacks
            const insertionPoints = [
                main.querySelector('#EvaluationsH2'),
                main.querySelector('.table-responsive'),
                main.querySelector('section'),
                main.querySelector('h2'),
                main.firstElementChild
            ];
            
            for (let point of insertionPoints) {
                if (point) {
                    main.insertBefore(dynamicContainer, point.parentNode || point);
                    return dynamicContainer.querySelector('#cm-dynamic-row');
                }
            }
            
            // Último recurso: añadir al final
            main.appendChild(dynamicContainer);
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
        
        link.href = url;
        
        if (count === null) {
            countSpan.textContent = 'Err';
            element.querySelector('.cm-multigame-card').classList.remove('loading');
            element.querySelector('.cm-multigame-card').classList.add('error');
        } else if (count === '...') {
            countSpan.textContent = '...';
            element.querySelector('.cm-multigame-card').classList.add('loading');
        } else {
            countSpan.textContent = count;
            element.querySelector('.cm-multigame-card').classList.remove('loading', 'error');
        }
    }
 
    /**
     * Extrae el conteo del DOM.
     * Si no encuentra la tarjeta o hay error, devuelve null.
     * Si encuentra 0 cartas, devuelve '0'.
     */
    function extractCountFromDOM(doc) {
        try {
            const productContainer = doc.querySelector('#UserProductsMobile');
            // Si existe el contenedor, buscamos el enlace
            if (productContainer) {
                const singlesLink = productContainer.querySelector('a[href$="/Offers/Singles"]');
                if (singlesLink) {
                    const countSpan = singlesLink.querySelector('span.bracketed');
                    if (countSpan) {
                        const text = countSpan.textContent.trim();
                        // Validar que sea un número o '0'
                        if (/^\d+$/.test(text)) return text;
                    }
                }
            }
            // Si no encuentra tarjeta (pero la página cargó), devolvemos null (error)
            return null;
        } catch (e) {
            console.error('Error extracting count from DOM:', e);
            return null;
        }
    }
 
    // --- GESTIÓN DE SOLICITUDES CONCURRENTES ---
 
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
            onload: (response) => {
                activeRequests--;
                processQueue();
                if (callbacks.onload) callbacks.onload(response);
            },
            onerror: () => {
                activeRequests--;
                processQueue();
                console.error(`Error fetching ${url}`);
                if (callbacks.onerror) callbacks.onerror();
            },
            ontimeout: () => {
                activeRequests--;
                processQueue();
                console.error(`Timeout fetching ${url}`);
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
 
    // --- EJECUCIÓN ---
 
    const context = getCurrentContext();
    if (!context) {
        console.log('No valid context found, script aborted');
        return;
    }
 
    const container = getContainer();
    if (!container) {
        console.log('No valid container found, script aborted');
        return;
    }
 
    // 1. Guardar dato ACTUAL
    // Intentamos extraerlo del DOM actual
    let currentCount = extractCountFromDOM(document);
    const cacheKeyCurrent = getCacheKey(context.username, context.currentGame);
 
    // Detectamos si estamos en una página donde el contador es visible (Main Profile)
    const isMainProfilePage = !!document.querySelector('#UserProductsMobile');
    
    if (isMainProfilePage && currentCount !== null) {
        // Solo guardamos si tenemos un valor válido
        saveToCache(cacheKeyCurrent, currentCount);
    } else {
        // Pre-caching: Si estamos en Offers y no tenemos el dato cacheado, pedimos el perfil principal
        if (getFromCache(cacheKeyCurrent) === null) {
             const profileUrl = `https://www.cardmarket.com/${context.lang}/${context.currentGame}/Users/${context.username}`;
             makeGMRequest(profileUrl, {
                onload: function(response) {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const count = extractCountFromDOM(doc);
                        if (count !== null) {
                            saveToCache(cacheKeyCurrent, count);
                        }
                    }
                },
                onerror: function() {
                    console.error('Error precaching current game profile');
                },
                ontimeout: function() {
                    console.error('Timeout precaching current game profile');
                }
            });
        }
    }
 
    // 2. Generar tarjetas OTROS juegos
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
                        updateCardElement(cardElement, targetUrl, null); // Muestra Err
                        return;
                    }
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    
                    // Usamos la función que devuelve null si hay error
                    const count = extractCountFromDOM(doc);
                    
                    updateCardElement(cardElement, targetUrl, count);
                    if (count !== null) {
                        saveToCache(cacheKey, count);
                    }
                },
                onerror: () => updateCardElement(cardElement, targetUrl, null),
                ontimeout: () => updateCardElement(cardElement, targetUrl, null)
            });
        }
    });
 
})();
