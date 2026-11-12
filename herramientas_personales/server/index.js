require('./env');
const express = require('express');
const path = require('path');
const { router } = require('./routes');
const { crmRouter } = require('./crm/routes');
const { iniciarProgramador } = require('./crm/mail');
const { clientesRouter, informePublico } = require('./clientes/routes');
const respuestasClientes = require('./clientes/respuestas');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json({ limit: '1mb' }));
app.use('/api/crm/clientes', clientesRouter);
app.use('/api/crm', crmRouter);
// Página pública del informe de cada cliente (sin sesión, con un código difícil de adivinar).
app.use('/', informePublico);
app.use('/api', router);
// La raíz lleva directo al panel personal (CRM).
app.get(['/', '/index.html'], (_req, res) => res.redirect('/crm.html'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`[herramientas] escuchando en el puerto ${PORT}`);
  iniciarProgramador();
  respuestasClientes.iniciar();
});
