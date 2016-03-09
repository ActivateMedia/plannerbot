var config = {};

config.app = {};
config.api = {};
config.caldav = {};
config.slack = {};

/* App Settings */
config.app.name = "Activate Planner Server";

/* calDav Settings */
config.caldav.url = "";
config.caldav.username = "";
config.caldav.password = "";
config.caldav.timeFormat = "YYYYMMDDTHHmms";

/* API Settings */
config.api.port = 3000;

/* Slack WebHook Settings */
config.slack.botName = "";
config.slack.emoji = ":calendar:";
config.slack.channel = "";
config.slack.webhook_url = "";

/* Do Not edit the following code */
module.exports = config;
