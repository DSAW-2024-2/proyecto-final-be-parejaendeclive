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
function validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces }) {
    
    const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/; // Formato HH:mm
    const numberRegex = /^\d+$/;

    if (!startTrip || !endTrip || !route || !timeTrip || !priceTrip || !availablePlaces) {
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

// Endpoint GET /trips - Obtener todos los viajes disponibles
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

// Endpoint GET /trips/user/:userID - Obtener viajes reservados por un usuario
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

// Endpoint POST /trips/:id - Añadir un nuevo viaje a un carro registrado
router.post('/:id', authenticate,AuthorizationCar, carExistance, async (req, res) => {
    try {
        console.log(req.user);
        const { id } = req.params; // Este es el ID del documento en la colección "cars"
        
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops } = req.body;
        
        const userID = req.user.userId; // Asegurarte de que req.user está definido

        if (!userID) {
            return res.status(400).json({ message: 'ID de usuario no válido' });
        }
        // Validaciones
        const validation = validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }
        // Crear objeto de viaje
        const tripData = {
            carID: id, // Ahora estamos guardando el ID del carro como "carID" en el viaje
            startTrip,
            endTrip,
            route,
            timeTrip,
            priceTrip: Number(priceTrip),
            availablePlaces: Number(availablePlaces),
            stops: stops || [], // Inicialmente vacío o proporcionado
            reservedBy: [] // Inicialmente vacío
        };

        // Guardar viaje en Firestore
        const tripRef = await dataBase.collection('trips').add(tripData);
        const tripID = tripRef.id;

        // Actualizar colección de usuarios (MyTrips)
        await dataBase.collection('users').doc(userID).update({
            myTrips: admin.firestore.FieldValue.arrayUnion(tripID)
        });

        res.status(201).json({ message: 'Viaje añadido exitosamente', tripID });
    } catch (error) {
        res.status(500).json({ message: 'Error al añadir el viaje', error: error.message });
    }
});

// Endpoint PUT /trips/:tripID - Editar un viaje registrado
router.put('/:tripID', authenticate,AuthorizationCar, userExistance,async (req, res) => {
    try {
        const { tripID } = req.params;
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops } = req.body;

        // Validaciones
        const validation = validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }

        // Verificar si el viaje existe
        const tripDoc = await dataBase.collection('trips').doc(tripID).get();
        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        // Actualizar datos del viaje
        const updates = {
            startTrip,
            endTrip,
            route,
            timeTrip,
            priceTrip: Number(priceTrip),
            availablePlaces: Number(availablePlaces),
            stops: stops || tripDoc.data().stops // Mantener stops existentes si no se proporcionan nuevos
        };

        await dataBase.collection('trips').doc(tripID).update(updates);

        res.status(200).json({ message: 'Viaje actualizado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el viaje', error: error.message });
    }
});

// Endpoint PUT /trips/reserve/:tripID - Reservar   un viaje
router.put('/reserve/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const { stops , reservedPlaces } = req.body; // Paradas seleccionadas por el usuario y cupos a reservar
         // Paradas seleccionadas por el usuario
        const userID = req.user.userId;

        // Validar paradas
        if (!Array.isArray(stops) || stops.length === 0) {
            return res.status(400).json({ message: 'Debe proporcionar al menos una parada' });
        }


        // Verificar si el viaje existe
        const tripDocRef = dataBase.collection('trips').doc(tripID);
        const tripDoc = await tripDocRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        const tripData = tripDoc.data();

        // Verificar disponibilidad
        if (tripData.availablePlaces < 1) {
            return res.status(400).json({ message: 'No hay cupos disponibles para este viaje' });
        }

        // Actualizar disponibilidad y reservas
        await dataBase.runTransaction(async (transaction) => {
            const tripSnapshot = await transaction.get(tripDocRef);
            if (!tripSnapshot.exists) {
                throw new Error('Viaje no encontrado durante la transacción');
            }
            console.log("entre");
            const currentAvailable = tripSnapshot.data().availablePlaces;
            console.log(currentAvailable);
            
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

            // Actualizar colección de usuarios (reservedTrips)
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

// Endpoint DELETE /trips/:tripID - Opcional: Eliminar un viaje
router.delete('/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;

        // Verificar si el viaje existe
        const tripDoc = await dataBase.collection('trips').doc(tripID).get();
        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Viaje no encontrado' });
        }

        

        // Eliminar el viaje
        await dataBase.collection('trips').doc(tripID).delete();

        // Eliminar el viaje de los usuarios que lo han reservado
        const usersSnapshot = await dataBase.collection('users').where('reservedTrips', 'array-contains', tripID).get();
        const batch = dataBase.batch();
        usersSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                reservedTrips: admin.firestore.FieldValue.arrayRemove(tripID)
            });
        });
        await batch.commit();
        
        // Eliminar el viaje creado por el conductor
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
