// ==UserScript==
// @name         Exportar tabla a CSV (Violentmonkey)
// @namespace    https://github.com/p4blo4p
// @version      1.2
// @description  Añade un botón para exportar tablas HTML a CSV (soporta colspan/rowspan básico). Te permite elegir entre tablas si hay varias y descarga un archivo .csv compatible con Excel.
// @author       p4blo4p
// @match        https://www.cardmarket.com/*/*/Products/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /*************************************************************************
   * Configuración (edita según tu preferencia)
   *************************************************************************/
  const DEFAULT_TABLE_SELECTOR = 'table'; // selector para buscar tablas por defecto
  const INCLUDE_HEADERS = true;            // incluir filas de <th> como primera fila
  const DEFAULT_SEPARATOR = ',';           // ',' o ';' (usa ';' si Excel en locales que usan ',' como separador decimal)
  const BUTTON_TEXT = 'Exportar CSV';      // texto del botón flotante
  const HOTKEY = { ctrl: true, shift: true, key: 'E' }; // Ctrl+Shift+E para exportar

  /*************************************************************************
   * Utilidades
   *************************************************************************/
  function sanitizeFileName(name) {
    return name.replace(/[\\\/:*?"<>|]+/g, '_').trim() || 'tabla';
  }

  function formatTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function escapeCsvCell(text, separator) {
    if (text == null) text = '';
    text = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const mustQuote = text.includes(separator) || text.includes('"') || text.includes('\n');
    if (text.includes('"')) text = text.replace(/"/g, '""');
    return mustQuote ? `"${text}"` : text;
  }

  /*************************************************************************
   * Conversión de tabla HTML a matriz teniendo en cuenta colspan/rowspan
   * Devuelve array de filas (cada fila es array de celdas)
   *************************************************************************/
  function tableToMatrix(table, includeHeaders = true) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const matrix = [];
    // spanMap: para cada columna índice, guarda {value, remainingRows}
    let spanMap = [];

    // Si no queremos incluir encabezados y la primera fila solo tiene th, podemos ignorarla.
    // Pero para mantener control, incluimos todo y el caller decide si omitir.
    for (let r = 0; r < rows.length; r++) {
      const tr = rows[r];
      const cells = Array.from(tr.querySelectorAll('th, td'));
      let rowArr = [];
      let colIndex = 0;
      let cellIdx = 0;

      while (true) {
        // Saltar columnas ocupadas por rowspan previos
        while (spanMap[colIndex] && spanMap[colIndex].remainingRows > 0) {
          rowArr[colIndex] = spanMap[colIndex].value;
          spanMap[colIndex].remainingRows--;
          if (spanMap[colIndex].remainingRows === 0) {
            spanMap[colIndex] = null;
          }
          colIndex++;
        }

        if (cellIdx >= cells.length) break;

        const cell = cells[cellIdx++];
        const raw = cell.textContent || '';
        const text = raw.trim();
        const colspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
        const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10));

        // Colocar el texto en las columnas correspondientes
        for (let k = 0; k < colspan; k++) {
          rowArr[colIndex + k] = text;
          if (rowspan > 1) {
            // Guarda en spanMap para las próximas filas
            spanMap[colIndex + k] = {
              value: text,
              remainingRows: rowspan - 1
            };
          } else {
            // marca como null si no hay rowspan
            if (!spanMap[colIndex + k]) spanMap[colIndex + k] = null;
          }
        }
        colIndex += colspan;
      }

      // Si todavía quedan spans que ocupan columnas al final, añádelas
      while (spanMap[colIndex] && spanMap[colIndex].remainingRows > 0) {
        rowArr[colIndex] = spanMap[colIndex].value;
        spanMap[colIndex].remainingRows--;
        if (spanMap[colIndex].remainingRows === 0) {
          spanMap[colIndex] = null;
        }
        colIndex++;
      }

      // Normalizar longitud de filas (llenar agujeros con '')
      const maxLen = spanMap.length > 0 ? spanMap.length : rowArr.length;
      for (let i = 0; i < maxLen; i++) {
        if (typeof rowArr[i] === 'undefined') rowArr[i] = '';
      }

      matrix.push(rowArr);
    }

    // Si includeHeaders == false y las filas iniciales contienen sólo th, podemos intentar detectar y eliminar.
    if (!includeHeaders) {
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        const ths = firstRow.querySelectorAll('th');
        if (ths.length > 0) {
          // eliminar la primera fila de matrix
          matrix.shift();
        }
      }
    }

    return matrix;
  }

  /*************************************************************************
   * Construir CSV a partir de la matriz
   *************************************************************************/
  function matrixToCsv(matrix, separator) {
    const lines = matrix.map(row => row.map(cell => escapeCsvCell(cell, separator)).join(separator));
    // Añadir BOM para compatibilidad con Excel
    return '\ufeff' + lines.join('\r\n');
  }

  /*************************************************************************
   * Descarga el CSV (crea Blob y dispara la descarga)
   *************************************************************************/
  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /*************************************************************************
   * UI: botón flotante y modal simple para elegir tablas si hay varias
   *************************************************************************/
  function createFloatingButton(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.id = 'vm-export-csv-btn';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 999999,
      padding: '8px 12px',
      background: '#0062ff',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      cursor: 'pointer',
      fontSize: '13px',
    });
    btn.title = 'Exportar tablas a CSV (Ctrl+Shift+E)';
    document.body.appendChild(btn);
    return btn;
  }

  function createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'vm-export-modal';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.4)',
      zIndex: 999998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      width: 'min(90%,700px)',
      maxHeight: '80%',
      overflow: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { overlay, box };
  }

  function openTableChooser(tables, onChoose) {
    const { overlay, box } = createModal();
    box.innerHTML = '<h3 style="margin-top:0">Elige la tabla a exportar</h3>';
    tables.forEach((table, i) => {
      const preview = document.createElement('div');
      preview.style.border = '1px solid #eee';
      preview.style.padding = '8px';
      preview.style.margin = '8px 0';
      preview.style.borderRadius = '6px';
      preview.style.cursor = 'pointer';
      preview.style.background = '#fafafa';

      // Crear una pequeña previsualización: texto del primer row/cols
      const firstRow = table.querySelector('tr');
      const headerText = firstRow ? Array.from(firstRow.querySelectorAll('th,td')).slice(0,6).map(td => td.textContent.trim()).join(' | ') : '(sin filas)';
      preview.innerHTML = `<strong>Tabla ${i + 1}</strong> — ${table.querySelectorAll('tr').length} filas<br><small style="color:#666">${escapeHtml(headerText)}</small>`;

      preview.addEventListener('click', () => {
        closeModal();
        onChoose(i);
      });

      box.appendChild(preview);
    });

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancelar';
    Object.assign(cancel.style, {
      marginTop: '8px',
      padding: '8px 10px',
      borderRadius: '6px',
      border: '1px solid #ddd',
      background: 'white',
      cursor: 'pointer'
    });
    cancel.addEventListener('click', closeModal);
    box.appendChild(cancel);

    function closeModal() {
      overlay.remove();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /*************************************************************************
   * Flujo principal de exportación
   *************************************************************************/
  function exportTablesFlow(selector = DEFAULT_TABLE_SELECTOR, separator = DEFAULT_SEPARATOR) {
    const tables = Array.from(document.querySelectorAll(selector));
    if (!tables.length) {
      alert(`No se encontró ninguna tabla usando el selector "${selector}".`);
      return;
    }

    function doExport(table) {
      try {
        const matrix = tableToMatrix(table, INCLUDE_HEADERS);
        const csv = matrixToCsv(matrix, separator);
        const pageTitle = sanitizeFileName(document.title || 'tabla');
        const filename = `${pageTitle}_${formatTimestamp()}.csv`;
        downloadCsv(csv, filename);
      } catch (err) {
        console.error('Error exportando tabla a CSV:', err);
        alert('Ocurrió un error al exportar la tabla. Mira la consola para más detalles.');
      }
    }

    if (tables.length === 1) {
      doExport(tables[0]);
    } else {
      openTableChooser(tables, (index) => doExport(tables[index]));
    }
  }

  /*************************************************************************
   * Iniciar UI y atajos
   *************************************************************************/
  const btn = createFloatingButton(BUTTON_TEXT);
  btn.addEventListener('click', () => exportTablesFlow(DEFAULT_TABLE_SELECTOR, DEFAULT_SEPARATOR));

  // Hotkey Ctrl+Shift+E (personalizable)
  window.addEventListener('keydown', (ev) => {
    const matches =
      (!!ev.ctrlKey === !!HOTKEY.ctrl) &&
      (!!ev.shiftKey === !!HOTKEY.shift) &&
      ev.key.toUpperCase() === HOTKEY.key.toUpperCase();
    if (matches) {
      // Evita conflictos al escribir en inputs
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;
      ev.preventDefault();
      exportTablesFlow(DEFAULT_TABLE_SELECTOR, DEFAULT_SEPARATOR);
    }
  });

  // Pequeño control por si el botón se crea múltiples veces en páginas SPA
  window.addEventListener('load', () => {
    const existing = document.querySelectorAll('#vm-export-csv-btn');
    if (existing.length > 1) {
      // eliminar duplicados antiguos, dejar el último
      existing.forEach((el, idx) => { if (idx < existing.length - 1) el.remove(); });
    }
  });

  // Mensaje en consola con instrucciones basic
  console.info('Violentmonkey Exportar Tabla a CSV activo. Haz clic en el botón "Exportar CSV" o presiona Ctrl+Shift+E.');

})();
