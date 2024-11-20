const { dataBase } = require('../connectionFB');

async function AuthorizationUser(req, res, next) {
    const { id } = req.params; // users ID
    const authenticatedUserId = req.user.userId; //authenticated user ID
    console.log(id);
    console.log(authenticatedUserId);
    // validation
    if (id && id !== authenticatedUserId) {
        return res.status(403).json({ message: 'forbbiden, you can´t add cars to this user' });
    }

    next(); 
}

module.exports = { AuthorizationUser };
