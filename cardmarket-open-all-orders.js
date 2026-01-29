// ==UserScript==
// @name        Cardmarket Open Orders
// @namespace   Violentmonkey Scripts
// @match       https://www.cardmarket.com/*/*/Orders/Purchases/Arrived*
// @match       https://www.cardmarket.com/*/*/Orders/Sales/Arrived*
// @grant       GM_openInTab
// @version     1.4.1
// @author      Cardmarket Power Tools
// @icon        https://www.cardmarket.com/favicon.ico
// @description Open all orders with autoexport param and export table to CSV.
// ==/UserScript==

(function() {
    'use strict';

    // Función para añadir parámetros a la URL de forma segura
    function appendAutoExport(url) {
        const param = 'autoexport=true';
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${param}`;
    }

    function getOrderLinks() {
        // Buscamos tanto en 'a' como en elementos con 'data-url'
        const fromAnchors = Array.from(document.querySelectorAll('a[href*="/Order"]'))
            .map(a => a.href);
        
        const fromDataUrls = Array.from(document.querySelectorAll('[data-url*="/Order"]'))
            .map(el => {
                const url = el.getAttribute('data-url');
                return url.startsWith('http') ? url : window.location.origin + url;
            });

        // Combinar, normalizar y eliminar duplicados
        const all = [...new Set([...fromAnchors, ...fromDataUrls])];
        
        // Filtrar enlaces de pedidos válidos (ej: /es/Magic/Orders/123456)
        // Buscamos patrones que terminen en números después de /Orders/ o /Order/
        return all.filter(url => /\/Orders?\/\d+/.test(url));
    }

    function exportToCSV() {
        const rows = Array.from(document.querySelectorAll('.set-as-link[data-url*="/Order"]'));
        if (rows.length === 0) {
            alert('No se encontraron filas con datos de pedidos para exportar.');
            return;
        }

        let csvContent = "ID Pedido;Usuario;Fecha;Precio\n";

        rows.forEach(row => {
            const id = row.getAttribute('data-url').split('/').pop();
            const user = row.querySelector('.seller-name span:last-child')?.innerText || 
                         row.querySelector('.col-username')?.innerText || "Desconocido";
            const date = row.querySelector('.col-datetime span')?.innerText || "N/A";
            const price = row.querySelector('.col-price div')?.innerText || "0";
            
            // Limpiar datos para el CSV
            const cleanUser = user.replace(/\n/g, '').trim();
            const cleanPrice = price.replace(/\n/g, '').trim().replace('€', '').trim();
            
            csvContent += `${id};${cleanUser};${date};${cleanPrice}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `pedidos_cardmarket_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function createButton(id, html, title, color, bottomOffset, onClick) {
        if (document.getElementById(id)) return;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = html;
        btn.title = title;
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: `${bottomOffset}px`,
            right: '20px',
            width: '56px',
            height: '56px',
            backgroundColor: color,
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            fontSize: '22px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.1s'
        });
        btn.onclick = onClick;
        btn.onmousedown = () => btn.style.transform = 'scale(0.9)';
        btn.onmouseup = () => btn.style.transform = 'scale(1)';
        document.body.appendChild(btn);
    }

    function init() {
        // Botón 1: Abrir todos con autoexport (Azul)
        createButton('bulk-order-opener-btn', '🚀', 'Abrir todos con Auto-Export', '#007bff', 20, (e) => {
            e.preventDefault();
            const links = getOrderLinks();
            if (links.length === 0) {
                alert('No se encontraron pedidos. Asegúrate de estar en la página de pedidos o ventas.');
                return;
            }
            if (confirm(`¿Abrir ${links.length} pedidos con autoexport=true?`)) {
                links.forEach(url => {
                    const finalUrl = appendAutoExport(url);
                    GM_openInTab(finalUrl, { active: false, insert: true });
                });
            }
        });

        // Botón 2: Exportar CSV (Verde)
        createButton('bulk-order-csv-btn', '📊', 'Exportar a CSV', '#28a745', 86, (e) => {
            e.preventDefault();
            exportToCSV();
        });
    }

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);

    // Observer para aplicaciones de una sola página (SPA) o carga dinámica
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bulk-order-opener-btn')) init();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
