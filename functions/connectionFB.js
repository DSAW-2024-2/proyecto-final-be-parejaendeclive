
const admin = require('firebase-admin');
const serviceAccount = require('./credentials.json');
admin.initializeApp(
    {
        credential:admin.credential.cert(serviceAccount) ,
        storageBucket: 'proyecto-final-daw-backend.appspot.com',
        databaseURL:"https://proyecto-final-daw-backend-default-rtdb.firebaseio.com"
    }
);

const dataBase = admin.firestore();
console.log("Firebase Firestore initialized:", !!dataBase);
module.exports={admin ,dataBase};