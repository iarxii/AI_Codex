# Stage 1: Build
FROM node:20-slim as build-stage

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .
COPY ./codex_spaces_temp /codex_spaces

# Create symlink for type and dependency resolution in the submodule
RUN ln -s /app/node_modules /codex_spaces/client/node_modules

# Build the app
# Note: VITE_API_URL should be set as a build argument or environment variable
ARG VITE_API_URL
ARG VITE_COLAB_URL
ARG VITE_COLAB_SECRET
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_COLAB_URL=$VITE_COLAB_URL
ENV VITE_COLAB_SECRET=$VITE_COLAB_SECRET
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine as production-stage

# Copy build output from stage 1
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
