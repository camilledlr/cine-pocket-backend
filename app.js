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
app.use(cors());
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
