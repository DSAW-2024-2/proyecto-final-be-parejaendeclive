//database functions
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const { databaseURL } = require("firebase-functions/params");


const express = require('express');
const route_register= require('./api_routes/registrer');
const route_login= require('./api_routes/login');
const app = express();

app.use(express.json());
app.get('/', (req, res) => {
    res.send('welcome to Api campus rush');
});

app.use('/register',route_register);
app.use('/login',route_login);



module.exports = app;