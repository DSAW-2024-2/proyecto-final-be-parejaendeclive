// middlewares/checkCarOwnership.js
const { dataBase } = require('../connectionFB');

async function AuthorizationCar (req, res, next) {
    const { id: carID } = req.params; // ID del carro pasado en la ruta
    console.log(carID);
    const userID = req.user.userId; // ID del usuario autenticado

    try {
        // Consulta para obtener el usuario propietario del carro en la colección "users"
        const userDoc = await dataBase.collection('users').doc(userID).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const userCars = userDoc.data().carIDs || []; // Lista de IDs de carros del usuario

        // Verificar si el carro pertenece al usuario autenticado
        if (!userCars.includes(carID)) {
            return res.status(403).json({ message: 'forbidden, you no have permission to modify' });
        }

        // Continuar con la solicitud si la validación es exitosa
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar la propiedad del carro', error: error.message });
    }
}

module.exports = { AuthorizationCar };
