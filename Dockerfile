# Pre-built Dockerfile — expects `dist/` to already exist from local `npm run build`
FROM nginx:alpine

# Copy nginx config as template (contains ${OPENROUTER_API_KEY} placeholder)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy pre-built dist files
COPY dist/ /usr/share/nginx/html/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Default empty key — overridden at deploy time via env var
ENV OPENROUTER_API_KEY=""

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
