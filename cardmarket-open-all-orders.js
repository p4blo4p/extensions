// ==UserScript==
// @name        Cardmarket Bulk Order Opener
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Orders/*/*
// @grant       GM_openInTab
// @version     1.2.3
// @author      Cardmarket Power Tools
// @icon        https://www.cardmarket.com/favicon.ico
// @description Adds a floating button to open all order links in new tabs.
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        if (document.getElementById('bulk-order-opener-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'bulk-order-opener-btn';
        btn.innerHTML = '🚀'; // Usamos un icono para que sea compacto en móvil
        btn.title = 'Abrir todos los pedidos';
        
        // Estilos para botón flotante (Overlay)
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });

        // Efecto visual al pulsar
        btn.onmousedown = () => btn.style.transform = 'scale(0.9)';
        btn.onmouseup = () => btn.style.transform = 'scale(1)';

        btn.onclick = (e) => {
            e.preventDefault();
            
            // 1. Buscar en etiquetas <a> que contengan /Order/ o /Orders/
            const linksFromAnchors = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.includes('/Order/'));

            // 2. Buscar en elementos con data-url (filas de la tabla en Cardmarket)
            const linksFromDataUrls = Array.from(document.querySelectorAll('[data-url]'))
                .map(el => {
                    const url = el.getAttribute('data-url');
                    // Convertir ruta relativa a absoluta si es necesario
                    return url.startsWith('http') ? url : window.location.origin + url;
                })
                .filter(url => url.includes('/Order/'));

            // Combinar y eliminar duplicados
            const allLinks = [...new Set([...linksFromAnchors, ...linksFromDataUrls])];

            if (allLinks.length === 0) {
                alert('¡No se encontraron pedidos en esta página!');
                return;
            }

            if (confirm(`¿Abrir ${allLinks.length} pedidos en pestañas nuevas?`)) {
                allLinks.forEach(href => {
                    GM_openInTab(href, { active: false, insert: true });
                });
            }
        };

        document.body.appendChild(btn);
    }

    // Ejecutar al cargar
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
    
    // Observador para asegurar que el botón persista en cambios de página AJAX
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bulk-order-opener-btn')) {
            init();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
