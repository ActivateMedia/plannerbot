'use strict';

var util = require('util');
var config = require('./../config');
var http = require("http");
var https = require("https");
var xmljs = require("libxmljs");
var express = require('express');
var caldav = require("node-caldav");
var moment = require('moment-timezone');
var bodyParser = require('body-parser')
var AlchemyAPI = require('alchemy-api');
var Bot = require('slackbots');
var chrono = require('chrono-node');
var NodeCache = require('node-cache');

/* Initialising NodeCache */
//var myCache = new NodeCache();
//var myCache = new NodeCache( { stdTTL: 86400, checkperiod: 86400 } );

//console.log(myCache.getStats());

/* Initialising AlchemyAPI */
var alchemy = new AlchemyAPI(config.alchemyapi.api_key);

/**
 * Constructor function. It accepts a settings object which should contain the following keys:
 *      token : the API token of the bot (mandatory)
 *      name : the name of the bot (will default to "norrisbot")
 *      dbPath : the path to access the database (will default to "data/norrisbot.db")
 *
 * @param {object} settings
 * @constructor
 *
 * @author Luciano Mammino <lucianomammino@gmail.com>
 */
var PlannerBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'plannerbot';
    
    this.user = null;
    
    this.slack = {};
    this.slack.members = new Array();
    //this.slack.channels = new Array();
    
    this.cache = new NodeCache();
};

// inherits methods and properties from the Bot constructor
util.inherits(PlannerBot, Bot);

/**
 * Run the bot
 * @public
 */
PlannerBot.prototype.run = function () {
    PlannerBot.super_.call(this, this.settings);

    this.on('start', this._onStart);
    this.on('message', this._onMessage);
};

/**
 * On Start callback, called when the bot connects to the Slack server and access the channel
 * @private
 */
PlannerBot.prototype._onStart = function () {
    var self = this;
    self._loadBotUser();
    //console.log("Loading PlannerBotn");
    
    // I retrieve all the users part of the team
    var users = self.getUsers();    
    if(typeof users !== "undefined" &&
       typeof users._value !== "undefined" && 
       typeof users._value.members !== "undefined") {
       users._value.members.forEach(function(user, index) {
        //console.log(user.name + " (" + user.id + ")");  
        self.slack.members[user.id] = user.name;          
       });    
    }
    //console.log("PlannerBot Loaded");
    
    // Get Channels
//    var chatId = self.getChatId('U04PXCB5F');
//console.log(self.ims);
    /*
    var channels = self.getChannels();
    if(typeof channels !== "undefined" &&
       typeof channels._value !== "undefined" && 
       typeof channels._value.channels !== "undefined") {
       channels._value.channels.forEach(function(channel, index) {
        console.log(channel.name + " (" + channel.is_member + ")");  
//        self.slack.channel[user.id] = user.name;          
        //console.log(channel);
       });    
    }*/
};


/**
 * On message callback, called when a message (of any type) is detected with the real time messaging API
 * @param {object} message
 * @private
 */
PlannerBot.prototype._onMessage = function (message) {

    var self = this;
    
    if (this._isChatMessage(message) &&        
        !this._isFromPlannerBot(message) &&
        (this._isMentioningPlannerBot(message) || this._isPrivateConversation(message))
    ) {
      
      var event = {};
      event.key = "";
      event.summary = "";      
      event.startDate = "";
      event.endDate = "";
      
      event.location = "";
      event.message = "";
      event.note = "";      
      event.subject = "";
      event.action = ""; 
      event.object = "";
      event.allday = false;
      //event.conversation = new Array();
      
      if(self._isPrivateConversation(message)) {
        event.key = message.channel;
      } else {
        event.key = message.user;
      }      
      
      try{
          // Event found
          event = self.cache.get(event.key, true);

          console.log("=====> Event found! [User " + message.user + "]");
//          console.log(event);

          // I check if the event is valid (with all required informations)
          if(self._isEventValid(event) === true) {
              // I check if the answer is positive or negative 
              this._getTextSentiment(message.text, function(messageSentiment) {
                
                console.log('messageSentiment = ' + messageSentiment);
                if(messageSentiment === "positive") {
                  // I can schedule                  
                  self.cache.del(event.key, function(err, count) {
                    if(!err) {
                      var _msg;                     
                      // I append a random number to the event.key (which is curently the Slack conversation ID)
                      event.key = event.key + "_" + Math.floor(Date.now());
                      caldav.addEvent(event, config.caldav.devUrl, config.caldav.username, config.caldav.password, function(res) {
                        if(res === true) {
                          _msg = "Ok, I have scheduled the event.";
                        } else {
                          _msg = "There was a problem with the connection to the calendar. (We could add some additional AI here)";
                        }
                        self._replyToUser(message.user, _msg);
                      });                      
                      
                    }
                  });                  
                } else if(messageSentiment === "neutral") {
                  // I ask again
                  var _msg = "That wasn't clear to me. Can you please confirm if you wish to schedule the event or not.";
                  self._replyToUser(message.user, _msg);       
                } else {
                  // negative, or anything else I discard the event from the cache
                  self.cache.del(event.key, function(err, count) {
                    if(!err) {
                      var _msg = "Ok, then I won't schedule it.";
                      self._replyToUser(message.user, _msg);
                    }
                  });
                }
              });
          } else if(self._isEventValid(event) === "missing startDate") {
            this._analyzeMessage(event, message, function(response) {
                self._saveEvent(event);
            });
          } else if(self._isEventValid(event) === "missing startTime") {
            // I have asked if there's a specific time for this event, in case the answer is negative
            // I schedule the event for all day
            this._getTextSentiment(message.text, function(messageSentiment) {
              if(messageSentiment === "negative") {
                // All day event
                event.allday = true;
                self._analyzeMessage(event, message, function(response) {
                    self._saveEvent(event);
                });                
              } else {
                // The message might contain the time, so I will try to analyze it
                self._analyzeMessage(event, message, function(response) {
                    self._saveEvent(event);
                });
              }
            });
          }
          
      } catch( err ){
          // Event not found
          console.log("=====> Event not found in cache\n");
          // If the event has no initial message, then it means this is the first message for this event so I want
          // to save the text of the just received message into the event object
          if(event.message === "") {
            event.message = message;
            event.node = message.text; // just in case, for the moment (as backup)
            event.summary = message.text;
          }
          this._analyzeMessage(event, message, function(response){
            // I save the event in cache
            self._saveEvent(event); 
          });
      }    
    }
};

PlannerBot.prototype._analyzeMessage = function (event, newMessage, cb) {
    
  var self = this;

  // Date Extractions
  var results = chrono.parse(newMessage.text);
  results.forEach(function(item, i) {
    if(self._isEventValid(event) === "missing startDate") {
      if(typeof item.start !== "undefined") {
        if (!item.start.isCertain('hour')) {
            item.start.assign('hour', 0);
        }
        event.startDate = item.start.date();
        console.log(event.startDate);
      }      
    } else if(self._isEventValid(event) === "missing startTime") {
      // If the startDate has been already found, I need the time
      if (item.start.isCertain('hour') === true) {
        if(typeof item.start.knownValues.hour !== "undefined") {
          event.startDate = moment(event.startDate).set('hour', item.start.knownValues.hour).format();
        }
        if(typeof item.start.knownValues.minute !== "undefined") {
          event.startDate = moment(event.startDate).set('minute', item.start.knownValues.minute).format();
        }                 
      }
    }
   
    if(typeof item.end !== "undefined") {
      if (!item.end.isCertain('hour')) {
          item.end.assign('hour', 0);
      }        
      event.endDate = item.end.date();     
      console.log("EVENT END DATE!!! => " + event.endDate);  
    }        
  });
    
  // If the event is allday (true) it means that a time hasn't been specified 
  // and the bot has asked the user to confirm that there's no time for this event
  // The endDate will be the same as startDate in case no endDate has been defined by the user
  if(event.allday === false && (event.endDate === "" || moment(event.endDate).isBefore(event.startDate))) {
    console.log("*** EVENT ENDDATE CHANGES!");
    event.endDate = moment(event.startDate).add(1, 'hour');
  } else if(event.allday === true && event.endDate === "") {
    console.log("*** EVENT ENDDATE CHANGES 2!");  
    event.endDate = moment(event.startDate);    
  }
      
  // AlchemyAPI invoked here
  alchemy.combined(newMessage.text, ['TextGetRelations'], {}, function(err, response) {
    if (err) throw err;
    
    // See http://www.alchemyapi.com/api/combined-call/ for format of returned object.
    var relations = response.relations;

    relations.forEach(function(relation, index, array) {
      if(typeof relation.subject !== "undefined" && typeof relation.subject.text !== "undefined") {
        event.subject = relation.subject.text;
      }
      if(typeof relation.action !== "undefined" && typeof relation.action.text !== "undefined") {
        event.action = relation.action.text;
      }
      if(typeof relation.object !== "undefined" && typeof relation.object.text !== "undefined") {
        event.object = relation.object.text;
      }
    });      
    
    // If the event is valid (ready) means that all required fields are filled and I can proceed
    // otherwise I need to ask the missing informations to the user
    if(self._isEventValid(event) === true) {
  
      
    console.log("************ RELATIONS ************");
    console.log(relations);
    if(event.subject === "I") {
       event.summary = event.summary.replace(event.subject, ucfirst(self.slack.members[event.message.user]));
    } else if(event.subject.indexOf(" I") > -1) {
      event.summary = event.summary.replace(" I", " " + ucfirst(self.slack.members[event.message.user]));
    } else if(event.subject === "") {
      event.summary = ucfirst(self.slack.members[event.message.user]) + ": " + event.summary;
    }
  
      // remove "@plannerbot:" from the string 
      var originalMessage = event.summary.replace("<@U0T2V3N4R>: ", "");
    
      // I will ask a confirmation to the user
      // Initialising the message
      var _msg = "Do you want me to schedule `" + originalMessage + "`";
      
      // If the event has a endDate, then I need to display a "period" not a specific date
      var readableDateFormat = "dddd, Do of MMMM, YYYY";
      
      // If the event has start & end dates I will display a period (From .. To ..)
      if(event.endDate !== "") {
        if(moment(event.startDate).hour() > 0 && moment(event.endDate).hour() > 0) {
          readableDateFormat = "HH:mm dddd, Do of MMMM, YYYY"        
        }
        _msg += " from `" + moment(event.startDate).format(readableDateFormat) + "` to `" + moment(event.endDate).format(readableDateFormat) + "`?"; 
      } else {
          // There is no endDate so must be a all-day event
          _msg += " on `" + moment(event.startDate).format(readableDateFormat) + "`?"; 
      }
      
      self._replyToUser(event.message.user, _msg);
    } else {
        
      // The event is not valid, means some of required params (such as startDate) are missing
      if(self._isEventValid(event) === "missing startDate") {
        // I need to ask the startDate to the user
        var _msg = "When is this happening?";
        self._replyToUser(event.message.user, _msg);
      } else if(self._isEventValid(event) === "missing startTime") {
        // I need to ask the startTime to the user      
        var _msg = "Do you have a time for this event, if yes, what time?";
        self._replyToUser(event.message.user, _msg);
      } else {
        var _msg = "Sorry but I have no idea of what is happening";
        self._replyToUser(event.message.user, _msg);
      }
    }
    if(typeof cb === "function") {
      cb(true);
    }    
    
  });   
}

PlannerBot.prototype._isEventValid = function(event) {
  if(event.startDate === "") {
    return "missing startDate";
  } else if(event.allday === false && moment(event.startDate).hour() === 0) {
    return "missing startTime";
  } else if(event.key === "") {
    return "missing key";
  }
  
  return true;
}


/**
 * Return the sentiment of a text (positive|negative|neutral)
 * @param {string} text
 * @param {function} callback function
 * @private
 */
PlannerBot.prototype._getTextSentiment = function (text, cb) {
  var self = this;

  alchemy.sentiment(text, {}, function(err, response) {
    if (err) throw err;

    // See http://www.alchemyapi.com/api/ for format of returned object
    var sentiment = response;

    if(typeof sentiment.docSentiment !== "undefined" &&
       typeof sentiment.docSentiment.type !== "undefined") {
      cb(sentiment.docSentiment.type);
    } else {
      cb("neutral");
    }
  });

};

/**
 * Send a message to a user
 * @param {string} Slack User ID 
 * @param {object} message
 * @private
 */
PlannerBot.prototype._replyToUser = function (user_id, message) {
  var self = this;
//  console.log("Send to " + self.slack.members[user_id] + " ("+user_id+")");
  this.postMessageToUser(self.slack.members[user_id], message, {as_user: true}).fail(function(data) {
    //data = { ok: false, error: 'user_not_found' } 
    console.log(data);
  })
};

/**
 * Save the event object in cache
 * @param {object} event
 * @private
 */
PlannerBot.prototype._saveEvent = function(event) {
  if(typeof event === "undefined" ||
     typeof event.key === "undefined" ||
     typeof event.key === "") {
       return false;
  } else {
    this.cache.set( event.key, event, function( err, success ){
      if( !err && success ){
        console.log("CACHE :: Event saved");
        return true;    
      } else {
        return false;
      }
    });       
  }    
}

/**
 * Check if a specific object exists in cache
 * @param {object} event
 * @private
 */
PlannerBot.prototype._hasEvent = function(event) {
  if(typeof event === "undefined" ||
     typeof event.message === "undefined" ||
     typeof event.message.user === "undefined" ||     
     typeof event.message.user === "") {
       return false;
  } else {
    this.cache.get(event.message.user, function( err, value ){
      if( !err ){
        if(value == undefined){
          // key not found 
          return false;
        }else{
          // key found
          return value;
        }
      }
    });       
  }    
}

/**
 * Loads the user object representing the bot
 * @private
 */
PlannerBot.prototype._loadBotUser = function () {
    var self = this;
    this.user = this.users.filter(function (user) {
        return user.name === self.name;
    })[0];
};

/**
 * Util function to check if a given real time message object represents a chat message
 * @param {object} message
 * @returns {boolean}
 * @private
 */
PlannerBot.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};

/**
 * Util function to check if a given real time message is mentioning Chuck Planner or the norrisbot
 * @param {object} message
 * @returns {boolean}
 * @private
 */
PlannerBot.prototype._isMentioningPlannerBot = function (message) {
    return message.text.indexOf('U0T2V3N4R') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};

/**
 * Util function to check if a given real time message object is directed to the bot as direct message
 * @param {object} message
 * @returns {boolean}
 * @private
 */
PlannerBot.prototype._isPrivateConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'D'
        ;
};

/**
 * Util function to check if a given real time message has ben sent by the norrisbot
 * @param {object} message
 * @returns {boolean}
 * @private
 */
PlannerBot.prototype._isFromPlannerBot = function (message) {
    return message.user === this.user.id;
};

/**
 * Util function to get the name of a channel given its id
 * @param {string} channelId
 * @returns {Object}
 * @private
 */
PlannerBot.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};

function ucfirst(str) {
  //  discuss at: http://phpjs.org/functions/ucfirst/
  // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Onno Marsman
  // improved by: Brett Zamir (http://brett-zamir.me)
  //   example 1: ucfirst('kevin van zonneveld');
  //   returns 1: 'Kevin van zonneveld'

  str += '';
  var f = str.charAt(0)
    .toUpperCase();
  return f + str.substr(1);
}

module.exports = PlannerBot;
