const admin = require('firebase-admin');
const serviceAccount = require('./credentials.json');
admin.initializeApp(
    {
        credential:admin.credential.cert(serviceAccount) ,
        databaseURL:"https://proyecto-final-daw-backend-default-rtdb.firebaseio.com"
    }
);

const dataBase = admin.firestore();
module.exports=dataBase;