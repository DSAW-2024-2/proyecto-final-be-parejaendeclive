// middlewares/checkCarOwnership.js
const { dataBase } = require('../connectionFB');

async function AuthorizationCar (req, res, next) {
    const { id: carIDs } = req.params; // car ID
    console.log( carIDs);
    const userID = req.user.userId; // car Id authenticated user
    console.log(userID);
    try {
        // ger userID from users collection
        const userDoc = await dataBase.collection('users').doc(userID).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const userCars = userDoc.data().carIDs || []; 

        // verify if cars owner is the authenticated user
        if (!userCars.includes(carIDs)) {
            return res.status(403).json({ message: 'forbidden, you no have permission to modify' });
        }
        
    next();
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar la propiedad del carro', error: error.message });
    }
}

module.exports = { AuthorizationCar };
