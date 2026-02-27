// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Muestra contadores de otros juegos con pre-carga inteligente y soporte para Pokémon.
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
    const CACHE_PREFIX = 'cm_mg_v5_'; 

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
        } catch (e) { return null; }
    }

    function saveToCache(key, count) {
        if (count === null || count === undefined) return;
        try {
            localStorage.setItem(key, JSON.stringify({ count: count, timestamp: Date.now() }));
        } catch (e) { console.error('Error saving cache', e); }
    }

    // --- LÓGICA PRINCIPAL ---

    function getCurrentContext() {
        const path = window.location.pathname;
        // Captura: idioma, juego, usuario. Ignora el resto de la URL (/Offers/Singles etc)
        // Ejemplo path: /es/Magic/Users/sandramagic
        const match = path.match(/^\/([a-z]{2})\/([a-zA-Z]+)\/Users\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return { lang: match[1], currentGame: match[2], username: match[3] };
        }
        return null;
    }

    function getContainer() {
        // Busca el contenedor en la página principal
        let container = document.querySelector('#UserProductsMobile');
        if (container) {
             if (!container.classList.contains('row')) container.classList.add('row', 'g-0');
             return container;
        }

        // Si no existe (estamos en Offers), creamos un contenedor dinámico
        const main = document.querySelector('main.container');
        if (main) {
            let existingDynamic = document.getElementById('cm-dynamic-container');
            if (existingDynamic) return existingDynamic.querySelector('#cm-dynamic-row');

            let dynamicContainer = document.createElement('div');
            dynamicContainer.id = 'cm-dynamic-container';
            dynamicContainer.className = 'container cm-multigame-container';
            dynamicContainer.innerHTML = '<div class="d-flex justify-content-between align-items-center w-100 mb-3 pb-1 border-bottom border-light"><h2>Otros Juegos</h2></div><div class="row g-0" id="cm-dynamic-row"></div>';
            
            // Insertar después de la info del usuario y antes de las evaluaciones/lista
            let insertionPoint = main.querySelector('#EvaluationsH2') || main.querySelector('.table-responsive') || main.querySelector('section');
            if (insertionPoint) {
                main.insertBefore(dynamicContainer, insertionPoint.parentNode);
            } else {
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
            <a href="#" class="card text-center w-100 galleryBox mb-3 mb-md-4 cm-multigame-card">
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
        countSpan.textContent = (count !== null) ? count : '0';
    }

    /**
     * Intenta extraer el conteo de la página actual.
     * 1. Busca en la tarjeta de "Cartas Sueltas" (Página principal).
     * 2. Busca en la cabecera de la tabla o info (Página Offers).
     */
    function extractCurrentPageCount() {
        // Método A: Página Principal (Card view)
        const productContainer = document.querySelector('#UserProductsMobile');
        if (productContainer) {
            // Buscamos el enlace específico dentro del contenedor
            const singlesLink = productContainer.querySelector('a[href$="/Offers/Singles"]');
            if (singlesLink) {
                const countSpan = singlesLink.querySelector('span.bracketed');
                if (countSpan) return countSpan.textContent.trim();
            }
        }
        return null;
    }

    // --- EJECUCIÓN ---

    const context = getCurrentContext();
    if (!context) return;

    const container = getContainer();
    if (!container) return;

    // 1. Intentar obtener y guardar el dato ACTUAL
    let currentCount = extractCurrentPageCount();
    const cacheKeyCurrent = getCacheKey(context.username, context.currentGame);

    if (currentCount !== null) {
        saveToCache(cacheKeyCurrent, currentCount);
    } else {
        // PRE-CACHING INTELIGENTE:
        // Si estamos en la página de Offers y no vemos el contador, 
        // hacemos una petición silenciosa a la página principal del perfil.
        if (!getFromCache(cacheKeyCurrent)) {
            const profileUrl = `https://www.cardmarket.com/${context.lang}/${context.currentGame}/Users/${context.username}`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: profileUrl,
                onload: function(response) {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const remoteContainer = doc.querySelector('#UserProductsMobile');
                        if (remoteContainer) {
                            const link = remoteContainer.querySelector('a[href$="/Offers/Singles"]');
                            if (link) {
                                const span = link.querySelector('span.bracketed');
                                if (span) {
                                    const count = span.textContent.trim();
                                    saveToCache(cacheKeyCurrent, count);
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // 2. Generar tarjetas para OTROS juegos
    for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
        if (gameId === context.currentGame) continue;

        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;
        const cacheKey = getCacheKey(context.username, gameId);

        // Crear tarjeta visual
        const cardElement = createCardElement(gameName, '...');
        container.appendChild(cardElement);

        // Buscar en caché
        const cachedCount = getFromCache(cacheKey);

        if (cachedCount !== null) {
            // HIT: Mostrar inmediatamente
            updateCardElement(cardElement, targetUrl, cachedCount);
        } else {
            // MISS: Petición AJAX
            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                timeout: 10000,
                onload: function(response) {
                    if (response.status !== 200) {
                        updateCardElement(cardElement, targetUrl, 'Err');
                        return;
                    }
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    
                    const remoteContainer = doc.querySelector('#UserProductsMobile');
                    let count = null;
                    
                    if (remoteContainer) {
                         const link = remoteContainer.querySelector('a[href$="/Offers/Singles"]');
                         if (link) {
                             const span = link.querySelector('span.bracketed');
                             if (span) count = span.textContent.trim();
                         }
                    }
                    
                    updateCardElement(cardElement, targetUrl, count);
                    if (count !== null) {
                        saveToCache(cacheKey, count);
                    }
                },
                onerror: () => updateCardElement(cardElement, targetUrl, 'Err'),
                ontimeout: () => updateCardElement(cardElement, targetUrl, 'Err')
            });
        }
    }

})();