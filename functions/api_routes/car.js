const express = require('express');
const route_car = express.Router();
const { admin, dataBase } = require('../connectionFB');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { authenticate } = require('../middlewares/authenticate');
const { userExistance } = require('../middlewares/userExistance');
const { AuthorizationCar } = require('../middlewares/AuthorizationCar');
const { AuthorizationUser } = require('../middlewares/Authorization.User');

async function validateCarData({ carID, carPassengers, carBrand, carModel, soatExpiration }) {
    const placaRegex = /^[A-Z]{3}\d{3}$/;
    const lettersRegex = /^[A-Za-z\s]+$/;
    const yearRegex = /^\d+$/;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // Formato YYYY-MM-DD

    // Verificar que todos los campos necesarios estén presentes
    if (!carID || !carPassengers || !carBrand || !carModel || !soatExpiration) {
        return { valid: false, message: 'JSON incompleto' };
    }

    try {
        // Verificar si el carID ya existe en la base de datos
        const carIdExistsSnapshot = await dataBase.collection('cars').where('carID', '==', carID).get();
        if (!carIdExistsSnapshot.empty) {
            return { valid: false, message: "El ID del carro ya existe" };
        }
    } catch (error) {
        return { valid: false, message: 'Error en la consulta a la base de datos', error: error.message };
    }

    // Validaciones de formato
    if (!placaRegex.test(carID)) {
        return { valid: false, message: 'Formato de placa inválido. Debe tener 3 letras seguidas de 3 números (e.g., ABC123)' };
    }

    if (!/^\d+$/.test(carPassengers)) {
        return { valid: false, message: 'El número de pasajeros debe contener solo números' };
    }

    if (!lettersRegex.test(carBrand)) {
        return { valid: false, message: 'La marca del carro debe contener solo letras' };
    }

    if (!yearRegex.test(carModel)) {
        return { valid: false, message: 'El año del modelo del carro debe contener solo números' };
    }

    // Validación de soatExpiration
    if (!dateRegex.test(soatExpiration)) {
        return { valid: false, message: 'Formato de fecha de vencimiento del SOAT inválido. Debe ser YYYY-MM-DD' };
    }

    const soatDate = new Date(soatExpiration);
    const currentDate = new Date();

    // Verificar si la fecha es válida
    if (isNaN(soatDate.getTime())) {
        return { valid: false, message: 'Fecha de vencimiento del SOAT inválida' };
    }

    // Verificar que la fecha de vencimiento esté antes de la fecha actual
    // Si deseas asegurarte de que el SOAT NO esté vencido, deberías verificar que la fecha esté después de la actual
    if (soatDate < currentDate) {
        return { valid: false, message: 'La fecha de vencimiento del SOAT ya ha pasado' };
    }

    return { valid: true };
}

// get car information
route_car.get('/:id', authenticate,AuthorizationCar, async (req, res) => {
    try {
        const { id } = req.params;
        const carDoc = await dataBase.collection('cars').doc(id).get();
        
        if (!carDoc.exists) return res.status(404).json({ message: 'Car not found' });
        
        res.status(200).json({ message: 'Car data retrieved', data: carDoc.data() });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving car data', error: error.message });
    }
});

// Add a new car
route_car.post('/:id', authenticate,AuthorizationUser, userExistance, upload.fields([{ name: 'photoCar' }, { name: 'photoSOAT' }]), async (req, res) => {
    try {
        const { id } = req.params; // user ID
        const { carID, carPassengers, carBrand, carModel, soatExpiration } = req.body;
        console.log(id);
        

        // Validations
        const validation = await validateCarData({ carID, carPassengers, carBrand, carModel,soatExpiration });
        if (!validation.valid) return res.status(400).json({ message: validation.message });

        if (!req.files || !req.files.photoCar || !req.files.photoSOAT) {
            return res.status(400).json({ message: 'Missing car photos (photoCar or photoSOAT)' });
        }

        // upload images in Firebase Storage
        const bucket = admin.storage().bucket();
        const uploadImage = async (file, name) => {
            const fileName = `cars/${carID}_${Date.now()}_${name}`;
            const storageFile = bucket.file(fileName);
            await new Promise((resolve, reject) => {
                const stream = storageFile.createWriteStream({
                    metadata: { contentType: file.mimetype }
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(file.buffer);
            });
            await storageFile.makePublic();
            return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            
        };

        const photoCarURL = await uploadImage(req.files.photoCar[0], 'photoCar');
        const photoSOATURL = await uploadImage(req.files.photoSOAT[0], 'photoSOAT');
        
        // car data
        const carData = { carID, carPassengers, carBrand, carModel, photoCar: photoCarURL, photoSOAT: photoSOATURL,soatExpiration };

        // Save car in firestore
        const carRef = await dataBase.collection('cars').add(carData);
        const carFirestoreID = carRef.id;

        
        // Update user's carIDs array or creates the array
        const userReference = req.userReference;
        const userData = await userReference.get();

        if (userData.data().carIDs) {
            await userReference.update({
                carIDs: admin.firestore.FieldValue.arrayUnion(carFirestoreID)
            });
        } else {
            await userReference.update({
                carIDs: [carFirestoreID]
            });
        }

        // update users data collection
        res.status(201).json({ message: 'Car added successfully', carID: carFirestoreID });
    } catch (error) {
        res.status(500).json({ message: 'Error adding car', error: error.message });
    }
});

// PUT /car/:id - update car
route_car.put('/:id', authenticate,AuthorizationUser, upload.fields([{ name: 'photoCar' }, { name: 'photoSOAT' }]), async (req, res) => {
    try {
        const { id } = req.params;
        const { carID, carPassengers, carBrand, carModel ,soatExpiration} = req.body;
        const validation = await validateCarData({ carID, carPassengers, carBrand, carModel,soatExpiration });

        if (!validation.valid) return res.status(400).json({ message: validation.message });
        
        if (!req.files || !req.files.photoCar || !req.files.photoSOAT) {
            return res.status(400).json({ message: 'Missing car photos (photoCar or photoSOAT)' });
        }

        const carDoc = await dataBase.collection('cars').doc(id).get();
        if (!carDoc.exists) return res.status(404).json({ message: 'Car not found' });

        const updates = { carID, carPassengers, carBrand, carModel };
        
        // update images if they are new
        const bucket = admin.storage().bucket();
        const uploadImage = async (file, name) => {
            const fileName = `cars/${carID}_${Date.now()}_${name}`;
            const storageFile = bucket.file(fileName);
            await new Promise((resolve, reject) => {
                const stream = storageFile.createWriteStream({
                    metadata: { contentType: file.mimetype }
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(file.buffer);
            });
            await storageFile.makePublic();
            return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        };

        if (req.files && req.files.photoCar) {
            updates.photoCar = await uploadImage(req.files.photoCar[0], 'photoCar');
        }
        if (req.files && req.files.photoSOAT) {
            updates.photoSOAT = await uploadImage(req.files.photoSOAT[0], 'photoSOAT');
        }

        await dataBase.collection('cars').doc(id).update(updates);
        res.status(200).json({ message: 'Car updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating car', error: error.message });
    }
});

// DELETE /car/:id - delete car
route_car.delete('/:id', authenticate,AuthorizationCar, async (req, res) => {
    try {
        const { id } = req.params;
        const carDoc = await dataBase.collection('cars').doc(id).get();

        if (!carDoc.exists) return res.status(404).json({ message: 'Car not found' });

        await dataBase.collection('cars').doc(id).delete();
        
        const users = await dataBase.collection('users').where('carIDs', 'array-contains', id).get();

        if (!users.empty) {
            const batch = dataBase.batch();
            users.forEach(doc => {
                const userRef = dataBase.collection('users').doc(doc.id);
                batch.update(userRef, {
                    carIDs: admin.firestore.FieldValue.arrayRemove(id)
                });
            });
            await batch.commit();
        }

        res.status(200).json({ message: 'Car deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting car', error: error.message });
    }
});

module.exports = route_car;
