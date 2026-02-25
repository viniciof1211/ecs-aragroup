#!/bin/sh
# Substitute only $OPENROUTER_API_KEY in nginx template, leaving nginx vars ($uri etc.) intact
envsubst '${OPENROUTER_API_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD (nginx)
exec "$@"
