var config = require('./config');
var https = require("https");
var xmljs = require("libxmljs");
var express = require('express');
var caldav = require("node-caldav");
var moment = require('moment-timezone');
var app = express();

app.get('/', function (req, res) {
 res.send('Activate Media Planner!');
 console.log(moment().day());
});

app.get('/get-today-events', function (req, res) {
 var query_start_date = moment().subtract(1, 'days').set('hour', 23).set('minute', 59).set('second', 59).format(config.caldav.timeFormat) + "Z";
 var query_end_date = moment().set('hour', 23).set('minute', 59).set('second', 59).format(config.caldav.timeFormat) + "Z";
 var output = {}; 
 output.start_date = query_start_date;
 output.end_date = query_end_date;
 res.send(output);

 caldav.getEvents(config.caldav.url, config.caldav.username, config.caldav.password, query_start_date, query_end_date, function(res) {
    console.log(res);
    
 });
});


app.listen(3000, function () {
 console.log(config.app.name + ' listening on port ' + config.api.port);
});
