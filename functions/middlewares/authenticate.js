const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    console.log('Encabezado Authorization:', authHeader);
    const token = authHeader && authHeader.split(' ')[1]; // token from header

    // if not token return error
    if (token == null) return res.status(401).json({error: "no JWT Token"});

    // if invalid token return error
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid JWT Token" });

        req.user = user; // save login information
        next(); 
    });
}
module.exports={authenticate};
