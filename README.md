# Efficient Geo Crawler
This branch is for developers.<br>
The Road-based Method (Proposed Method) is the latest version.

![image](https://user-images.githubusercontent.com/38425740/106981506-754a4b00-67a5-11eb-8fa3-c8631f2b3a56.png)


## Quick Start
```
# 1. clone
$ git clone -b dev https://github.com/YokoyamaLab/efficient-geo-crawler.git

# 2. install modules
$ npm install

# 3. Get the API key of Google Places API and put it in .env file.

# 4. execute
$ npm start

# option
## If you have mongoDB and save places to your local, do this before 4.
$ sudo service mongod start
```

## Requirement
* Node.js: ^12.18.3
* npm: ^6.14.6
* MongoDB: ^4.2.9

## Link
* [How to get the API key of Google Places API](https://developers.google.com/places/web-service/get-api-key)