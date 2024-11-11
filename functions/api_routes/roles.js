// roles_route.js
const express = require('express');
const route_roles = express.Router();
const { dataBase } = require('../connectionFB');
const { authenticate } = require('../middlewares/authenticate');

// Endpoint GET /roles/:userId
// Obtiene la información del usuario según el rol (conductor o pasajero)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;

        // Obtener el usuario de la base de datos
        const userDoc = await dataBase.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const userData = userDoc.data();
        const userRole = userData.role; // El rol actual del usuario (puede ser 'pasajero' o 'conductor')

        if (userRole === 'pasajero') {
            // Si el rol es pasajero, trae todos los viajes disponibles
            const tripsSnapshot = await dataBase.collection('trips').where('availablePlaces', '>', 0).get();

            const trips = [];
            tripsSnapshot.forEach(doc => {
                trips.push({ id: doc.id, ...doc.data() });
            });

            return res.status(200).json({
                message: 'Vista de pasajero',
                role: userRole,
                trips: trips // Todos los viajes disponibles
            });
        } else if (userRole === 'conductor') {
            // Si el rol es conductor, trae los viajes creados por el conductor
            const myTrips = userData.myTrips || [];
            const tripsSnapshot = await dataBase.collection('trips').where('id', 'in', myTrips).get();

            const trips = [];
            tripsSnapshot.forEach(doc => {
                trips.push({ id: doc.id, ...doc.data() });
            });

            return res.status(200).json({
                message: 'Vista de conductor',
                role: userRole,
                trips: trips
            });
        } else {
            return res.status(400).json({ message: 'Rol inválido' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los roles', error: error.message });
    }
});

// Endpoint PUT /roles/:userId
// Permite cambiar el rol del usuario entre 'pasajero' y 'conductor'
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body; // Recibe el rol deseado ('pasajero' o 'conductor')

        if (!['pasajero', 'conductor'].includes(role)) {
            return res.status(400).json({ message: 'Rol inválido. Solo se permite "pasajero" o "conductor"' });
        }

        // Actualizar el rol del usuario en la base de datos
        const userRef = dataBase.collection('users').doc(userId);
        await userRef.update({ role });

        return res.status(200).json({ message: 'Rol actualizado exitosamente', newRole: role });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el rol del usuario', error: error.message });
    }
});

module.exports = route_roles;
