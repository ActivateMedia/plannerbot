## Summary
A CalDAV client written in Node.js that communicates daily events to a [Slack](https://slack.com/) channel.

## Installation
You need `git`, `npm` and `node` installed on your server.

```
git clone https://github.com/ActivateMedia/planner-server/
cd planner-server
npm install
```

## Configuration
```
cp config.sample.js config.js
```

Open `config.js` with your favourite text editor and enter your caldav credentials (URL, username, password) and your Slack details (bot username, icon, channel and webhook url).

To create your Slack webhook [click here](https://api.slack.com/incoming-webhooks)
