const admin = require('firebase-admin');
const dataBase = admin.firestore();

const carExistance = async (req, res, next) => {
    try {
        const { id } = req.params; // car ID from the route parameter
        const carReference = dataBase.collection('cars').doc(id);
        const carData = await carReference.get();

        if (!carData.exists) {
            return res.status(404).json({ message: 'Car not found' });
        }

        req.carReference = carReference; // Store user reference for later use
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        res.status(500).json({ message: 'Error checking car existence', error: error.message });
    }
};

module.exports = {carExistance};

