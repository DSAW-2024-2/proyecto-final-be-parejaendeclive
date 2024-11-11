// roles_route.js
const express = require('express');
const route_roles = express.Router();
const { dataBase } = require('../connectionFB');
const { authenticate } = require('../middlewares/authenticate');
const {AuthorizationUser} = require('../middlewares/Authorization.User')

// Endpoint GET /roles/:userId
// get users information depending on the role
route_roles.get('/:id', authenticate, AuthorizationUser, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('userId:', id); 

        // gest the user from firebase
        const userDoc = await dataBase.collection('users').doc(id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const userData = userDoc.data();
        const userRole = userData.role; // actual user role

        if (userRole === 'pasajero') {
            // if role=pasajero, we return all trips(this logic is only in backend)
            const tripsSnapshot = await dataBase.collection('trips').where('availablePlaces', '>', 0).get();

            const trips = [];
            tripsSnapshot.forEach(doc => {
                trips.push({ id: doc.id, ...doc.data() });
            });

            return res.status(200).json({
                message: 'Vista de pasajero',
                role: userRole,
                trips: trips // all trips
            });
        } else if (userRole === 'conductor') {
            // get drivers created trips
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
// change role
route_roles.put('/:id', authenticate,AuthorizationUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body; 

        if (!['pasajero', 'conductor'].includes(role)) {
            return res.status(400).json({ message: 'Rol inválido. Solo se permite "pasajero" o "conductor"' });
        }

        // update role in users collection
        const userRef = dataBase.collection('users').doc(id);
        await userRef.update({ role });

        return res.status(200).json({ message: 'Rol actualizado exitosamente', newRole: role });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el rol del usuario', error: error.message });
    }
});

module.exports = route_roles;
