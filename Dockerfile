# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 5005, so you'll need to expose it
EXPOSE 5005

# Define the command to run your app
CMD [ "node", "server.js" ]
