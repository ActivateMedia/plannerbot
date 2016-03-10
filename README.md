## Summary
A CalDAV client written in Node.js that communicates daily events to a [Slack](https://slack.com/) channel.

## Installation
You need `git`, `npm` and `node` installed on your server.

```
git clone https://github.com/ActivateMedia/planner-server/
cd planner-server
npm install
cd node_modules
git clone https://github.com/rexromae/node-caldav
```

## Configuration
```
cp config.sample.js config.js
```

Open `config.js` with your favourite text editor and enter your caldav credentials (URL, username, password) and your Slack details (bot username, icon, channel and webhook url).

To create your Slack webhook [click here](https://api.slack.com/incoming-webhooks)

## Add a cronjob
It will call the API `today` Mon-Fri at 8:00 am
```
0 8 * * 1-5 wget --timeout=360000 --quiet -O /dev/null http://your-domain:your-port/today
```
