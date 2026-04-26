# Build stage
FROM node:18-slim AS build
WORKDIR /app

# Copy the web package files and install dependencies
COPY web/package*.json ./web/
RUN cd web && npm install

# Copy the rest of the web code
COPY web/ ./web/

# Build the web app
RUN cd web && npm run build

# Production stage using Nginx
FROM nginx:alpine

# Copy the built files to Nginx
COPY --from=build /app/web/dist /usr/share/nginx/html

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Configure Nginx to handle SPA routing (redirect all to index.html)
# and listen on port 7860
RUN sed -i 's/listen       80;/listen       7860;/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/index  index.html index.htm;/index  index.html index.htm; try_files $uri $uri\/ \/index.html;/g' /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
