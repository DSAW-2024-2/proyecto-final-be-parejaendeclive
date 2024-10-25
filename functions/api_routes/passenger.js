const express = require('express');
const {admin ,dataBase} = require('../connectionFB');
const route_passenger= express.Router();

route_passenger.get('/', (req, res) => {
    // Lógica para manejar la solicitud
    res.json({ message: "Acceso a pasajeros concedido", user: req.user });
});

module.exports = route_passenger;