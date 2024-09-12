const puppeteer = require('puppeteer');
const axios = require('axios');
const randomName = require('random-name');
require('dotenv').config();

// Generar nombre completo aleatorio con 'random-name'
function generarNombreAleatorio() {
    const nombre = randomName.first();
    const apellido1 = randomName.last();
    const apellido2 = randomName.last();
    return `${nombre} ${apellido1} ${apellido2}`;
}

// Función para generar correos electrónicos aleatorios
function generarCorreoAleatorio(nombreCompleto) {
    const dominios = ['gmail.com', 'hotmail.com'];
    const nombre = nombreCompleto.toLowerCase().replace(/\s+/g, '.');
    const numero = Math.floor(Math.random() * 1000);
    const dominio = dominios[Math.floor(Math.random() * dominios.length)];
    return `${nombre}${numero}@${dominio}`;
}

// Resolver hCaptcha usando la API de 2Captcha con manejo de errores
async function resolverCaptchaCon2Captcha(page) {
    try {
        const siteKey = await page.evaluate(() => {
            const captchaElement = document.querySelector("#exampleModal > div > div > div.modal-body > div.h-captcha");
            if (captchaElement) {
                return captchaElement.getAttribute('data-sitekey');
            } else {
                throw new Error("Sitekey de hCaptcha no encontrado");
            }
        });

        const url = page.url();
        const apiKey = process.env.CAPTCHA_API_KEY;

        // Solicitar resolución de hCaptcha a 2Captcha
        const respuesta = await axios.post(`http://2captcha.com/in.php?key=${apiKey}&method=hcaptcha&sitekey=${siteKey}&pageurl=${url}`);

        const captchaId = respuesta.data.split('|')[1];

        // Verificar la resolución del captcha
        let captchaToken = '';
        while (!captchaToken) {
            await new Promise(resolve => setTimeout(resolve, 7000));  // Esperar 7 segundos entre verificaciones

            const resultado = await axios.get(`http://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}`);

            if (resultado.data.includes('OK|')) {
                captchaToken = resultado.data.split('|')[1];
            } else if (resultado.data === 'CAPCHA_NOT_READY') {
                console.log('Captcha aún no resuelto, reintentando...');
            } else {
                throw new Error("Error al verificar el resultado del captcha: " + resultado.data);
            }
        }

        // Colocar el token en el campo correspondiente
        await page.evaluate(`document.querySelector('[name="h-captcha-response"]').innerText="${captchaToken}";`);
        console.log('Captcha resuelto y token aplicado');
    } catch (error) {
        console.error("Error al resolver el captcha: ", error.message);
        throw error;
    }
}

// Función principal para enviar solicitudes en bucle infinito
async function ejecutarSolicitud() {
    let browser;
    try {
        const nombreCompleto = generarNombreAleatorio();  // Generar nombre aleatorio
        const correoAleatorio = generarCorreoAleatorio(nombreCompleto);  // Generar correo basado en el nombre

        console.log(`Nombre generado: ${nombreCompleto}`);
        console.log(`Correo generado: ${correoAleatorio}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        const page = await browser.newPage();
        await page.goto('https://premiaciones.utel.edu.mx/nominado/c3d5ac9a-d97e-4a35-89e9-adcc12d97b8a');

        // Interacción inicial con la página
        await page.waitForSelector('body > div.container.py-5.n-text > div > div.col-12.col-md-4 > div > button.btn.btn-primary.w-100');
        await page.click('body > div.container.py-5.n-text > div > div.col-12.col-md-4 > div > button.btn.btn-primary.w-100');

        // Llenar el formulario
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.waitForSelector('#email');
        await page.waitForSelector('#name');
        await page.type('#email', correoAleatorio, { delay: 100 });
        await page.type('#name', nombreCompleto, { delay: 100 });
        await page.click('#checkAvisos');

        // Resolver el captcha
        await resolverCaptchaCon2Captcha(page);

        // Enviar el formulario
        await page.waitForSelector('#submitButton');
        await page.click('#submitButton');
        await new Promise(resolve => setTimeout(resolve, 10000));

        
        console.log('Formulario enviado');
    } catch (error) {
        console.error("Error en el proceso: ", error.message);
    } finally {
        if (browser) {
            await browser.close();
        }

        // Esperar 40 segundos antes de la próxima ejecución
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Ejecutar la siguiente solicitud en loop infinito
        ejecutarSolicitud();
    }
}

// Iniciar el loop infinito
ejecutarSolicitud();
