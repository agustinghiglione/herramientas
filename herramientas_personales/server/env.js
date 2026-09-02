/** Carga las variables de entorno desde .env.local (no se versiona). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
