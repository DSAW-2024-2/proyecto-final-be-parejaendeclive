const express = require('express');
const bcryptjs = require('bcryptjs');
const dataBase = require('../connectionFB');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const route_login= express.Router();

dotenv.config();

route_login.post('/', async (req,res)=>{
    const {email,password}= req.body
    const userLogin = dataBase.collection('users');
    const emailLogin = await userLogin.where('email', '==', email).get();
    try{
        if(!email || !password){
        return res.status(400).json({error:"email and password required"});
        }
        if(emailLogin.empty){
            return res.status(400).json({error:"user not found"}); 
        }
        let user;
        emailLogin.forEach(doc => {
        user = doc.data(); 
        });
        const credential = await bcryptjs.compare(password, user.password);
        if(!credential){
            return res.status(400).json({error:"Invalid credentials"});
        }
        const emailUser = user.email;
        const accessToken = generateToken(emailUser);
        return res.status(200).json({ message: "Inicio de sesión exitoso", accessToken });

    }
    catch(error){
        res.status(500).json({ message: "failed login", error: error.message });

    }
    function generateToken(emailUser) {
        //se pone fecha de expiracion para probar que el error 403 funciona en ambos casos
        return jwt.sign({emailUser}, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
    }
    

})
module.exports = route_login;