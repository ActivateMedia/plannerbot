var config = require('./config');
var https = require("https");
var xmljs = require("libxmljs");
var express = require('express');
var caldav = require("node-caldav");
var moment = require('moment-timezone');

/* Initialising Slack Client */
Slack = require('node-slackr');
slack = new Slack(config.slack.webhook_url,{
  channel: config.slack.channel,
  username: config.slack.username,
  icon_emoji: config.slack.emoji
});

/* Initialising Express APP */
var app = express();

/* Root API Endpoint */
app.get('/', function (req, res) {
 res.send('Activate Media Planner!');
});

/* Today Events API Endpoint */
app.get('/get-today-events', function (req, res) {

  getTodayEvents(function(events) {
     events.sort(compare);
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

  var messages = {
    text: "Good morning <!channel|channel>! Here the events for today:",
    channel: config.slack.channel,
    attachments: [
      {
        fallback: "",
        color: "good", // Can either be one of 'good', 'warning', 'danger'
        fields: []
      }
    ]
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
    if(typeof event['LOCATION'] !== "undefined") {
       locationLabel = event['LOCATION'];
    }
    if(locationLabel.length > 0) {
      eventLabels += "\n:pushpin: " + locationLabel;
    }
    
    var notesLabel = "";
    if(typeof event['DESCRIPTION'] !== "undefined") {
       notesLabel = event["DESCRIPTION"];
    }
    if(notesLabel.length > 0) {
      eventLabels += "\n:pencil2: " + notesLabel;
    }

    var _tmpObj = { 
        fallback: "fallback text",
        color: "good", // Can either be one of 'good', 'warning', 'danger'
        fields: [{              
                  title: event.SUMMARY,
                  value: eventLabels,
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
  var query_start_date = moment().subtract(1, 'days').set('hour', 23).set('minute', 59).set('second', 59).format(config.caldav.timeFormat) + "Z";
 var query_end_date = moment().set('hour', 23).set('minute', 59).set('second', 59).format(config.caldav.timeFormat) + "Z";
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
