#base image
FROM node:20-bullseye

#install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

#set working directory
WORKDIR /app

#install Node dependencies
COPY package*.json ./
RUN npm install

#copy your app code
COPY . .

#expose port
EXPOSE 3000

#start the app
CMD ["npm", "start"]


