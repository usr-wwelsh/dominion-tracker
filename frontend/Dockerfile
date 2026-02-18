FROM nginx:alpine

# Copy static frontend files
COPY . /usr/share/nginx/html

# Patch the hardcoded localhost API URL to use the nginx proxy path instead
RUN sed -i 's|http://localhost:3000/api|/api|g' /usr/share/nginx/html/js/api.js

# Drop the backend .env file if accidentally copied
RUN rm -f /usr/share/nginx/html/.env

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
