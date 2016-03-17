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
      
      if(self._isPrivateConversation(message)) {
        event.key = message.channel;
      } else {
        event.key = message.user;
      }      
      
      try{
          // Event found
          event = self.cache.get(event.key, true);
          console.log("I have found an event for the user " + message.user);
          console.log(event);
          // I check if the event is valid (with all required informations)
          if(self._isEventValid(event) === true) {
              // I check if the answer is positive or negative 
              this._getTextSentiment(message.text, function(messageSentiment) {
                
                console.log('messageSentiment = ' + messageSentiment);
                if(messageSentiment === "positive") {
                  // I can schedule
                } else if(messageSentiment === "neutral") {
                  // I ask again
                } else {
                  // negative, or anything else I discard the event from the cache
                  self.cache.del(event.key, function(err, count) {
                    if(!err) {
                      var _msg = "Ok, got it";
                      self._replyToUser(message.user, _msg);
                    }
                  });
                }
              });
          } else {            
              // I need to ask the missing informations
            
          }
          
      } catch( err ){
          // Event not found
          console.log("CACHE: Event not found\n");
          this._analyzeMessage(message);            
      }    
    }
};

/**
 * Return the sentiment of a text (positive|negative|neutral)
 * @param {object} message
 * @private
 */
PlannerBot.prototype._getTextSentiment = function (text, cb) {
  var self = this;

  alchemy.sentiment(text, {}, function(err, response) {
    if (err) throw err;

    // See http://www.alchemyapi.com/api/ for format of returned object
    var sentiment = response;

    // Do something with data
    if(typeof sentiment.docSentiment !== "undefined" &&
       typeof sentiment.docSentiment.type !== "undefined") {
       console.log("**********sentiment******");
       console.log(sentiment);
       console.log("*********docSentiment*******");       
       console.log(sentiment.docSentiment);
       console.log("*********TYPE*******");       
       console.log(sentiment.docSentiment.type);       
       console.log("****************");       
      cb(sentiment.docSentiment.type);
    } else {
      cb("neutral");
    }
  });

};

/**
 * Respond to a message
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

PlannerBot.prototype._hasEvent = function(event) {
  if(typeof event === "undefined" ||
     typeof event.message === "undefined" ||
     typeof event.message.user === "undefined" ||     
     typeof event.message.user === "") {
       console.log("NOT HERE!!!!");
       return false;
  } else {
    this.cache.get(event.message.user, function( err, value ){
      if( !err ){
        if(value == undefined){
          // key not found 
          return false;
        }else{
          // key found
          console.log("CACHE :: Event found");
          console.log(value);
          return value;
        }
      }
    });       
  }    
}



PlannerBot.prototype._analyzeMessage = function (message) {
    
  var self = this;
  //console.log('PlannerBot::_analyzeMessage');
  var results = chrono.parse(message.text)
  
  var event = {};
  event.key = "";
  event.message = message;
  event.note = message.text;
  event.startDate = "";
  event.endDate = "";
  event.location = "";
  event.subject = "";
  event.action = ""; 
  event.object = "";
  
  if(self._isPrivateConversation(message)) {
    event.key = message.channel;
  } else {
    event.key = message.user;
  }
//console.log(message);
  
//  console.log("========================");
//  console.log(message.text);  
//  console.log(results);
  results.forEach(function(item, i) {
    //console.log("   => Text = " + item.text);
    //console.log("   => Ref = " + item.ref);    
    //console.log("   => Start Date = " + item.start.date());        
    //console.log("   => End Date = " + item.end.date());            
    if(typeof item.start !== "undefined") {
      event.startDate = item.start.date();
    }
    if(typeof item.end !== "undefined") {
      event.endDate = item.end.date();
    }    
  });
//  console.log("========================");  
  

  // AlchemyAPI invoke here
//  var requirements = {text: "", subject: "", action: "", object: ""};

  alchemy.combined(message.text, ['TextGetRelations'], {}, function(err, response) {
    if (err) throw err;
    
//    console.log("========= " + message.text + " ==============");
//    console.log(response);
//    console.log("========================");    
    
    // See http://www.alchemyapi.com/api/combined-call/ for format of returned object.
    var relations = response.relations;
//    console.log(relations);
    // Do something with data
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
  });

  // remove @plannerbot: from the string 
  var originalMessage = message.text.replace("<@U0T2V3N4R>: ", "");
  if(self._isEventValid(event)) {
    self._saveEvent(event);
    var event_readable_date = moment(event.startDate);
    var _msg = "Do you want me to schedule `" + originalMessage + "` on `" + event_readable_date.format("dddd, Do of MMMM, YYYY") + "`?";
    self._replyToUser(message.user, _msg);
  }

}

PlannerBot.prototype._isEventValid = function(event) {
  if(event.startDate === "") {
    return "missing startDate";
  } else if(event.key === "") {
    return "missing key";
  }
  
  return true;
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

module.exports = PlannerBot;
