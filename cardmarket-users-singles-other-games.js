// ==UserScript==
// @name         Cardmarket Multi-Game Singles Counter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Añade contadores de cartas sueltas de otros juegos (Magic, Yugioh, DBS, Lorcana, Riftbound) al perfil de usuario de Cardmarket.
// @author       TuAsistente
// @match        https://www.cardmarket.com/*/Users/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      www.cardmarket.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /**
     * CONFIGURACIÓN
     * Lista de juegos a comprobar. 
     * Clave: Identificador en la URL de Cardmarket.
     * Valor: Nombre a mostrar en la tarjeta.
     */
    const TARGET_GAMES = {
        'Magic': 'Magic: The Gathering', // Añadido Magic
        'YuGiOh': 'Yu-Gi-Oh!',
        'DragonBallSuper': 'Dragon Ball Super',
        'Lorcana': 'Lorcana',
        'Riftbound': 'Riftbound'
    };

    /**
     * Función principal.
     * Detecta el usuario, el idioma y el juego actual, y busca los demás.
     */
    function main() {
        // Extraemos idioma, juego actual y usuario de la URL
        // Ejemplo: /es/Magic/Users/sandramagic
        const urlMatch = window.location.pathname.match(/^\/([a-z]{2})\/([a-zA-Z]+)\/Users\/([a-zA-Z0-9_-]+)/);

        if (!urlMatch) return; // No es un perfil de usuario válido

        const lang = urlMatch[1];
        const currentGame = urlMatch[2]; // Ej: 'Magic' o 'YuGiOh'
        const username = urlMatch[3];

        // Buscamos el contenedor donde se muestran los artículos del usuario
        const productContainer = document.querySelector('#UserProductsMobile');
        if (!productContainer) {
            console.log('Cardmarket Script: Contenedor de productos no encontrado.');
            return;
        }

        // Iteramos sobre todos los juegos configurados
        for (const [gameId, gameName] of Object.entries(TARGET_GAMES)) {
            
            // Si el juego de la iteración es el mismo que el de la página actual, lo saltamos
            // porque esa información ya está visible en la web.
            if (gameId === currentGame) continue;

            const targetUrl = `https://www.cardmarket.com/${lang}/${gameId}/Users/${username}`;

            // Creamos un marcador de posición
            const placeholderDiv = createPlaceholderCard(gameName);
            productContainer.appendChild(placeholderDiv);

            // Pedimos los datos al servidor
            fetchSinglesCount(targetUrl, (count) => {
                updateCard(placeholderDiv, targetUrl, gameName, count);
            });
        }
    }

    /**
     * Crea una tarjeta visual de carga (Placeholder).
     */
    function createPlaceholderCard(gameName) {
        const colDiv = document.createElement('div');
        // Usamos las mismas clases de Bootstrap que usa la web original para consistencia visual
        colDiv.className = 'col-12 col-md-6 col-xl-3';

        colDiv.innerHTML = `
            <div class="card text-center w-100 galleryBox mb-3 mb-md-4">
                <div class="card-body d-flex flex-column justify-content-center" style="min-height: 150px;">
                    <h3 class="card-title text-muted">
                        <span>${gameName}</span>
                        <span class="bracketed text-muted small ms-2">Cargando...</span>
                    </h3>
                </div>
            </div>
        `;
        return colDiv;
    }

    /**
     * Actualiza la tarjeta con el número real y el enlace.
     */
    function updateCard(element, url, gameName, count) {
        // Si count es null, hubo error o no se encontró el usuario en ese juego
        if (count !== null) {
            // Creamos un enlace que envuelve todo el contenido, igual que hace Cardmarket nativamente
            const link = document.createElement('a');
            link.href = url + '/Offers/Singles';
            link.className = 'card text-center w-100 galleryBox mb-3 mb-md-4 text-decoration-none';
            
            // Insertamos el HTML final
            link.innerHTML = `
                <img src="https://static.cardmarket.com/img/logos/cardmarket.png" alt="${gameName}" class="img-fluid lazy card-img-top" style="opacity: 0.1; max-height: 1px;">
                <div class="card-body d-flex flex-column">
                    <h3 class="card-title">
                        <span>${gameName}</span>
                        <span class="bracketed text-muted small ms-2">${count}</span>
                    </h3>
                </div>
            `;
            
            // Reemplazamos el placeholder por el enlace real
            element.innerHTML = '';
            element.appendChild(link);
        } else {
            // Caso sin datos (perfil no existe en ese juego)
            const cardBody = element.querySelector('.card-body');
            cardBody.innerHTML = `
                <h3 class="card-title text-muted">
                    <span>${gameName}</span>
                    <span class="bracketed text-muted small ms-2">-</span>
                </h3>
            `;
        }
    }

    /**
     * Petición HTTP para obtener el HTML de la otra página y extraer el contador.
     */
    function fetchSinglesCount(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                if (response.status !== 200) {
                    callback(null);
                    return;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                // Buscamos el enlace específico de "Cartas Sueltas"
                // Selector: un enlace <a> que termine en "/Offers/Singles"
                const singlesLink = doc.querySelector('a[href$="/Offers/Singles"]');
                
                if (singlesLink) {
                    // Dentro de ese enlace, buscamos el span con la clase 'bracketed' que contiene el número
                    const countSpan = singlesLink.querySelector('span.bracketed');
                    if (countSpan) {
                        callback(countSpan.textContent.trim());
                        return;
                    }
                }
                
                callback(null);
            },
            onerror: function() {
                console.error(`Error fetching data for ${url}`);
                callback(null);
            }
        });
    }

    // Ejecutamos el script
    main();
})();