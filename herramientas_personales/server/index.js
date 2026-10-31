require('./env');
const express = require('express');
const path = require('path');
const { router } = require('./routes');
const { crmRouter } = require('./crm/routes');
const { iniciarProgramador } = require('./crm/mail');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());
app.use('/api/crm', crmRouter);
app.use('/api', router);
// La raíz lleva directo al panel personal (CRM).
app.get(['/', '/index.html'], (_req, res) => res.redirect('/crm.html'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`[herramientas] escuchando en el puerto ${PORT}`);
  iniciarProgramador();
});
