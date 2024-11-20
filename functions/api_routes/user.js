const express = require('express');
const {admin ,dataBase} = require('../connectionFB');
const route_user= express.Router();
const bcryptjs = require('bcryptjs');
const {authenticate}= require('../middlewares/authenticate');
const multer= require('multer');
const { resolve } = require('path');

const upload = multer({storage:multer.memoryStorage()});
function string_validation( name, LastName){
    let data =[name,LastName]
    const letters = /^[A-Za-z\s]+$/;
    return data.every(item => letters.test(item));
    
}
//Update users info
route_user.put('/:id',authenticate,upload.single("photoUser"), async (req,res) =>{
    try{
        const { id } = req.params;
        const {idUser,name,LastName, email, number, password}= req.body;
        
        if (!idUser|| !name || !LastName || !email || !number ) {
            return res.status(400).json({ message: "incomplete user data" });
        }
        
        
        //verify if id exists
        const idExists = await dataBase.collection('users').doc(id).get();
        
        
        if (!idExists.exists) {
            return res.status(400).json({ message: "User not found" });
        }

        //verify type of data
        if (!/^\d+$/.test(idUser)) {
            return res.status(400).json({ message: "incorrect type of data: ID must have ONLY numbers" });
        }
        if (!/^\d+$/.test(number)) {
            return res.status(400).json({ message: "incorrect type of data: number must contain ONLY numbers" });
        }
        if(!string_validation(name,LastName)){
            return res.status(400).json({ message: "incorrect type of data: name or LastName must have ONLY strings" });
        }

        //verify email format
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
            return res.status(400).json({ message: "email must have a valid format" });
        }

        
        
        //hash password
        let passwordHash = await bcryptjs.hash(password,10);
        let photoUserURL = null;
        
        //photo user
        if (req.file){
            const bucket = admin.storage().bucket();
            const fileName = `users/${req.body.id}_${Date.now()}_${req.file.originalname}`;
            const file = bucket.file(fileName);
            
            await new Promise ((resolve,reject)=>{
                const stream =file.createWriteStream({
                    metadata: {
                        contentType : req.file.mimetype,
                    }
    
                })
                stream.on('error',(err)=>{
                    res.status(500).json({message:"Error uploading image",error: err.message});
                })

                stream.on('finish', async ()=>{
                    photoUserURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    resolve();
    
                });
                stream.end(req.file.buffer);
            });
        }
        
        const userUpdatedData = 
        {
                idUser: req.body.idUser,
                name: req.body.name,
                LastName: req.body.LastName,
                email: req.body.email,
                number: req.body.number,
                
                ...(photoUserURL && { photoUser: photoUserURL }) 
        
        }
         // Solo actualizar la contraseña si fue proporcionada
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ message: "Password must be at least 8 characters long" });
            }
            const passwordHash = await bcryptjs.hash(password, 10);
            userUpdatedData.password = passwordHash;

        }
        
        if(photoUserURL){
            console.log(photoUserURL);
            userUpdatedData.photoUser = photoUserURL;
        }
            
        const userRef = await dataBase.collection('users').doc(id).update(userUpdatedData);
        const userId = userRef.id; // firebase ID
        return res.status(201).json({ message: "User updated",userId });
    }
    catch (error) {
        res.status(500).json({ message: "User not updated", error: error.message });
    }
})

//get user's information
route_user.get('/:id',authenticate, async (req,res) =>{
    try{
        const { id }= req.params;
        const currentUser = await dataBase.collection('users').doc(id).get();

        if(!currentUser){
        return res.status(404).json({ message: "User not found" });
        }
        const userData = currentUser.data();
        return res.status(200).json({ message: "User data", data:userData });
    }
    catch(error){
        return res.status(200).json({ message: "error retrieving userdata", error:error.message });
    }
    
});
//get user information
route_user.get('/photo/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userDoc = await dataBase.collection('users').doc(id).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: "User not found" });
        }

        const userData = userDoc.data();

        if (!userData.photoUser) {
            return res.status(404).json({ message: "User photo not found" });
        }

        const bucket = admin.storage().bucket();
        const file = bucket.file(userData.photoUser);

        const [fileBuffer] = await file.download();
        res.set('Content-Type', 'image/jpeg'); 
        res.send(fileBuffer);
    } catch (error) {
        return res.status(500).json({ message: "Error retrieving user photo", error: error.message });
    }
});


module.exports = route_user;