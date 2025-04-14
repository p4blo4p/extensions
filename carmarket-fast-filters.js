// ==UserScript==
// @name         Overlay Buttons with Links
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Overlay buttons with hyperlinks on a webpage
// @author       Your Name
// @match       https://www.cardmarket.com/*/*/Cards/*
// @match       https://www.cardmarket.com/*/*/Products/Singles/*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create a container for the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.top = '10px';
    buttonContainer.style.right = '10px';
    buttonContainer.style.zIndex = '1000';
    buttonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderRadius = '5px';

    // Add a button with an href
    const linkButton1 = document.createElement('a');
    linkButton1.textContent = 'Spain';
    linkButton1.href = 'https://www.google.com';
    linkButton1.target = '_blank'; // Opens in a new tab
    linkButton1.style.display = 'inline-block';
    linkButton1.style.margin = '5px';
    linkButton1.style.padding = '10px';
    linkButton1.style.color = 'white';
    linkButton1.style.textDecoration = 'none';
    linkButton1.style.backgroundColor = '#007bff';
    linkButton1.style.borderRadius = '5px';

    const linkButton2 = document.createElement('a');
    linkButton2.textContent = 'Revised';
    linkButton2.href = 'https://github.com';
    linkButton2.target = '_blank'; // Opens in a new tab
    linkButton2.style.display = 'inline-block';
    linkButton2.style.margin = '5px';
    linkButton2.style.padding = '10px';
    linkButton2.style.color = 'white';
    linkButton2.style.textDecoration = 'none';
    linkButton2.style.backgroundColor = '#28a745';
    linkButton2.style.borderRadius = '5px';

    // Append buttons to the container
    buttonContainer.appendChild(linkButton1);
    buttonContainer.appendChild(linkButton2);

    // Append the container to the body
    document.body.appendChild(buttonContainer);
})();
