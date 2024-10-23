const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Obtener token del header

    // Si no hay token, retornar no autorizado
    if (token == null) return res.status(401).json({error: "no JWT Token"});

    // Verificar el token JWT
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid JWT Token" });

        req.user = user; // Almacenar la información del usuario
        next(); // Continuar si el token es válido
    });
}

