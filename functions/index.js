//database functions
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const { databaseURL } = require("firebase-functions/params");


const express = require('express');
const cors = require('cors');
const {authenticate} = require('./middlewares/authenticate');
const route_register= require('./api_routes/register');
const route_login= require('./api_routes/login');
const route_user= require('./api_routes/user');
const route_car= require('./api_routes/car');
const route_trips= require('./api_routes/trips');

const app = express();
const port = process.env.PORT || 3000;
const corsOptions = {
    origin: ['http://localhost:5173'], // Agrega ambos dominios
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));


app.use(express.json());

app.get('/', (req, res) => {
    res.send('welcome to Api campus rush');
});

// listen server
app.listen(port, () => {
    console.log('Server listening on', port);
});

app.use('/register',route_register);
app.use('/login',route_login);
app.use('/user', authenticate, route_user);
app.use('/car', authenticate, route_car);
app.use('/trips', authenticate, route_trips);



module.exports = app;