const express = require('express');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3014;

['uploads/images', 'uploads/workflows'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/prompts/public', express.static(path.join(__dirname, 'public')));
app.use('/prompts/uploads', express.static(path.join(__dirname, 'uploads')));

const promptsRouter = require('./routes/prompts');
const workflowsRouter = require('./routes/workflows');

app.use('/prompts/workflows', workflowsRouter);
app.use('/prompts', promptsRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

if (require.main === module) {
  app.listen(PORT, '127.0.0.1', () => console.log(`Prompt library on port ${PORT}`));
}

module.exports = app;
