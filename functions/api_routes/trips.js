// route_trips.js
const express = require('express');
const router = express.Router();
const { admin, dataBase } = require('../connectionFB');
const { authenticate } = require('../middlewares/authenticate');
const { AuthorizationCar } = require('../middlewares/AuthorizationCar');
const { AuthorizationUser } = require('../middlewares/Authorization.User');

// Utility to validate trip data
function validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, date }) {
    const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/; // HH:mm format
    const numberRegex = /^\d+$/;
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

    if (!startTrip || !endTrip || !route || !timeTrip || !priceTrip || !availablePlaces || !date) {
        return { valid: false, message: 'Incomplete JSON' };
    }

    if (!timeRegex.test(timeTrip)) {
        return { valid: false, message: 'Time format must be HH:mm' };
    }

    if (!numberRegex.test(priceTrip)) {
        return { valid: false, message: 'Price must be numeric' };
    }

    if (!numberRegex.test(availablePlaces)) {
        return { valid: false, message: 'Available places must be numeric' };
    }

    if (!dateRegex.test(date)) {
        return { valid: false, message: 'Date format must be DD-MM-YYYY' };
    }

    return { valid: true };
}

// Utility to validate trip capacity
function validateTripCapacity(carPassengers, availablePlaces) {
    if (availablePlaces > carPassengers) {
        return { valid: false, message: 'Available places cannot exceed vehicle capacity' };
    }
    return { valid: true };
}

// Utility to update trip status
async function updateTripStatus(tripID) {
    const tripRef = dataBase.collection('trips').doc(tripID);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
        throw new Error('Trip not found');
    }

    const { availablePlaces } = tripDoc.data();
    const status = availablePlaces > 0 ? 'available' : 'no disponible';

    await tripRef.update({ status });
}

// 1. Endpoint to get trips for a car
router.get('/:carID', authenticate, AuthorizationCar, async (req, res) => {
    try {
        const { carID } = req.params;
        const carTrips = await dataBase.collection('trips').where('carID', '==', carID).get();

        if (carTrips.empty) {
            return res.status(404).json({ message: 'There are no trips for this car' });
        }

        const trips = [];
        carTrips.forEach((doc) => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'Car trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'Error getting car trips', error: error.message });
    }
});

// 2. Endpoint to get all available trips
router.get('/', authenticate, async (req, res) => {
    try {
        const tripsSnapshot = await dataBase.collection('trips').where('status', '==', 'available').get();

        if (tripsSnapshot.empty) {
            return res.status(404).json({ message: 'No trips available' });
        }

        const trips = [];
        tripsSnapshot.forEach((doc) => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'Available trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'Error getting available trips', error: error.message });
    }
});

// 3. Endpoint to get reserved trips for a user
router.get('/user/:userID', authenticate, AuthorizationUser, async (req, res) => {
    try {
        const { userID } = req.params;
        const userDoc = await dataBase.collection('users').doc(userID).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userDoc.data();
        const reservedTrips = userData.reservedTrips || [];

        if (reservedTrips.length === 0) {
            return res.status(404).json({ message: 'User has no reserved trips' });
        }

        const tripsSnapshot = await dataBase
            .collection('trips')
            .where(admin.firestore.FieldPath.documentId(), 'in', reservedTrips)
            .get();
        const trips = [];
        tripsSnapshot.forEach((doc) => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json({ message: 'Reserved trips', trips });
    } catch (error) {
        res.status(500).json({ message: 'Error getting reserved trips', error: error.message });
    }
});

// 4. Endpoint to create a new trip
router.post('/:id', authenticate, AuthorizationCar, async (req, res) => {
    try {
        const { id: carID } = req.params;
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops, date } = req.body;
        const userID = req.user.userId;

        if (!userID) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const carDoc = await dataBase.collection('cars').doc(carID).get();
        if (!carDoc.exists) {
            return res.status(404).json({ message: 'Car not found' });
        }

        const { carPassengers } = carDoc.data();
        const validation = validateTripData({ startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, date });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }

        const capacityValidation = validateTripCapacity(carPassengers, availablePlaces);
        if (!capacityValidation.valid) {
            return res.status(400).json({ message: capacityValidation.message });
        }

        const tripData = {
            carID,
            startTrip,
            endTrip,
            route,
            timeTrip,
            date,
            priceTrip: Number(priceTrip),
            availablePlaces: Number(availablePlaces),
            stops: stops || [],
            reservedBy: [],
            status: 'available',
        };

        const tripRef = await dataBase.collection('trips').add(tripData);
        const tripID = tripRef.id;

        await dataBase.collection('users').doc(userID).update({
            myTrips: admin.firestore.FieldValue.arrayUnion(tripID),
        });

        res.status(201).json({ message: 'Trip created successfully', tripID });
    } catch (error) {
        res.status(500).json({ message: `Error creating trip: ${error.message}` });
    }
});

// 5. Endpoint to update a trip
router.put('/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const { startTrip, endTrip, route, timeTrip, priceTrip, availablePlaces, stops } = req.body;

        const tripRef = dataBase.collection('trips').doc(tripID);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const updates = {};

        if (startTrip) updates.startTrip = startTrip;
        if (endTrip) updates.endTrip = endTrip;
        if (route) updates.route = route;
        if (timeTrip) updates.timeTrip = timeTrip;
        if (priceTrip) updates.priceTrip = Number(priceTrip);
        if (availablePlaces !== undefined) updates.availablePlaces = Number(availablePlaces);
        if (stops) updates.stops = stops;

        await tripRef.update(updates);

        // Actualizar el estado del viaje
        await updateTripStatus(tripID);

        res.status(200).json({ message: 'Trip updated successfully' });
    } catch (error) {
        res.status(500).json({ message: `Error updating trip: ${error.message}` });
    }
});

router.put('/reserve/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const userID = req.user.userId;
        const { reservedPlaces, stops } = req.body;

        const tripRef = dataBase.collection('trips').doc(tripID);

        await dataBase.runTransaction(async (transaction) => {
            const tripDoc = await transaction.get(tripRef);
            if (!tripDoc.exists) {
                throw new Error('Trip not found');
            }

            const tripData = tripDoc.data();

            // Validar disponibilidad de lugares
            if (tripData.availablePlaces < reservedPlaces) {
                throw new Error('Not enough available places');
            }

            // Actualizar availablePlaces
            tripData.availablePlaces -= reservedPlaces;

            // Agregar la reserva del usuario
            tripData.reservedBy.push({
                userID: userID,
                reservedPlaces: reservedPlaces,
                stops: stops
            });

            // Actualizar la lista de paradas generales (eliminar duplicados)
            const updatedStops = Array.from(new Set([...tripData.stops, ...stops]));

            // Actualizar el documento del viaje
            transaction.update(tripRef, {
                availablePlaces: tripData.availablePlaces,
                reservedBy: tripData.reservedBy,
                stops: updatedStops // Actualizar las paradas generales
            });

            // Actualizar los datos del usuario
            const userRef = dataBase.collection('users').doc(userID);
            transaction.update(userRef, {
                reservedTrips: admin.firestore.FieldValue.arrayUnion(tripID),
            });
        });

        // Actualizar el estado del viaje si es necesario
        await updateTripStatus(tripID);

        res.status(200).json({ message: 'Reservation successful' });
    } catch (error) {
        res.status(500).json({ message: `Error making reservation: ${error.message}` });
    }
});


// 7. Endpoint para cancelar una reserva
router.delete('/reservation/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const userID = req.user.userId;
        const tripRef = dataBase.collection('trips').doc(tripID);
  
        await dataBase.runTransaction(async (transaction) => {
            // Leer tripData dentro de la transacción
            const tripDoc = await transaction.get(tripRef);
  
            if (!tripDoc.exists) {
                throw new Error('Trip not found');
            }
            const tripData = tripDoc.data();
  
            // Buscar la reservación del usuario
            const reservationIndex = tripData.reservedBy.findIndex(res => res.userID === userID);
            if (reservationIndex === -1) {
                throw new Error('Reservation not found for this user');
            }
  
            const reservation = tripData.reservedBy[reservationIndex];
            const reservedPlaces = reservation.reservedPlaces;

            // Eliminar las paradas reservadas por el usuario de la lista general de paradas
            const stopsToRemove = reservation.stops || [];
            tripData.stops = tripData.stops.filter(stop => !stopsToRemove.includes(stop));

            // Actualizar availablePlaces y remover la reserva
            tripData.availablePlaces += reservedPlaces;
            tripData.reservedBy.splice(reservationIndex, 1);
  
            // Actualizar el viaje en la base de datos
            transaction.update(tripRef, {
                availablePlaces: tripData.availablePlaces,
                reservedBy: tripData.reservedBy,
                stops: tripData.stops, // Actualizar las paradas generales
            });

            // Actualizar los viajes reservados del usuario
            const userRef = dataBase.collection('users').doc(userID);
            transaction.update(userRef, {
                reservedTrips: admin.firestore.FieldValue.arrayRemove(tripID),
            });
        });
  
        // Actualizar el estado del viaje si es necesario
        await updateTripStatus(tripID);
  
        res.status(200).json({ message: 'Reservation canceled successfully, stops removed' });
    } catch (error) {
        res.status(500).json({ message: `Error canceling reservation: ${error.message}` });
    }
});
// 8. Endpoint to cancel a stop in a trip
router.put('/cancel-stop/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;
        const { stop } = req.body;

        const tripRef = dataBase.collection('trips').doc(tripID);

        await dataBase.runTransaction(async (transaction) => {
            const tripDoc = await transaction.get(tripRef);

            if (!tripDoc.exists) {
                throw new Error('Trip not found');
            }

            const tripData = tripDoc.data();

            // Verificar si la parada existe en el viaje
            if (!tripData.stops.includes(stop)) {
                throw new Error('Stop not found in the trip');
            }

            // Determinar cuántos lugares se deben sumar (si la parada afecta lugares)
            let passengersToAdd = 0;

            // Actualizar reservedBy para encontrar usuarios que reservaron la parada cancelada
            const updatedReservedBy = tripData.reservedBy.map((reservation) => {
                if (reservation.stops.includes(stop)) {
                    passengersToAdd += reservation.reservedPlaces; // Contar los lugares reservados para esta parada
                    // Remover la parada del arreglo de paradas reservadas por este usuario
                    reservation.stops = reservation.stops.filter((s) => s !== stop);
                }
                return reservation;
            });

            // Actualizar el documento en la base de datos
            transaction.update(tripRef, {
                stops: admin.firestore.FieldValue.arrayRemove(stop), // Eliminar la parada del viaje
                reservedBy: updatedReservedBy, // Actualizar las reservas
                availablePlaces: tripData.availablePlaces + passengersToAdd, // Incrementar los lugares disponibles
            });
        });

        // Actualizar el estado del viaje
        await updateTripStatus(tripID);

        res.status(200).json({ message: 'Stop canceled successfully, places updated' });
    } catch (error) {
        res.status(500).json({ message: `Error canceling stop: ${error.message}` });
    }
});


// 9. Endpoint to cancel a trip
router.delete('/cancel/:tripID', authenticate, async (req, res) => {
    try {
        const { tripID } = req.params;

        const tripRef = dataBase.collection('trips').doc(tripID);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        await dataBase.runTransaction(async (transaction) => {
            transaction.delete(tripRef);

            const usersSnapshot = await dataBase
                .collection('users')
                .where('reservedTrips', 'array-contains', tripID)
                .get();
            usersSnapshot.forEach((userDoc) => {
                transaction.update(userDoc.ref, {
                    reservedTrips: admin.firestore.FieldValue.arrayRemove(tripID),
                });
            });

            const driverSnapshot = await dataBase
                .collection('users')
                .where('myTrips', 'array-contains', tripID)
                .get();
            driverSnapshot.forEach((driverDoc) => {
                transaction.update(driverDoc.ref, {
                    myTrips: admin.firestore.FieldValue.arrayRemove(tripID),
                });
            });
        });

        res.status(200).json({ message: 'Trip canceled successfully by driver' });
    } catch (error) {
        res.status(500).json({ message: `Error canceling trip: ${error.message}` });
    }
});

module.exports = router;
