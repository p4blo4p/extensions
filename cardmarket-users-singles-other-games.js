// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Muestra contadores de otros juegos con caché local y UI optimizada para móvil.
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

    // Tiempo de vida del caché en milisegundos (24 horas)
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; 

    // --- ESTILOS CSS ---
    // Solución para el problema de scroll en móvil: 'touch-action: pan-y' permite el scroll vertical.
    // 'user-select: none' evita que se seleccione el texto al intentar hacer scroll.
    GM_addStyle(`
        .cm-multigame-container {
            margin-bottom: 1rem;
        }
        .cm-multigame-card {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            transition: background-color 0.2s;
            text-decoration: none !important;
            display: block;
            /* Fix para scroll móvil */
            touch-action: pan-y; 
            user-select: none;
            -webkit-user-select: none;
        }
        .cm-multigame-card:hover, .cm-multigame-card:active {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
            text-decoration: none;
        }
        .cm-multigame-card .card-title {
            color: #fff;
            font-size: 1rem;
            margin-bottom: 0;
        }
        .cm-multigame-card .bracketed {
            color: #aaa !important;
        }
        /* Ajuste para pantallas pequeñas */
        @media (max-width: 768px) {
            .cm-multigame-card .card-title {
                font-size: 0.9rem;
            }
        }
    `);

    // --- GESTIÓN DE CACHÉ ---

    function getCacheKey(username, gameId) {
        return `cm_multigame_${username}_${gameId}`;
    }

    function getFromCache(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const data = JSON.parse(item);
            const now = Date.now();

            // Si el dato es más antiguo que CACHE_DURATION_MS, se borra y se ignora
            if (now - data.timestamp > CACHE_DURATION_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return data.count;
        } catch (e) {
            return null;
        }
    }

    function saveToCache(key, count) {
        try {
            const data = {
                count: count,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving to local storage', e);
        }
    }

    // --- LÓGICA PRINCIPAL ---

    function getCurrentContext() {
        const path = window.location.pathname;
        // Captura idioma, juego y usuario
        const match = path.match(/^\/([a-z]{2})\/([a-zA-Z]+)\/Users\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return {
                lang: match[1],
                currentGame: match[2],
                username: match[3]
            };
        }
        return null;
    }

    function getContainer() {
        // 1. Contenedor estándar en el perfil principal
        let container = document.querySelector('#UserProductsMobile');
        
        // 2. Si estamos en la pestaña "Offers" (o no existe el anterior), creamos uno dinámico
        if (!container) {
            const main = document.querySelector('main.container');
            if (main) {
                // Buscamos si ya inyectamos el contenedor antes para no duplicar
                let existingDynamic = document.getElementById('cm-dynamic-container');
                if (existingDynamic) return existingDynamic;

                // Creamos contenedor tipo fila de Bootstrap
                let dynamicContainer = document.createElement('div');
                dynamicContainer.id = 'cm-dynamic-container';
                dynamicContainer.className = 'container cm-multigame-container';
                
                // Título opcional para sección
                dynamicContainer.innerHTML = '<div class="d-flex justify-content-between align-items-center w-100 mb-3 pb-1 border-bottom border-light"><h2>Otros Juegos</h2></div><div class="row g-0" id="cm-dynamic-row"></div>';
                
                // Insertamos al principio del main
                main.insertBefore(dynamicContainer, main.firstChild.nextSibling);
                
                return dynamicContainer.querySelector('#cm-dynamic-row');
            }
        } else {
            // Si el contenedor existe pero está vacío (a veces pasa), le damos formato fila
            if (!container.classList.contains('row')) container.classList.add('row', 'g-0');
            return container;
        }
        return null;
    }

    function createCardElement(gameName, initialCount = '...') {
        const div = document.createElement('div');
        // Clases responsivas: col-12 en móvil, col-md-6 en tablet, col-xl-3 en desktop
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

    function fetchSinglesCount(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 8000,
            onload: function(response) {
                if (response.status !== 200) {
                    callback(null);
                    return;
                }
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const singlesLink = doc.querySelector('a[href$="/Offers/Singles"]');
                
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

    // Iterar sobre juegos
    for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
        if (gameId === context.currentGame) continue;

        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;
        const cacheKey = getCacheKey(context.username, gameId);

        // 1. Crear tarjeta visual inmediatamente
        const cardElement = createCardElement(gameName, '...');
        container.appendChild(cardElement);

        // 2. Intentar leer de caché
        const cachedCount = getFromCache(cacheKey);

        if (cachedCount !== null) {
            // Si hay caché, actualizar directamente sin petición
            updateCardElement(cardElement, targetUrl, cachedCount);
        } else {
            // Si no hay caché, hacer petición
            fetchSinglesCount(targetUrl, (count) => {
                const finalCount = (count !== null) ? count : '0';
                updateCardElement(cardElement, targetUrl, finalCount);
                
                // Guardar en caché para la próxima vez
                if (count !== null) {
                    saveToCache(cacheKey, finalCount);
                }
            });
        }
    }

})();