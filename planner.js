const moment = require('moment-timezone');
const caldav = require("node-caldav-mod");
const Slack = require('node-slackr');
const recur = require('date-recur');

const getTodayEvents = (context) => {
  return new Promise((resolve, reject) => {

    const query_start_date = moment().add(0, 'days').set({'hour': 0, 'minute': 0, 'second': 10}).format('YYYYMMDDTHHmms') + "Z";
    const query_end_date = moment().add(0, 'days').set({'hour': 23, 'minute': 59, 'second': 59}).format('YYYYMMDDTHHmms') + "Z";

    const output = {};
    output.start_date = query_start_date;
    output.end_date = query_end_date;

    caldav.getEvents(
      context.secrets.CALDAV_URL || '',
      context.secrets.CALDAV_USER || '',
      context.secrets.CALDAV_PASSWORD || '',
      query_start_date,
      query_end_date, (res) => {
        console.log('getEvents', res.length);
        resolve(res);
    });
  });
};

const postTodayEvents = (context, events) => {
  return new Promise((resolve, reject) => {

    const slack = new Slack(context.secrets.SLACK_WEBHOOK, {
      channel: context.secrets.SLACK_CHANNEL,
      username: context.secrets.SLACK_USERNAME,
      icon_emoji: context.secrets.SLACK_EMOJI
    });

    var goodMorningMsg = "Good morning <!channel|channel>! Here the events for today:";

    if(events.length === 0) {
       goodMorningMsg = "Good morning! There are no events in the calendar today.";
    }

    var messages = {
      text: goodMorningMsg,
      channel: context.secrets.SLACK_CHANNEL || '',
      attachments: []
    };

    console.log('Total => ', events.length)
    // console.log(events);

    events.forEach(function(event) {
      // 1-Instance     DTSTART:19961027T020000
      // Recurring X     DTSTART;TZID=Europe/Zurich:20160107T090000
      // Recurring Y    DTSTART;TZID=Europe/London:20170628T100000
      // Recurring     DTSTART;TZID=Europe/London:20170627T090000
      // var summary = event.getFirstPropertyValue('summary');

      var tzid = event.getFirstProperty('dtstart').getParameter('tzid');
      var eventLabels = "";
      var startDate = event.getFirstProperty('dtstart').getFirstValue().toString();
      // var _m1 = moment(startDate);
      // console.log('tzid', tzid)
      // console.log('startDate', startDate)
      // console.log('same day', moment().isSame(_m1, 'day'))

      // console.log(summary, tzid, startDate, moment().add(0, 'days').isSame(_m1, 'day'))

      // var endDate = event.getFirstProperty('dtend').getFirstValue().toString();
      // var rrule = event.getFirstPropertyValue('rrule');
    //   if(typeof rrule !== 'undefined' && rrule !== null) {
    //     var freq = rrule.freq || '';
    //     var interval = rrule.interval || '';
    //     var recurStartDate = moment(startDate).format("YYYY-MM-DD");
    //     var recurEndDate = moment(endDate).format("YYYY-MM-DD");
    //     var recurMatch = recur().start(recurStartDate).end(recurEndDate);
    //
    // var summary = event.getFirstPropertyValue('summary');
    //
    //     switch(freq) {
    //       case 'DAYLY':
    //         if(interval) recurMatch.setDailyInterval(interval);
    //         break;
    //       case 'WEEKLY':
    //         if(interval) recurMatch.setWeeklyInterval(interval);
    //         break;
    //       case 'MONTHLY':
    //         if(interval) recurMatch.setMonthlyInterval(interval);
    //         break;
    //       case 'YEARLY':
    //         if(interval) {
    //           recurMatch.setYearlyInterval(interval);
    //         }
    //         break;
    //       default:
    //     }
    //
    //     var queryDate = moment().add(1, 'days').format('YYYY-MM-DD');
    //     var matches = recurMatch.matches(queryDate);
    //     console.log(`*** Event: ${summary}  ****`);
    //     console.log('recurMatch = ', recurMatch);
    //     console.log('queryDate = ', queryDate);
    //     console.log(`matches = `, matches);
    //     console.log('     ');

        // var fri13th = recur('2012-01-13').setDayOfMonth(13).setDayOfWeek(5);
// console.log(fri13th.matches('2012-01-13'));
// console.log(fri13th.matches(new Date('2012-01-13'))); // jan 2011 is true
// console.log(fri13th.matches('2012-02-13'));           // feb 2012 is false
// console.log(fri13th.matches(new Date('2012-02-13'))); // feb 2012 is false
        // var rInterval = moment(startDate).recur().every(2).days();
        // var fri13th = recur().setDayOfMonth(13).setDayOfWeek(5);

        // {
        // "freq": "DAILY",
        // "interval": 2
        // }

        // "recur",
        // {
        // "freq": "WEEKLY",
        // "interval": 7,
        // "byday": [
        // "SU",
        // "MO",
        // "TU",
        // "WE",
        // "TH",
        // "FR",
        // "SA"
        // ],
        // "wkst": 1
        // }

      // }

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
        if(moment().add(0, 'days').isSame(_m1, 'day') === false) {
          return;
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
                          },
                          {
                          "tzid": "America/Sao_Paulo",
                          "icon": ":flag-br:"
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

      const randomHexColor = '#' + ("000000" + Math.random().toString(16).slice(2, 8).toUpperCase()).slice(-6);
      const _tmpObj = {
          fallback: "fallback text",
          color: randomHexColor,
          fields: [{
            title: stripslashes(summary),
      		  value: stripslashes(eventLabels),
            short: false
          }]
      };
      messages.attachments.push(_tmpObj);
    });

    slack.notify(messages, (err, result) => {
      if (err !== null) {
        console.log(err, result);
        resolve(true);
      } else {
        reject(err);
      }
    });
  });
};

/*
 * Default webtask return function
 */
module.exports = function(context, callback) {
  getTodayEvents(context)
  .then(events => {
    events.sort(compare);
    postTodayEvents(context, events)
    .then(result => {
      callback(null, events);
      // console.log(result);
    })
    .catch(error => {
      callback(error, null);
      console.error(error);
    });
  })
  .catch(error => {
    callback(error, null);
    console.error(error);
  })

}

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

function compare(a,b) {

  var startDate_a = a.getFirstProperty('dtstart').getFirstValue().toString();
  var startDate_b = b.getFirstProperty('dtstart').getFirstValue().toString();

  if (a[startDate_a] < b[startDate_b])
    return -1;
  else if (a[startDate_a] > b[startDate_b])
    return 1;
  else
    return 0;
}
