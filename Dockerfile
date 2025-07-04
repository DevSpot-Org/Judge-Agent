# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install git and Node.js
RUN apt-get update && \
    apt-get install -y git curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies into temp directory
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json /temp/dev/
RUN cd /temp/dev && bun install

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json /temp/prod/
RUN cd /temp/prod && bun install --production

# Copy node_modules from temp directory
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/package.json .

# Create temp directories and set permissions
# Make sure the directory is owned by the user that will run the container
RUN mkdir -p /usr/src/app/temp/repositories && \
    chmod 777 /usr/src/app/temp  # More permissive for bind mounts

# Expose port 3000
EXPOSE 3000

# Don't switch to bun user when using bind mounts with permission issues
# USER bun

# Run the app with watch mode for development
CMD ["bun", "--watch", "run", "./src/server.ts"]