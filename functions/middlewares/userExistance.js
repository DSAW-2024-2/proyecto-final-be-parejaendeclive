// checkUserExists.js
const admin = require('firebase-admin');
const dataBase = admin.firestore();

const userExistance = async (req, res, next) => {
    try {
        const { id } = req.params; // User ID from the route parameter
        const userReference = dataBase.collection('users').doc(id);
        const userData = await userReference.get();

        if (!userData.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.userReference = userReference; // Store user reference for later use
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        res.status(500).json({ message: 'Error checking user existence', error: error.message });
    }
};

module.exports = {userExistance};
