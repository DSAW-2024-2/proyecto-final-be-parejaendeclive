// route_trips.js
const express = require('express');
const router = express.Router();
const { admin, dataBase } = require('../connectionFB');
const { authenticate } = require('../middlewares/authenticate');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const {userExistance} = require ('../middlewares/userExistance');
const {carExistance} = require ('../middlewares/carExistance');
const {AuthorizationCar} = require ('../middlewares/AuthorizationCar');
const {AuthorizationUser} = require ('../middlewares/Authorization.User');

// Validation
function validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces , date }) {
    
    const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/; // Formato HH:mm
    const numberRegex = /^\d+$/;
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

    if (!startTrip || !endTrip || !route || !timeTrip || !priceTrip || !availablePlaces ||!date) {
        return { valid: false, message: 'JSON incompleto' };
    }

    if (!timeRegex.test(timeTrip)) {
        return { valid: false, message: 'El formato de la hora debe ser HH:mm' };
    }

    if (!numberRegex.test(priceTrip)) {
        return { valid: false, message: 'El precio debe contener solo números' };
    }

    if (!numberRegex.test(availablePlaces)) {
        return { valid: false, message: 'Los cupos disponibles deben ser un número' };
    }
    if (!dateRegex.test(date)) {
        return { valid: false, message: 'La fecha debe tener el formato correcto' };
    }

    return { valid: true };
}

// Endpoint GET /trips/:carID
router.get('/:carID', authenticate, AuthorizationCar, async (req, res) => {
    try {
        const { carID } = req.params;
        const carTrips = await dataBase.collection('trips').where('carID', '==', carID).get();

        if (carTrips.empty) {
            return res.status(404).json({ message: 'There are not trips for this car' });
        }

        const trips = [];
        carTrips.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'car trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'error getting car trips', error: error.message });
    }
});

// Endpoint GET /trips -all trips
router.get('/', authenticate, async (req, res) => {
    try {
        const tripsSnapshot = await dataBase.collection('trips').where('availablePlaces', '>', 0).get();

        if (tripsSnapshot.empty) {
            return res.status(404).json({ message: 'no trips' });
        }

        const trips = [];
        tripsSnapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'available trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los viajes disponibles', error: error.message });
    }
});

// Endpoint GET /trips/user/:userID - reserved user trips
router.get('/user/:userID', authenticate,AuthorizationUser, async (req, res) => {
    try {
        const { userID } = req.params;
        const userDoc = await dataBase.collection('users').doc(userID).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userDoc.data();
        const reservedTrips = userData.reservedTrips || [];

        if (reservedTrips.length === 0) {
            return res.status(404).json({ message: 'user with not trips reserved' });
        }

        const tripsSnapshot = await dataBase.collection('trips').where(admin.firestore.FieldPath.documentId(), 'in', reservedTrips).get();
        const trips = [];
        tripsSnapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'reserved trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
});

// Endpoint POST /trips/:id car - create a new trips
router.post('/:id', authenticate,AuthorizationCar, carExistance, async (req, res) => {
    try {
        
        const { id } = req.params; // carID
        console.log(id);
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops, date } = req.body;
        
        const userID = req.user.userId; 

        if (!userID) {
            return res.status(400).json({ message: 'ID de usuario no válido' });
        }
        // Validations
        const validation = validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, date });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }
        // create trip
        const tripData = {
            carID: id, // we save carID
            startTrip,
            endTrip,
            route,
            timeTrip,
            date,
            priceTrip: Number(priceTrip),
            availablePlaces: Number(availablePlaces),
            stops: stops || [], 
            reservedBy: [] 
        };

        // save trip in firebase
        const tripRef = await dataBase.collection('trips').add(tripData);
        const tripID = tripRef.id;

        // update (MyTrips)
        await dataBase.collection('users').doc(userID).update({
            myTrips: admin.firestore.FieldValue.arrayUnion(tripID)
        });

        res.status(201).json({ message: 'Viaje añadido exitosamente', tripID });
    } catch (error) {
        res.status(500).json({ message: 'Error al añadir el viaje', error: error.message });
    }
});

// Endpoint PUT /trips/:tripID - update trip
router.put('/:tripID', authenticate,async (req, res) => {
    try {
        const { tripID } = req.params;
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops } = req.body;

        // Validations
        const validation = validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }

        // verify trip existance
        const tripDoc = await dataBase.collection('trips').doc(tripID).get();
        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        // update trip
        const updates = {
            startTrip,
            endTrip,
            route,
            timeTrip,
            priceTrip: Number(priceTrip),
            availablePlaces: Number(availablePlaces),
            stops: stops || tripDoc.data().stops // existance stops conserved
        };

        await dataBase.collection('trips').doc(tripID).update(updates);

        res.status(200).json({ message: 'Viaje actualizado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el viaje', error: error.message });
    }
});

// Endpoint PUT /trips/reserve/:tripID - book a trip
router.put('/reserve/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const { stops , reservedPlaces } = req.body; 
        
        const userID = req.user.userId;

        // stops validation
        if (!Array.isArray(stops) || stops.length === 0) {
            return res.status(400).json({ message: 'Debe proporcionar al menos una parada' });
        }


        // Verify trip existance
        const tripDocRef = dataBase.collection('trips').doc(tripID);
        const tripDoc = await tripDocRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        const tripData = tripDoc.data();

        // verify availability
        if (tripData.availablePlaces < 1) {
            return res.status(400).json({ message: 'No hay cupos disponibles para este viaje' });
        }

        // update vailability and bookinngs
        await dataBase.runTransaction(async (transaction) => {
            const tripSnapshot = await transaction.get(tripDocRef);
            if (!tripSnapshot.exists) {
                throw new Error('Viaje no encontrado durante la transacción');
            }
            
            const currentAvailable = tripSnapshot.data().availablePlaces;
            
            
            if(reservedPlaces > currentAvailable){
                throw new Error('No hay cupos disponibles para este viaje');
            }
            
            if (currentAvailable < 1) {
                throw new Error('No hay cupos disponibles para este viaje');
            }
        

            transaction.update(tripDocRef, {
                availablePlaces: currentAvailable - reservedPlaces,
                reservedBy: admin.firestore.FieldValue.arrayUnion(userID),
                stops: admin.firestore.FieldValue.arrayUnion(...stops)
            });

            // update users collection
            const userRef = dataBase.collection('users').doc(userID);
            transaction.update(userRef, {
                reservedTrips: admin.firestore.FieldValue.arrayUnion(tripID)
            });
        });

        res.status(200).json({ message: 'Reserva realizada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: `Error al reservar el viaje: ${error.message}` });
    }
});

// Endpoint DELETE /trips/:tripID - optional delete a trip
router.delete('/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;

        // verify trip existance
        const tripDoc = await dataBase.collection('trips').doc(tripID).get();
        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        

        // delete trip
        await dataBase.collection('trips').doc(tripID).delete();

        // delete trip for users who reserved
        const usersSnapshot = await dataBase.collection('users').where('reservedTrips', 'array-contains', tripID).get();
        const batch = dataBase.batch();
        usersSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                reservedTrips: admin.firestore.FieldValue.arrayRemove(tripID)
            });
        });
        await batch.commit();
        
        // delete trip for driver
        const userDriver = await dataBase.collection('users').where('myTrips', 'array-contains', tripID).get();
        const batch1 = dataBase.batch();
        userDriver.forEach(doc => {
            batch1.update(doc.ref, {
            myTrips: admin.firestore.FieldValue.arrayRemove(tripID)
            });
        });
        await batch1.commit();

        res.status(200).json({ message: 'Viaje eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el viaje', error: error.message });
    }
});

module.exports = router;
