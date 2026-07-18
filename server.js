const express = require('express');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3014;

['uploads/images', 'uploads/workflows/generated', 'uploads/workflows/imported'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));
app.use('/prompts/public', express.static(path.join(__dirname, 'public')));
app.use('/prompts/uploads', express.static(path.join(__dirname, 'uploads')));

const cfg = require('./config');
const promptsRouter = require('./routes/prompts');
const settingsRouter = require('./routes/settings');

app.use((req, res, next) => { res.locals.isPaid = cfg.isPaid(); next(); });
const workflowsRouter = require('./routes/workflows');
app.use('/prompts/workflows', workflowsRouter);
app.use('/prompts/settings', settingsRouter);
if (process.env.IMAGE_GEN) {
  const imagegenRouter = require('./routes/imagegen');
  app.use('/prompts/imagegen', imagegenRouter);
}
app.get('/', (req, res) => res.redirect('/prompts'));
app.use('/prompts', promptsRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Prompt library on port ${PORT}`));
}

module.exports = app;
