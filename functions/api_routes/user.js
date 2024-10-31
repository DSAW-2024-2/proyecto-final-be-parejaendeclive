const express = require('express');
const {admin ,dataBase} = require('../connectionFB');
const route_user= express.Router();

route_user.get('/', (req, res) => {
    // Lógica para manejar la solicitud
    res.json({ message: "Acceso a sesión concedido", user: req.user });
});

module.exports = route_user;