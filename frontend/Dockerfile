FROM nginx:alpine

# Copy static frontend files
COPY . /usr/share/nginx/html

# Drop the backend .env file if accidentally copied
RUN rm -f /usr/share/nginx/html/.env

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
