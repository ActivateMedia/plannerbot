'use strict';

var util = require('util');
var config = require('./config');
var https = require("https");
var xmljs = require("libxmljs");
var express = require('express');
var caldav = require("node-caldav");
var moment = require('moment-timezone');
var bodyParser = require('body-parser')
var AlchemyAPI = require('alchemy-api');
var Bot = require('slackbots');
var PlannerBot = require('./lib/plannerbot');
var NodeCache = require('node-cache');
var wit = require('node-wit');

var myCache = new NodeCache();

var plannerbot = new PlannerBot({
    token: config.slack.bot_token,
    name: config.slack.username.toLowerCase(),
    max_timeout: 5,
    cleaning_interval: 60000
});

plannerbot.run();

function wit_test() {
   wit.captureTextIntent(config.wit.access_token, "Hello world", function (err, res) {
    console.log("Response from Wit for text input: ");
    if (err) console.log("Error: ", err);
      console.log(JSON.stringify(res, null, " "));
    });
}

//wit_test();

/* Initialising AlchemyAPI */
var alchemy = new AlchemyAPI(config.alchemyapi.api_key);

/* Initialising Express APP */
var app = express();

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

/* Initialising Slack Client */
var Slack = require('node-slackr');
var slack = new Slack(config.slack.webhook_url,{
  channel: config.slack.channel,
  username: config.slack.username,
  icon_emoji: config.slack.emoji
});

/* Root API Endpoint */
app.get('/', function (req, res) {
 res.send('Hi, I\'m PlannerBot!');
});

/* Today Events API Endpoint */
app.get('/today', function (req, res) {

  getTodayEvents(function(events) {
     events.sort(compare);
     //console.log(events);
     postTodayEvents(events, function(result) {
         console.log("Slack message has been sent");
         res.send("Slack message sent successfully");
     });    
  });
});

var findPropertyNameByRegex = function(o, r) {
  var key;
  for (key in o) {
    if (key.match(r)) {
      return key;
    }
  }
  return undefined;
};

function compare(a,b) {
  
  var startDate_a = a.getFirstProperty('dtstart').getFirstValue().toString();//findPropertyNameByRegex(a, "DTSTART");
  var startDate_b = b.getFirstProperty('dtstart').getFirstValue().toString();//findPropertyNameByRegex(b, "DTSTART");

  if (a[startDate_a] < b[startDate_b])
    return -1;
  else if (a[startDate_a] > b[startDate_b])
    return 1;
  else 
    return 0;
}

function postTodayEvents(events, cb) {
 
  var goodMorningMsg = "Hello <!channel|channel>! Here the events for today:";

  if(events.length === 0) {
     goodMorningMsg = "Hello from PlannerBot! There are no events in the calendar today.";
  }

  var messages = {
    text: goodMorningMsg,
    channel: config.slack.channel,
    attachments: []
  };

  events.forEach(function(event) {

   //console.log("******************************");
   //var _tmp = event.getFirstProperty('dtstart').getFirstValue().toString();
   //console.log(_tmp);
   //console.log("******************************\n");
   
      
    var tzid = event.getFirstProperty('dtstart').getParameter('tzid');
    var eventLabels = "";
    var startDate = event.getFirstProperty('dtstart').getFirstValue().toString();
    
    var startDateLabel = "";
    if(startDate.length <= 10) {
      //es 2016-03-09 or 20130309
      startDateLabel = "All day";
    } else {
      var endDate = event.getFirstProperty('dtend').getFirstValue().toString();      
      
      if(typeof tzid !== "undefined") {
        var _m1 = moment.tz(startDate, tzid);
        var _m2 = moment.tz(endDate, tzid);        
      } else {
        // Floating Timezone or Undefined
        var _m1 = moment(startDate);
        var _m2 = moment(endDate);        
      }
      
      var timezones = [{
                         "tzid": "Europe/London",
                         "icon": ":uk:"
                        },
                        {
                         "tzid": "Europe/Zurich",
                         "icon": ":flag-ch:"
                        },
                        {
                         "tzid": "Asia/Colombo",
                         "icon": ":flag-in:"
                        }];
      
      for (var i = 0, len = timezones.length; i < len; i++) {
        var _tmp = timezones[i].icon + " " + _m1.tz(timezones[i].tzid).format('HH:mm') + " - " + _m2.tz(timezones[i].tzid).format('HH:mm');
        if(i < len) {
          startDateLabel += "\n";
        }
        startDateLabel += _tmp;
      }
    }
    eventLabels += startDateLabel;
    var locationLabel = "";
    var location = event.getFirstPropertyValue('location');
    if(location !== null) {
       locationLabel = location;
    }
    if(locationLabel.length > 0) {
      eventLabels += "\n:pushpin: " + locationLabel;
    }
    
    var notesLabel = "";
    var description = event.getFirstPropertyValue('description');
    var summary = event.getFirstPropertyValue('summary');
    if(description !== null) {
       if(description.indexOf(summary) < 0) {
       	    notesLabel = description;
    	 }
    }    
    if(notesLabel.length > 0) {
      eventLabels += "\n:pencil2: " + notesLabel;
    }
    
    
    
    var _tmpObj = { 
        fallback: "fallback text",
        color: config.slack.eventColor,
        fields: [{              
                  title: stripslashes(summary),
		  value: stripslashes(eventLabels),
                  short: false
                 }]
    }; 
    messages.attachments.push(_tmpObj);
  });

  slack.notify(messages, function(err, result) {
    if(err !== null) {
      console.log(err, result);
    }
  });

  cb(true);
}

/*
 * This function retrieves the events from the calendar and return an array of objects
 */
function getTodayEvents(cb) {
  var query_start_date = moment().set({'hour': 0, 'minute': 0, 'second': 10}).format(config.caldav.timeFormat) + "Z";
  var query_end_date = moment().set({'hour': 23, 'minute': 59, 'second': 59}).format(config.caldav.timeFormat) + "Z"; 
  var output = {};
  output.start_date = query_start_date;
  output.end_date = query_end_date;

  caldav.getEvents(config.caldav.url, config.caldav.username, config.caldav.password, query_start_date, query_end_date, function(res) {
     cb(res);
  });
}

/*
 * Main Express Process 
 */
app.listen(3000, function () {
 console.log(config.app.name + ' listening on port ' + config.api.port);
});


/*
 * Prints the cache object keys currently stored in cache
 */
app.get('/cache/keys', function(req, res) {
  plannerbot.cache.keys( function( err, mykeys ){
    if( !err ){
      console.log( mykeys );
    }
  });
});

/*
 * Prints the content of a specific cache object by key
 */
app.get('/cache/key', function(req, res) {
  var key = "D0T2HNJG6";
  var event = plannerbot.cache.get(key);
  if(typeof event !== "undefined") {
    console.log(event);    
  } else {
    console.log("Object not found");
  }
});


/* Alchemy API calls */
app.get('/alchemyapi/status', function(req, res) {
  alchemy.apiKeyInfo({}, function(err, response) {
    if (err) throw err;

    // Do something with data
    res.send("<p>Status: " + response.status + "</p><p>Consumed: " + response.consumedDailyTransactions + "</p><p>Limit: " + response.dailyTransactionLimit + "</p>");
  });
});
app.get('/alchemyapi/combined', function(req, res){
  var params = req.query;
  console.log(params);
  if(typeof params.data === "undefined" || params.data.length == 0) {
     res.send("Data missing");
  } else {
    var features_array = params.features.split(',');
    console.log(features_array);
    alchemy.combined(params.data, features_array, {}, function(err, response) {
      if (err) throw err;
      res.send(response);
      //var keywords = response.keywords;
      //res.send(keywords);
    });
  }
})
app.get('/alchemyapi/date', function(req, res){
  var params = req.query;
  if(typeof params.data === "undefined" || params.data.length == 0) {
     res.send("Data missing");
  } else {
    alchemy.date(params.data, {}, function(err, response) {
      if (err) throw err;
      res.send(response);
    });
  }
});
app.get('/alchemyapi/concepts', function(req, res){
  var params = req.query;
  console.log(params.data);
  if(typeof params.data === "undefined" || params.data.length == 0) {
     res.send("Data missing");
  } else {
    alchemy.concepts(params.data, {}, function(err, response) {
      if (err) throw err;
      var concepts = response.concepts;
      res.send(concepts);
    });
  }
});
app.get('/alchemyapi/relations', function(req, res){
  var params = req.query;
  console.log(params.data);
  if(typeof params.data === "undefined" || params.data.length == 0) {
     res.send("Data missing");
  } else {
    alchemy.relations(params.data, {}, function(err, response) {
      if (err) throw err;
      var relations = response.relations;
      res.send(relations);
    });
  }
});
app.get('/alchemyapi/keywords', function(req, res){
  var params = req.query;
  if(typeof params.data === "undefined" || params.data.length == 0) {
     res.send("Data missing");
  } else {
    alchemy.keywords(params.data, {}, function(err, response) {
      if (err) throw err;
      var keywords = response.keywords;
      res.send(keywords);
    });
  }
});

function stripslashes(str) {
  //       discuss at: http://phpjs.org/functions/stripslashes/
  //      original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //      improved by: Ates Goral (http://magnetiq.com)
  //      improved by: marrtins
  //      improved by: rezna
  //         fixed by: Mick@el
  //      bugfixed by: Onno Marsman
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //         input by: Rick Waldron
  //         input by: Brant Messenger (http://www.brantmessenger.com/)
  // reimplemented by: Brett Zamir (http://brett-zamir.me)
  //        example 1: stripslashes('Kevin\'s code');
  //        returns 1: "Kevin's code"
  //        example 2: stripslashes('Kevin\\\'s code');
  //        returns 2: "Kevin\'s code"

  return (str + '')
    .replace(/\\(.?)/g, function(s, n1) {
      switch (n1) {
      case '\\':
        return '\\';
      case '0':
        return '\u0000';
      case '':
        return '';
      default:
        return n1;
      }
    });
}
