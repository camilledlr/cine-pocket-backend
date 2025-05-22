var express = require('express');
const cors = require('cors');


const connectDB = require('./config/db');
connectDB(); // Connecte MongoDB au lancement
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const filmsRouter = require('./routes/api/films');
const listsRouter = require('./routes/api/lists');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
app.use(cors({
  origin: '*', // ou '*' temporairement
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // uniquement si tu envoies des cookies / headers auth
}));
app.options('*', cors()); // <== très important pour les requêtes preflight
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/films', filmsRouter);
app.use('/api/lists', listsRouter);


module.exports = app;
