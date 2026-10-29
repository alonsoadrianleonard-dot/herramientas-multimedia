/* =====================================================================
   principal.js: interactividad de la página Herramientas Multimedia
   (altura del encabezado, ventanas, acordeones, pestañas, submenús,
   modo oscuro y traducción con Google Translate).
   El modelo 3D del perrito NO está aquí: vive dentro de index.html
   para que funcione también al abrir la página con doble clic.
   ===================================================================== */

/* ============ AJUSTE DINÁMICO DEL HEADER ============
   En vez de dejar un espacio fijo (ej. 96px) que se desajusta si el
   header crece (por el logo, texto largo, o pantallas angostas),
   medimos la altura REAL del header y la guardamos en una variable
   CSS (--header-h). El espaciador y el menú lateral usan esa
   variable, así que siempre se acomodan sin dejar huecos ni
   que el header tape nada. */
const siteHeader = document.querySelector('.site-header');

function updateHeaderHeight() {
    const height = siteHeader.offsetHeight;
    document.documentElement.style.setProperty('--header-h', height + 'px');
}

updateHeaderHeight();
window.addEventListener('resize', updateHeaderHeight);
// Si el texto del header cambia (ej. al traducir), se vuelve a medir
if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(siteHeader);
window.addEventListener('load', updateHeaderHeight);

/* ============ MODAL DE BIENVENIDA ============ */
const modal = document.getElementById('welcomeModal');
const closeBtn = document.getElementById('closeModal');
closeBtn.addEventListener('click', () => modal.classList.add('modal-hidden'));
modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('modal-hidden');
});

/* ============ VENTANA DEL AUTOR ============ */
const authorModal = document.getElementById('authorModal');
document.getElementById('authorBtn').addEventListener('click', () => authorModal.classList.remove('modal-hidden'));
document.getElementById('closeAuthor').addEventListener('click', () => authorModal.classList.add('modal-hidden'));
authorModal.addEventListener('click', (e) => {
    if (e.target === authorModal) authorModal.classList.add('modal-hidden');
});

// La tecla Esc cierra cualquier ventana flotante
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modal.classList.add('modal-hidden');
        authorModal.classList.add('modal-hidden');
    }
});

/* ============ ACORDEÓN DE BOTONES (UNIDAD 1) ============ */
const topicButtons = document.querySelectorAll('.topic-btn');
topicButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.topic-item');
        item.classList.toggle('open');
    });
});

/* ============ PESTAÑAS (MENÚ LATERAL) ============ */
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        // Quita "active" de todos los botones y paneles
        tabButtons.forEach((b) => b.classList.remove('active'));
        tabPanels.forEach((p) => p.classList.remove('active'));

        // Activa solo el botón presionado y el panel que le corresponde
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
    });
});

/* ============ SUBMENÚ: salta al tema dentro de la unidad ============ */
document.querySelectorAll('.sub-link').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${link.dataset.tab}"]`);
        if (!tabBtn.classList.contains('active')) tabBtn.click();
        document.getElementById(link.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

/* "Ver el perrito 3D ↓": baja suavemente hasta el modelo */
document.querySelectorAll('.model-jump').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('u2-modelo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

/* ============ MODO OSCURO / CLARO ============ */
const themeToggle = document.getElementById('themeToggle');
const pageBody = document.body;

function applyTheme(theme) {
    if (theme === 'dark') {
        pageBody.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    } else {
        pageBody.classList.remove('dark-mode');
        themeToggle.textContent = '🌙';
    }
}

// Recuerda la preferencia del usuario entre visitas
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const newTheme = pageBody.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});

/* ============ TRADUCCIÓN ES / EN CON GOOGLE TRANSLATE ============
   El botón EN/ES ahora usa Google Translate, que traduce TODA la
   página (no solo los textos marcados con .i18n). Si no hay internet
   y Google no carga, se usan las traducciones manuales data-es/data-en. */
const langToggle = document.getElementById('langToggle');
const i18nElements = document.querySelectorAll('.i18n');
let currentLang = localStorage.getItem('lang') || 'es';
let googleReady = false;

function updateLangButton(lang) {
    langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
    langToggle.title = lang === 'en' ? 'Traducir a español' : 'Translate to English';
}

// Plan B (sin internet): cambia los textos usando data-es / data-en
function applyManualLanguage(lang) {
    i18nElements.forEach((el) => {
        el.textContent = lang === 'en' ? el.dataset.en : el.dataset.es;
    });
    document.documentElement.setAttribute('lang', lang);
}

// Google crea un <select class="goog-te-combo">; lo cambiamos por código
function translateWithGoogle(lang, attempts = 0) {
    const combo = document.querySelector('#google_translate_element select.goog-te-combo');
    if (combo && combo.options.length > 1) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
    } else if (attempts < 40) {
        setTimeout(() => translateWithGoogle(lang, attempts + 1), 250);
    } else {
        applyManualLanguage(lang); // Google tardó demasiado: plan B
    }
}

// Volver al español: se borra la cookie de Google y se recarga (texto original)
function restoreSpanish() {
    const expired = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    document.cookie = expired;
    document.cookie = expired + '; domain=' + location.hostname;
    location.reload();
}

// Google llama a esta función cuando su script termina de cargar
window.googleTranslateElementInit = function () {
    googleReady = true;
    new google.translate.TranslateElement({
        pageLanguage: 'es',
        includedLanguages: 'en,es',
        autoDisplay: false
    }, 'google_translate_element');
    if (currentLang === 'en') translateWithGoogle('en');
};

// Si el script de Google no carga (sin internet), usamos el plan B
window.googleTranslateFailed = function () {
    if (currentLang === 'en') applyManualLanguage('en');
};

applyManualLanguage('es'); // textos originales en español
updateLangButton(currentLang);

langToggle.addEventListener('click', () => {
    const newLang = currentLang === 'en' ? 'es' : 'en';
    localStorage.setItem('lang', newLang);
    currentLang = newLang;
    updateLangButton(newLang);

    if (newLang === 'en') {
        if (googleReady) translateWithGoogle('en');
        else applyManualLanguage('en');
    } else if (googleReady) {
        restoreSpanish();
    } else {
        applyManualLanguage('es');
    }
});

/* ============ 2.3: MINI EDITOR EN VIVO ============
   El código del cuadro de texto se mete en un <iframe> con sandbox:
   corre aparte, así un error en el ejemplo no puede romper la página. */
const pgCode = document.getElementById('pgCode');
const pgOut = document.getElementById('pgOut');
const pgStarter = pgCode.value;          // el ejemplo original, para «Restaurar»

function runPlayground() {
    pgOut.srcdoc = pgCode.value;
}
document.getElementById('pgRun').addEventListener('click', runPlayground);
document.getElementById('pgReset').addEventListener('click', () => {
    pgCode.value = pgStarter;
    runPlayground();
});
// Tab escribe dos espacios en vez de saltar al siguiente botón
pgCode.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value } = pgCode;
    pgCode.value = value.slice(0, a) + '  ' + value.slice(b);
    pgCode.selectionStart = pgCode.selectionEnd = a + 2;
});
runPlayground();

/* ============ 2.4: DETECTOR DE TECNOLOGÍAS EMERGENTES ============
   Detección de capacidades: se pregunta al navegador qué puede hacer
   antes de usarlo. Ninguna prueba pide permisos ni enciende la cámara. */
async function checkDevice() {
    const yes = (txt = 'Sí') => `<span class="xr-yes">✓ ${txt}</span>`;
    const no = (txt = 'No') => `<span class="xr-no">✗ ${txt}</span>`;
    const webgl2 = !!document.createElement('canvas').getContext('webgl2');
    let vr = false, ar = false;
    if (navigator.xr) {
        vr = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
        ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    }
    let cams = 0;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        cams = devices.filter((d) => d.kind === 'videoinput').length;
    }
    const rows = [
        ['Gráficos 3D (WebGL 2)', webgl2 ? yes() : no(), 'Dibujar en 3D con la tarjeta gráfica, como el perrito 3D.'],
        ['API de realidad extendida (WebXR)', navigator.xr ? yes() : no(), 'Que el navegador pueda hablar con visores de RV y RA.'],
        ['Realidad virtual inmersiva', vr ? yes('Hay un visor') : no('Sin visor'), 'Ver una escena en un visor que sigue tu cabeza.'],
        ['Realidad aumentada inmersiva', ar ? yes() : no(), 'Poner objetos 3D sobre la imagen de la cámara.'],
        ['Cámara', cams > 0 ? yes(`${cams} encontrada${cams > 1 ? 's' : ''}`) : no('No detectada'), 'Ver el mundo real; base de la RA y los filtros.'],
        ['Sensores de orientación', 'DeviceOrientationEvent' in window ? yes() : no(), 'Saber hacia dónde apunta el celular al moverlo.'],
        ['Pantalla táctil', navigator.maxTouchPoints > 0 ? yes(`${navigator.maxTouchPoints} puntos`) : no(), 'Interactuar con los dedos, por ejemplo pellizcar para acercar.'],
        ['Núcleos del procesador', yes(String(navigator.hardwareConcurrency || '?')), 'Más núcleos permiten más tareas a la vez.'],
        ['Densidad de pantalla', yes(`${window.devicePixelRatio}×`), 'Cuántos píxeles reales tiene cada punto de la página.'],
    ];
    document.getElementById('xrRows').innerHTML = rows
        .map(([name, value, use]) => `<tr><td>${name}</td><td>${value}</td><td>${use}</td></tr>`).join('');
}
document.getElementById('xrRecheck').addEventListener('click', checkDevice);
checkDevice();
