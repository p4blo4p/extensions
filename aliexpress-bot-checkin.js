// Espera unos segundos para simular comportamiento humano
setTimeout(() => {
    // Busca el botón de check-in diario por clase o selector
    const btn = document.querySelector('.checkin-btn, .checkin-btn__active, .checkin-btn__inactive');
    if (btn && btn.innerText.includes("Check in") || btn.innerText.includes("签到")) {
        btn.click();
        alert("¡Check-in diario realizado!");
    } else {
        alert("No se encontró el botón o ya hiciste check-in.");
    }
}, Math.floor(Math.random() * 4000) + 2000); // Espera entre 2 y 6 segundos
