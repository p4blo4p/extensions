// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Añade contadores de otros juegos con selector robusto y caché optimizado.
// @author       TuAsistente
// @match        https://www.cardmarket.com/*/Users/*
// @match        https://www.cardmarket.com/*/Users/Offers/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      www.cardmarket.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURACIÓN ---
    const TARGET_GAMES = {
        'Magic': 'Magic',
        'YuGiOh': 'Yu-Gi-Oh!',
        'DragonBallSuper': 'Dragon Ball Super',
        'Lorcana': 'Lorcana',
        'Riftbound': 'Riftbound'
    };

    // Caché: 24 horas
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; 
    const CACHE_PREFIX = 'cm_mg_v3_'; // Nuevo prefijo para limpiar cachés rotas anteriores

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
        try {
            localStorage.setItem(key, JSON.stringify({ count: count, timestamp: Date.now() }));
        } catch (e) { console.error('Error saving cache', e); }
    }

    // --- LÓGICA PRINCIPAL ---

    function getCurrentContext() {
        const path = window.location.pathname;
        const match = path.match(/^\/([a-z]{2})\/([a-zA-Z]+)\/Users\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return { lang: match[1], currentGame: match[2], username: match[3] };
        }
        return null;
    }

    function getContainer() {
        let container = document.querySelector('#UserProductsMobile');
        if (!container) {
            const main = document.querySelector('main.container');
            if (main) {
                let existingDynamic = document.getElementById('cm-dynamic-container');
                if (existingDynamic) return existingDynamic.querySelector('#cm-dynamic-row');

                let dynamicContainer = document.createElement('div');
                dynamicContainer.id = 'cm-dynamic-container';
                dynamicContainer.className = 'container cm-multigame-container';
                dynamicContainer.innerHTML = '<div class="d-flex justify-content-between align-items-center w-100 mb-3 pb-1 border-bottom border-light"><h2>Otros Juegos</h2></div><div class="row g-0" id="cm-dynamic-row"></div>';
                main.insertBefore(dynamicContainer, main.firstChild.nextSibling);
                return dynamicContainer.querySelector('#cm-dynamic-row');
            }
        } else {
            if (!container.classList.contains('row')) container.classList.add('row', 'g-0');
            return container;
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
     * Extrae el conteo del DOM.
     * Si isRemote es false, busca en el documento actual (optimización juego actual).
     * Si isRemote es true, busca en el documento parseado de la petición AJAX.
     */
    function extractCountFromDOM(doc, isRemote = false) {
        // Estrategia: Buscar el contenedor de productos #UserProductsMobile
        // Dentro de ese contenedor, buscar el enlace a Singles.
        // Esto es mucho más seguro que buscar en todo el documento porque aísla la zona del perfil.
        const productContainer = doc.querySelector('#UserProductsMobile');
        
        if (productContainer) {
            // Busca el enlace que termina en /Offers/Singles DENTRO del contenedor del usuario
            const singlesLink = productContainer.querySelector('a[href$="/Offers/Singles"]');
            if (singlesLink) {
                const countSpan = singlesLink.querySelector('span.bracketed');
                if (countSpan) {
                    return countSpan.textContent.trim();
                }
            }
        }
        return null;
    }

    // --- EJECUCIÓN ---

    const context = getCurrentContext();
    if (!context) return;

    const container = getContainer();
    if (!container) return;

    // Iteramos sobre los juegos
    for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
        
        // COMPORTAMIENTO:
        // Si es el juego actual, podríamos obtener el dato directamente del DOM sin peticiones.
        // Sin embargo, visualmente ya tenemos esa tarjeta en la página principal.
        // Por defecto saltamos el juego actual para no duplicar la tarjeta.
        // Si deseas forzarlo para verlo en la lista unificada, comenta la siguiente línea.
        if (gameId === context.currentGame) continue; 

        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;
        const cacheKey = getCacheKey(context.username, gameId);

        // Crear tarjeta visual
        const cardElement = createCardElement(gameName, '...');
        container.appendChild(cardElement);

        // Intentar caché
        const cachedCount = getFromCache(cacheKey);
        if (cachedCount !== null) {
            updateCardElement(cardElement, targetUrl, cachedCount);
        } else {
            // Petición fetch
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
                    
                    // Usamos el extractor robusto
                    const count = extractCountFromDOM(doc, true);
                    
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