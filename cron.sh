wt cron schedule "30 3 * * 1-5" ./planner.js \
  --secret CALDAV_URL=https://caldav.fastmail.com/dav/calendars/zzzz/greg@activate.co.uk/4274ad11-3670-4177-b275-7a2cb104c8b5/ \
  --secret CALDAV_USER=gianpaolo@activate.co.uk \
  --secret CALDAV_PASSWORD=wwy2cuwtwqhznr65 \
  --secret SLACK_WEBHOOK=https://hooks.slack.com/services/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 \
  --secret SLACK_CHANNEL="#planner" \
  --secret SLACK_USERNAME=PlannerBot \
  --secret SLACK_EMOJI=":spiral_calendar_pad:" \
  --tz UTC
