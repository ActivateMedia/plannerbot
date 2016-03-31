## Summary
A CalDAV client written in Node.js that communicates daily events to a [Slack](https://slack.com/) channel.

## Installation
You need `git`, `npm` and `node` installed on your server.

```
git clone https://github.com/ActivateMedia/planner-server/
cd planner-server
npm install
cd node_modules
git clone https://github.com/andreafalzetti/node-caldav
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

## Run the application [Development]
From the root of the app run `node index.js` or using `npm start`.

## Run the application [Production]
To run the Node.js application in background we are using [Forever](https://github.com/foreverjs/forever).
With the following commands you can start/stop the app.
```
forever list (List all running processes)
forever stop ID (Kills the process)
forever start index.js (Start the process in background)
```

All commands should be executed using the dedicated user **planner**.
