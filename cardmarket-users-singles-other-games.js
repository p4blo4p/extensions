// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Muestra contadores de otros juegos, corrigiendo el error del selector y optimizando caché.
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

    // Tiempo de vida del caché: 24 horas
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; 
    // Cambio de clave para invalidar cachés anteriores con el bug del "0"
    const CACHE_PREFIX = 'cm_mg_v2_'; 

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
            /* Fix scroll móvil */
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
        // Si count es null, mostramos "Err" para distinguirlo de un 0 real
        countSpan.textContent = (count !== null) ? count : 'Err';
    }

    function fetchSinglesCount(url, username, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 10000,
            onload: function(response) {
                if (response.status !== 200) { callback(null); return; }

                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                // CORRECCIÓN CRÍTICA:
                // Buscamos el enlace que TERMINA en /Offers/Singles
                // PERO ASEGURAMOS que contenga el nombre de usuario en la URL
                // Esto evita confundirse con enlaces de navegación o del usuario logueado.
                const singlesLink = doc.querySelector(`a[href*="/${username}/"][href$="/Offers/Singles"]`);

                if (singlesLink) {
                    const countSpan = singlesLink.querySelector('span.bracketed');
                    if (countSpan) {
                        callback(countSpan.textContent.trim());
                        return;
                    }
                }
                callback(null);
            },
            onerror: () => callback(null),
            ontimeout: () => callback(null)
        });
    }

    // --- EJECUCIÓN ---

    const context = getCurrentContext();
    if (!context) return;

    const container = getContainer();
    if (!container) return;

    for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
        if (gameId === context.currentGame) continue;

        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;
        const cacheKey = getCacheKey(context.username, gameId);

        const cardElement = createCardElement(gameName, '...');
        container.appendChild(cardElement);

        const cachedCount = getFromCache(cacheKey);

        if (cachedCount !== null) {
            updateCardElement(cardElement, targetUrl, cachedCount);
        } else {
            // Pasamos 'username' a la función de fetch para el selector preciso
            fetchSinglesCount(targetUrl, context.username, (count) => {
                const finalCount = (count !== null) ? count : 'Err';
                updateCardElement(cardElement, targetUrl, finalCount);
                
                // Solo guardamos en caché si obtuvimos un dato válido (incluso si es "0")
                // No guardamos errores ("Err"/null)
                if (count !== null) {
                    saveToCache(cacheKey, count);
                }
            });
        }
    }

})();
