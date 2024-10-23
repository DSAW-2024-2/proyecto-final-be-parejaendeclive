const express = require('express');
const route_register =express.Router();
const bcryptjs = require('bcryptjs');
const dataBase = require('../connectionFB');
//photo user


function string_validation( name, LastName){
    let data =[name,LastName]
    const letters = /^[A-Za-z\s]+$/;
    return data.every(item => letters.test(item));
    
}


route_register.get('/', (req, res) => {
    return res.status(200).json({message: 'users succesful!'});
});

route_register.post('/',async (req,res) =>{
    try{
        const {id,name,LastName, email, number, password}= req.body;
        if (!id || !name || !LastName || !email || !number ||!password) {
            return res.status(400).json({ message: "incomplete user data" });
        }
        
        const users = dataBase.collection('users').doc(id);
        const doc = await users.get();
        
        if (doc.exists) {
            return res.status(400).json({ message: "ID already in use" });
        }
        
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: "incorrect type of data: ID must have ONLY numbers" });
        }
        if (!/^\d+$/.test(number)) {
            return res.status(400).json({ message: "incorrect type of data: number must contain ONLY numbers" });
        }
        if(!string_validation(name,LastName)){
            return res.status(400).json({ message: "incorrect type of data: name or LastName must have ONLY string" });
        }
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
            return res.status(400).json({ message: "email must have a valid format" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        
        let passwordHash = await bcryptjs.hash(password,10);
        
        await dataBase.collection('users').doc(req.body.id).set(
            {
                name: req.body.name,
                LastName: req.body.LastName,
                email: req.body.email,
                number: req.body.number,
                password: passwordHash
    
            }
        )
        return res.status(201).json({ message: "User added" });


    }
    catch (error) {
        res.status(500).json({ message: "User not added", error: error.message });
    }
    
})

module.exports = route_register;