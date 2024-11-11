const { dataBase } = require('../connectionFB');

async function AuthorizationUser(req, res, next) {
    const { id } = req.params; // ID del usuario en la ruta (si es necesario)
    const authenticatedUserId = req.user.userId; // ID del usuario autenticado
    console.log(id);
    console.log(authenticatedUserId);
    // Comprobar que el usuario en la ruta es el mismo que el autenticado
    if (id && id !== authenticatedUserId) {
        return res.status(403).json({ message: 'forbbiden, you can´t add cars to this user' });
    }

    next(); // Continuar si la verificación es exitosa
}

module.exports = { AuthorizationUser };
