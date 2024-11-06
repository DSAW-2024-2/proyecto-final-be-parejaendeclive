const express = require('express');
const route_car = express.Router();
const { admin, dataBase } = require('../connectionFB');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { authenticate } = require('../middlewares/authenticate');

// validate car data
function validateCarData({ carID, carPassengers, carBrand, carModel }) {
    const placaRegex = /^[A-Z]{3}\d{3}$/;
    const lettersRegex = /^[A-Za-z\s]+$/;
    const yearRegex = /^\d+$/;

    if (!placaRegex.test(carID)) return { valid: false, message: 'Invalid plate format. Must be 3 letters and 3 numbers' };
    if (!/^\d+$/.test(carPassengers)) return { valid: false, message: 'Invalid passengers number format. Only numbers are allowed' };
    if (!lettersRegex.test(carBrand)) return { valid: false, message: 'Car brand must contain only letters' };
    if (!yearRegex.test(carModel)) return { valid: false, message: 'Car model year must contain only numbers' };

    return { valid: true };
}

// get car information
route_car.get('/:id', authenticate, async (req, res) => {
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
route_car.post('/:id', authenticate, upload.fields([{ name: 'photoCar' }, { name: 'photoSOAT' }]), async (req, res) => {
    try {
        const { id } = req.params; // user ID
        const { carID, carPassengers, carBrand, carModel } = req.body;

        // Validations
        const validation = validateCarData({ carID, carPassengers, carBrand, carModel });
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
            return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        };

        const photoCarURL = await uploadImage(req.files.photoCar[0], 'photoCar');
        const photoSOATURL = await uploadImage(req.files.photoSOAT[0], 'photoSOAT');

        // car data
        const carData = { carID, carPassengers, carBrand, carModel, photoCar: photoCarURL, photoSOAT: photoSOATURL };

        // Save car in firestore
        const carRef = await dataBase.collection('cars').add(carData);
        const carFirestoreID = carRef.id;

        // update users data collection
        await dataBase.collection('users').doc(id).update({ carID: carFirestoreID });
        

        res.status(201).json({ message: 'Car added successfully', carID: carFirestoreID });
    } catch (error) {
        res.status(500).json({ message: 'Error adding car', error: error.message });
    }
});

// PUT /car/:id - update car
route_car.put('/:id', authenticate, upload.fields([{ name: 'photoCar' }, { name: 'photoSOAT' }]), async (req, res) => {
    try {
        const { id } = req.params;
        const { carID, carPassengers, carBrand, carModel } = req.body;
        const validation = validateCarData({ carID, carPassengers, carBrand, carModel });

        if (!validation.valid) return res.status(400).json({ message: validation.message });

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
route_car.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const carDoc = await dataBase.collection('cars').doc(id).get();

        if (!carDoc.exists) return res.status(404).json({ message: 'Car not found' });

        await dataBase.collection('cars').doc(id).delete();
        
        // update users car
        await dataBase.collection('users').where('carID', '==', id).get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    dataBase.collection('users').doc(doc.id).update({ carID: admin.firestore.FieldValue.delete() });
                });
            });

        res.status(200).json({ message: 'Car deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting car', error: error.message });
    }
});

module.exports = route_car;
