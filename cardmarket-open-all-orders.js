// ==UserScript==
// @name        Cardmarket Bulk Order Opener
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/Magic/Orders/Received*
// @match       https://www.cardmarket.com/*/Magic/Sales/Sent*
// @match       https://www.cardmarket.com/*/Magic/Orders/Sent*
// @match       https://www.cardmarket.com/*/Magic/Sales/Received*
// @grant       GM_openInTab
// @version     1.1
// @author      Cardmarket Power Tools
// @description Adds a highly visible button to open all order links in new tabs.
// @icon         https://www.cardmarket.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        if (document.getElementById('bulk-order-opener-btn')) return;

        // Intentar encontrar el contenedor principal de la tabla o el título de la página
        const insertionPoint = document.querySelector('.table-responsive') || 
                               document.querySelector('h1') || 
                               document.querySelector('.container main');

        if (!insertionPoint) return;

        const btn = document.createElement('button');
        btn.id = 'bulk-order-opener-btn';
        btn.innerHTML = '🚀 Abrir todos los pedidos';
        
        // Estilos para asegurar visibilidad total
        Object.assign(btn.style, {
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '15px',
            marginRight: '10px',
            display: 'inline-block',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: '9999'
        });

        btn.onmouseover = () => btn.style.backgroundColor = '#0056b3';
        btn.onmouseout = () => btn.style.backgroundColor = '#007bff';

        btn.onclick = (e) => {
            e.preventDefault();
            
            // Buscar enlaces que apunten específicamente a detalles de pedido
            // En Cardmarket suelen tener este formato: /en/Magic/Order/123456
            const orderLinks = Array.from(document.querySelectorAll('a[href*="/Order/"]'))
                .filter(a => !a.href.includes('/Settings') && !a.href.includes('/Help'));
            
            const uniqueHrefs = [...new Set(orderLinks.map(a => a.href))];

            if (uniqueHrefs.length === 0) {
                alert('¡No se encontraron pedidos en esta página!');
                return;
            }

            if (confirm(`¿Abrir ${uniqueHrefs.length} pedidos en pestañas nuevas?`)) {
                uniqueHrefs.forEach(href => {
                    GM_openInTab(href, { active: false, insert: true });
                });
            }
        };

        // Insertar antes de la tabla o después del título
        if (insertionPoint.tagName === 'H1') {
            insertionPoint.parentNode.insertBefore(btn, insertionPoint.nextSibling);
        } else {
            insertionPoint.parentNode.insertBefore(btn, insertionPoint);
        }
    }

    // Ejecutar al cargar
    window.addEventListener('load', init);
    
    // Observador por si el contenido carga dinámicamente
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bulk-order-opener-btn')) {
            init();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
