console.log('🌐 NODE_ENV:', process.env.NODE_ENV);
console.log('📦 MONGODB_URI:', process.env.MONGODB_URI);
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
