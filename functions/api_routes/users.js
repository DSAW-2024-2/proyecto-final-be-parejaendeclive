const express = require('express');
const route_users =express.Router();
const admin = require('firebase-admin');

admin.initializeApp(
    {
        credential:admin.credential.cert('./credentials.json') ,
        databaseURL:"https://proyecto-final-daw-backend-default-rtdb.firebaseio.com"
    }
);

const dataBase = admin.firestore();

route_users.get('/', (req, res) => {
    return res.status(200).json({message: 'users succesfull!'});
});

route_users.post('/',async (req,res) =>{
    await dataBase.collection('users').doc('/' + req.body.id + '/').create(
        {
            name: req.body.name,
            LastName: req.body.LastName,
            email: req.body.email,
            number: req.body.number,
            password: req.body.password

        }
    )
    return res.status(201).json({ message: "User added" });
})

module.exports = route_users;