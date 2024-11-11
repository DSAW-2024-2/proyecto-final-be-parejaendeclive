const express = require('express');
const route_register =express.Router();
const bcryptjs = require('bcryptjs');
const {admin,dataBase} = require('../connectionFB');
const {authenticate}= require('../middlewares/authenticate');
const multer= require('multer');
const { resolve } = require('path');
const upload = multer({storage:multer.memoryStorage()});

function string_validation( name, LastName){
    let data =[name,LastName]
    const letters = /^[A-Za-z\s]+$/;
    return data.every(item => letters.test(item));
    
}

//Register an user for the first time
route_register.post('/',upload.single("photoUser"),async (req,res) =>{
    try{
        const {idUser,name,LastName, email, number, password}= req.body;
        
        if (!idUser || !name || !LastName || !email || !number ||!password) {
            return res.status(400).json({ message: "incomplete user data" });
        }
        
        //verify if id exists
        const idExists = await dataBase.collection('users').where('idUser', '==', idUser).get();
        
        if (!idExists.empty) {
            return res.status(400).json({ message: "ID already in use" });
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

        //verify password format
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        
        //hash password
        let passwordHash = await bcryptjs.hash(password,10);
        let photoUserURL = null;
        
        //photo user
        if (req.file){
            const bucket = admin.storage().bucket();
            const user= req.body.idUser
            const fileName = `users/${req.body.idUser}_${Date.now()}_${req.file.originalname}`;
            console.log(user);
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
            await file.makePublic();
        }
        let role = "pasajero";
        const userRegisterData = 
        {
                idUser: req.body.idUser,
                name: req.body.name,
                LastName: req.body.LastName,
                email: req.body.email,
                number: req.body.number,
                password: passwordHash,
                role:role
        
        }
        if(photoUserURL){
            userRegisterData.photoUser = photoUserURL;
        }
            
        const userRef = await dataBase.collection('users').add(userRegisterData);
        const userId = userRef.id; // The firebase ID 
        return res.status(201).json({ message: "User added",userId });
    }
    catch (error) {
        res.status(500).json({ message: "User not added", error: error.message });
    }
    
})

//Update users info
route_register.put('/:id',authenticate,upload.single("photoUser"), async (req,res) =>{
    try{
        const { id } = req.params;
        const {idUser,name,LastName, email, number, password}= req.body;
        
        if (!idUser|| !name || !LastName || !email || !number ||!password) {
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

        //verify password format
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        
        //hash password
        let passwordHash = await bcryptjs.hash(password,10);
        let photoUserURL = null;
        
        //photo user
        if (req.file){
            const bucket = admin.storage().bucket();
            const fileName = `users/${req.body.userId}_${Date.now()}_${req.file.originalname}`;
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
            await file.makePublic();
        }
        
        const userUpdatedData = 
        {
                idUser: req.body.idUser,
                name: req.body.name,
                LastName: req.body.LastName,
                email: req.body.email,
                number: req.body.number,
                password: passwordHash
        
        }
        if(photoUserURL){
            userUpdatedData.photoUser = photoUserURL;
        }
            
        const userRef = await dataBase.collection('users').doc(id).update(userUpdatedData);
        const userId = userRef.id; // El ID generado automáticamente por Firestore
        return res.status(201).json({ message: "User updated",userId });
    }
    catch (error) {
        res.status(500).json({ message: "User not updated", error: error.message });
    }
})

//get user's information
route_register.get('/:id',authenticate, async (req,res) =>{
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



module.exports = route_register;