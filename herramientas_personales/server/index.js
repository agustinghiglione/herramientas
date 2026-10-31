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
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`[herramientas] escuchando en el puerto ${PORT}`);
  iniciarProgramador();
});
