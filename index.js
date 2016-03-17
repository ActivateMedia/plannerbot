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

var myCache = new NodeCache();

var plannerbot = new PlannerBot({
    token: config.slack.bot_token,
    name: config.slack.username.toLowerCase()
});

plannerbot.run();

//plannerbot.getChannels(function(data){
//	console.log("getChannels");
//	console.log(data);
//});
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

/* Event Scheduler */
app.post('/schedule', function(req, res) {
	//console.log(req.body);
	var user_name = req.body.user_name;
  res.send("OK " + user_name);
});

/* Root API Endpoint */
app.get('/', function (req, res) {
 res.send('Activate Media Planner!');
});

/* Today Events API Endpoint */
app.get('/today', function (req, res) {

  getTodayEvents(function(events) {
     events.sort(compare);
     // console.log(events);
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
  
  var startDate_a = findPropertyNameByRegex(a, "DTSTART");
  var startDate_b = findPropertyNameByRegex(b, "DTSTART");

  if (a[startDate_a] < b[startDate_b])
    return -1;
  else if (a[startDate_a] > b[startDate_b])
    return 1;
  else 
    return 0;
}

function postTodayEvents(events, cb) {
 
  var goodMorningMsg = "Good morning <!channel|channel>! Here the events for today:";

  if(events.length === 0) {
     goodMorningMsg = "Good morning from PlannerBot! There are no events in the calendar today.";
  }

  var messages = {
    text: goodMorningMsg,
    channel: config.slack.channel,
    attachments: []
  };

  events.forEach(function(event) {
   
    var eventLabels = "";
    var startDate = findPropertyNameByRegex(event, "DTSTART");
    var startDateLabel = "";
    if(event[startDate].length == 8) {
      //es 20160309
      startDateLabel = "All day";
    } else {
      var endDate = findPropertyNameByRegex(event, "DTEND");
      var _m1 = moment(event[startDate]);
      var _m2 = moment(event[endDate]);
      var ukTime = ":uk: " + _m1.tz("Europe/London").format('h:mm a') + " - " + _m2.tz("Europe/London").format('h:mm a');
      var swissTime = ":flag-ch: " + _m1.tz("Europe/Zurich").format('h:mm a') + " - " + _m2.tz("Europe/Zurich").format('h:mm a');
      var delhiTime = ":flag-in: " + _m1.tz("Asia/Colombo").format('h:mm a') + " - " + _m2.tz("Asia/Colombo").format('h:mm a');
      startDateLabel = ukTime + " / " + swissTime + " / " + delhiTime;
    }
    eventLabels += startDateLabel;
    var locationLabel = "";
    if(typeof event.LOCATION !== "undefined") {
       locationLabel = event.LOCATION;
    }
    if(locationLabel.length > 0) {
      eventLabels += "\n:pushpin: " + locationLabel;
    }
    
    var notesLabel = "";
    if(typeof event.DESCRIPTION !== "undefined") {
       if(event.DESCRIPTION.indexOf(event.SUMMARY) < 0) {
       	    notesLabel = event.DESCRIPTION;
	}
    }    
    if(notesLabel.length > 0) {
      eventLabels += "\n:pencil2: " + notesLabel;
    }

    var _tmpObj = { 
        fallback: "fallback text",
        color: config.slack.eventColor,
        fields: [{              
                  title: stripslashes(event.SUMMARY),
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


app.get('/cache/keys', function(req, res) {
  plannerbot.cache.keys( function( err, mykeys ){
    if( !err ){
      console.log( mykeys );
     // [ "all", "my", "keys", "foo", "bar" ] 
    }
  });
});

app.get('/cache/key', function(req, res) {
  var key = "D0T2HNJG6";
  var event = plannerbot.cache.get(key);
  if(typeof event !== "undefined") {
    console.log(event);    
  } else {
    console.log("Object not found");
  }

});




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
