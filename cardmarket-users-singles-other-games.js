// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Añade contadores de cartas sueltas de otros juegos y enlaces directos al perfil.
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

    // Configuración de juegos a buscar
    const TARGET_GAMES = {
        'Magic': 'Magic',
        'YuGiOh': 'Yu-Gi-Oh!',
        'DragonBallSuper': 'Dragon Ball Super',
        'Lorcana': 'Lorcana',
        'Riftbound': 'Riftbound'
    };

    // Estilos CSS para asegurar que se vea bien y rápido
    GM_addStyle(`
        .cm-multigame-card {
            background-color: #2c2c2c; /* Fondo oscuro estilo Cardmarket */
            border: 1px solid #444;
            transition: all 0.3s ease;
        }
        .cm-multigame-card:hover {
            border-color: #fff;
            transform: translateY(-2px);
            text-decoration: none;
        }
        .cm-multigame-title {
            color: #fff; /* Texto blanco */
        }
    `);

    /**
     * Extrae el nombre de usuario, idioma y juego actual de la URL actual.
     * Funciona tanto en /Users/Nombre como en /Users/Nombre/Offers
     */
    function getCurrentContext() {
        const path = window.location.pathname;
        // Regex para capturar idioma, juego y usuario. Ignora lo que venga después.
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

    /**
     * Intenta encontrar el contenedor adecuado en la página.
     * Prioriza el contenedor de tarjetas del perfil, pero busca alternativas si estamos en "Offers".
     */
    function getContainer() {
        // 1. Intenta encontrar el contenedor principal de tarjetas (Perfil clásico)
        let container = document.querySelector('#UserProductsMobile');
        
        // 2. Si no existe (página de Offers u otra), busca la cabecera de secciones
        if (!container) {
            // En la página de Offers, intentaremos inyectar antes de la tabla o en un lugar visible
            const mainContent = document.querySelector('main.container');
            if (mainContent) {
                // Crear un contenedor dinámico si no existe el de productos
                let dynamicContainer = document.getElementById('dynamic-multigame-container');
                if (!dynamicContainer) {
                    dynamicContainer = document.createElement('div');
                    dynamicContainer.id = 'dynamic-multigame-container';
                    dynamicContainer.className = 'row g-0 mb-4'; // Clases Bootstrap
                    // Insertar al principio del main content
                    mainContent.insertBefore(dynamicContainer, mainContent.firstChild.nextSibling);
                }
                container = dynamicContainer;
            }
        }
        return container;
    }

    /**
     * Crea el elemento visual (tarjeta) con el estado de carga.
     */
    function createCardElement(gameName, isLoading = true) {
        const div = document.createElement('div');
        // Clases responsivas de Bootstrap (igual que las tarjetas originales)
        div.className = 'col-12 col-md-6 col-xl-3';

        const loadingText = isLoading ? 'Cargando...' : '-';
        
        div.innerHTML = `
            <a href="#" class="card text-center w-100 galleryBox mb-3 mb-md-4 cm-multigame-card text-decoration-none">
                <div class="card-body d-flex flex-column justify-content-center" style="min-height: 120px;">
                    <h3 class="card-title cm-multigame-title">
                        <span>${gameName}</span>
                        <span class="bracketed text-muted small ms-2">${loadingText}</span>
                    </h3>
                </div>
            </a>
        `;
        return div;
    }

    /**
     * Actualiza la tarjeta con el conteo real y el enlace correcto.
     */
    function updateCardElement(element, url, gameName, count) {
        const link = element.querySelector('a');
        const titleSpan = element.querySelector('h3');
        
        link.href = url; // Aquí asignamos el enlace directo al perfil: /en/Magic/Users/User
        
        const displayCount = (count !== null && count !== undefined) ? count : '0';
        
        titleSpan.innerHTML = `
            <span>${gameName}</span>
            <span class="bracketed text-muted small ms-2">${displayCount}</span>
        `;
    }

    /**
     * Petición HTTP para obtener el HTML de la página de perfil del otro juego.
     */
    function fetchSinglesCount(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 10000, // 10 segundos de timeout
            onload: function(response) {
                if (response.status !== 200) {
                    callback(null);
                    return;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                // Buscamos el enlace "Cartas Sueltas"
                // Selector robusto: busca el enlace que termina en /Offers/Singles
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
            onerror: function() {
                callback(null);
            },
            ontimeout: function() {
                console.log('Timeout fetching: ' + url);
                callback(null);
            }
        });
    }

    // --- EJECUCIÓN PRINCIPAL ---
    const context = getCurrentContext();
    if (!context) return;

    const container = getContainer();
    if (!container) return;

    // Iteramos sobre los juegos configurados
    for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
        // Saltamos el juego actual para no duplicar
        if (gameId === context.currentGame) continue;

        // Construimos la URL base: https://www.cardmarket.com/es/YuGiOh/Users/Usuario
        const targetUrl = `https://www.cardmarket.com/${context.lang}/${gameId}/Users/${context.username}`;

        // Crear tarjeta de carga
        const cardElement = createCardElement(gameName, true);
        container.appendChild(cardElement);

        // Pedir datos
        fetchSinglesCount(targetUrl, (count) => {
            updateCardElement(cardElement, targetUrl, gameName, count);
        });
    }

})();