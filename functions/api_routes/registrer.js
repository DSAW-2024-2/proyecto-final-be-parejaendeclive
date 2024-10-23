const express = require('express');
const route_register =express.Router();
const bcryptjs = require('bcryptjs');
const {admin,dataBase} = require('../connectionFB');
const multer= require('multer');
const { resolve } = require('path');



const upload = multer({storage:multer.memoryStorage()});
function string_validation( name, LastName){
    let data =[name,LastName]
    const letters = /^[A-Za-z\s]+$/;
    return data.every(item => letters.test(item));
    
}


route_register.get('/',(req, res) => {
    return res.status(200).json({message: 'users succesful!'});
});

route_register.post('/',upload.single("photoUser"),async (req,res) =>{
    try{
        const {id,name,LastName, email, number, password}= req.body;
        
        if (!id || !name || !LastName || !email || !number ||!password) {
            return res.status(400).json({ message: "incomplete user data" });
        }
        
        //verify if id exists
        const idExists = await dataBase.collection('users').where('id', '==', id).get();
        
        if (!idExists.empty) {
            return res.status(400).json({ message: "ID already in use" });
        }

        //verify type of data
        if (!/^\d+$/.test(id)) {
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
        
        const userRegisterData = 
        {
                id: req.body.id,
                name: req.body.name,
                LastName: req.body.LastName,
                email: req.body.email,
                number: req.body.number,
                password: passwordHash
        
        }
        if(photoUserURL){
            userRegisterData.photoUser = photoUserURL;
        }
            
        await dataBase.collection('users').add(userRegisterData);
        return res.status(201).json({ message: "User added" });
    }
    catch (error) {
        res.status(500).json({ message: "User not added", error: error.message });
    }
    
})

module.exports = route_register;