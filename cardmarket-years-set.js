// ==UserScript==
// @name         Cardmarket Set Year Prefix
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Añade el año de lanzamiento delante del nombre de la edición en los filtros de usuario de Cardmarket (ej. "2017 - Albor de Guardianes"). Funciona en inglés y español. Se actualiza dinámicamente.
// @author       Experto en Userscripts
// @match        https://www.cardmarket.com/*/Magic/Users/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // CONFIGURACIÓN
    const CACHE_DURATION_DAYS = 30; // Actualizar lista de sets cada 30 días
    const TARGET_SELECTOR = 'div[data-component-name="CategoryOffersFilterComponent"]';

    // 1. OBTENER MAPA DE AÑOS (Lógica de scraping y caché)

    /**
     * Obtiene el mapa de Set Name -> Year desde la caché o scrapeando la web.
     * Intenta hacerlo síncrono si hay caché, o asíncrono si no.
     */
    async function initYearsMap() {
        const lang = window.location.pathname.split('/')[1]; // 'es', 'en', etc.
        const storageKey = `cardmarket_years_map_${lang}`;
        const cachedData = GM_getValue(storageKey);
        const now = Date.now();

        // Si hay caché y es reciente, la usamos directamente
        if (cachedData && (now - cachedData.timestamp < CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000)) {
            return cachedData.map;
        }

        // Si no hay caché, devolvemos una promesa que la generará
        return await fetchAndCacheYears(lang, storageKey);
    }

    /**
     * Hace scraping a la página de Expansiones para obtener los años.
     */
    function fetchAndCacheYears(lang, storageKey) {
        return new Promise((resolve) => {
            const url = `https://www.cardmarket.com/${lang}/Magic/Expansions`;
            console.log(`[Cardmarket Script] Fetching years from: ${url}`);

            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        const rows = doc.querySelectorAll(".table tbody tr");
                        const newMap = {};

                        rows.forEach(row => {
                            const cells = row.querySelectorAll("td");
                            if (cells.length >= 2) {
                                // Celda 1 suele ser el símbolo, Celda 2 el nombre, Últimas celdas tienen fechas
                                const nameCell = cells[1];
                                const name = nameCell.innerText.trim();
                                
                                // Buscar una celda que contenga un año (formato YYYY)
                                let year = "";
                                for (let i = 2; i < cells.length; i++) {
                                    const cellText = cells[i].innerText.trim();
                                    const yearMatch = cellText.match(/\b(19\d{2}|20\d{2})\b/);
                                    if (yearMatch) {
                                        year = yearMatch[0];
                                        break;
                                    }
                                }

                                if (name && year) {
                                    newMap[name] = year;
                                }
                            }
                        });

                        // Guardar en caché
                        GM_setValue(storageKey, { map: newMap, timestamp: Date.now() });
                        console.log(`[Cardmarket Script] Cached ${Object.keys(newMap).length} sets.`);
                        resolve(newMap);
                    } catch (e) {
                        console.error("[Cardmarket Script] Error parsing expansions page", e);
                        resolve({});
                    }
                },
                onerror: function(err) {
                    console.error("[Cardmarket Script] Error fetching expansions page", err);
                    resolve({});
                }
            });
        });
    }

    // 2. APLICAR CAMBIOS EN LA INTERFAZ

    /**
     * Modifica el atributo 'data-props' del componente React antes de que se renderice.
     * Esta es la forma más limpia de modificar el dropdown.
     */
    function modifyDataProps(yearsMap) {
        const container = document.querySelector(TARGET_SELECTOR);
        if (!container) return false;

        const propsStr = container.getAttribute('data-props');
        if (!propsStr) return false;

        try {
            const props = JSON.parse(propsStr);
            let modified = false;

            // Navegar por las opciones de expansión
            if (props.options && props.options.expansionOptions) {
                props.options.expansionOptions.forEach(opt => {
                    // Formato esperado: "Nombre Set (Cantidad)"
                    // Regex para separar nombre y cantidad: /(.*)(\(\d+\))$/
                    const match = opt.label.match(/^(.*?)(\s*\(\d+\))?$/);
                    
                    if (match) {
                        const setName = match[1].trim(); // Nombre limpio
                        const countPart = match[2] || ""; // (0)
                        const year = yearsMap[setName];

                        if (year && !opt.label.startsWith(year)) {
                            opt.label = `${year} - ${setName}${countPart}`;
                            modified = true;
                        }
                    }
                });
            }

            if (modified) {
                container.setAttribute('data-props', JSON.stringify(props));
                console.log("[Cardmarket Script] Modified data-props successfully.");
                return true;
            }
        } catch (e) {
            console.error("[Cardmarket Script] Error modifying data-props", e);
        }
        return false;
    }

    /**
     * Parchea los elementos del DOM si la modificación inicial falló (ej. carga dinámica).
     * Observa cambios en el contenedor del filtro.
     */
    function patchDOMObserver(yearsMap) {
        // Función interna para modificar un nodo de texto específico
        const processNode = (node) => {
            // Buscamos opciones de dropdown o elementos de lista
            // Cardmarket usa una estructura de dropdown personalizada
            const items = node.querySelectorAll('[role="option"], .dropdown-item, .react-select__option');
            
            items.forEach(item => {
                const text = item.innerText || item.textContent;
                // Evitar procesar si ya tiene año o está vacío
                if (!text || /^\d{4}/.test(text)) return;

                const match = text.match(/^(.*?)(\s*\(\d+\))?$/);
                if (match) {
                    const setName = match[1].trim();
                    const countPart = match[2] || "";
                    const year = yearsMap[setName];

                    if (year) {
                        const newText = `${year} - ${setName}${countPart}`;
                        // Actualizar solo el texto para no romper eventos de React
                        // Buscamos el span interno o usamos textContent
                        const textContainer = item.querySelector('span') || item;
                        if (textContainer.textContent !== newText) {
                             textContainer.textContent = newText;
                             console.log(`[Cardmarket Script] Patched DOM: ${setName} -> ${newText}`);
                        }
                    }
                }
            });
        };

        // Observador para cuando se abre el dropdown
        const observer = new MutationObserver((mutations) => {
            // Buscamos el contenedor del dropdown en el cuerpo del documento (suele ser un portal)
            const dropdowns = document.querySelectorAll('[class*="dropdown-menu"], [class*="react-select__menu-list"]');
            dropdowns.forEach(d => processNode(d));
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 3. EJECUCIÓN PRINCIPAL

    const startScript = async () => {
        // 1. Cargar mapa de años (usará caché si existe)
        const yearsMap = await initYearsMap();

        // 2. Intentar modificación síncrona en el JSON de datos
        // Esto funciona si el script se ejecuta antes de que React hidrate la página
        const success = modifyDataProps(yearsMap);

        // 3. Siempre activar el observer por si acaso (para dropdowns dinámicos o si falló lo anterior)
        if (!success || Object.keys(yearsMap).length > 0) {
            patchDOMObserver(yearsMap);
        }
    };

    startScript();

})();