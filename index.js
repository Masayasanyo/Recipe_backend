import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt'; 
import { createClient } from '@supabase/supabase-js'

dotenv.config();
const supabaseUrl = 'https://jysaghwdfkutombynqst.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const app = express();
app.use(cors());
app.use(bodyParser.json());


app.post('/signup', async (req, res) => {
    const { userName, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const { data, error } = await supabase
            .from('accounts')
            .insert({ username: userName, email: email, password: hashedPassword })
            .select()
        if (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            console.log(data);
            res.status(201).json({ message: 'Success!', user: data }); 
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase
            .from('accounts')
            .select()
            .eq('email', email)
        if (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            console.log(data);
            const match = await bcrypt.compare(password, data[0].password);
            if (match) {
                res.status(200).json({ message: 'Success', data: data[0] });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    } 
});


app.post('/recipe/mylist', async (req, res) => {
    const {account_id} = req.body;
    console.log(account_id);
    if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        const { data, error } = await supabase
            .from('recipe')
            .select(`
                id,
                account_id,
                name,
                image,
                description,
                time,
                date,
                label(id, recipe_id, name),
                material(id, recipe_id, name, quantity),
                process(id, recipe_id, step, name)
            `)
            .eq('account_id', account_id);
        if (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            console.log(data);
            res.status(200).json({ message: 'Success!', recipe: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/recipe/add', async (req, res) => {
    const {accountId, title, image, time, description, material, process, label} = req.body;
    let recipeId = 0;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        // Insert into recipe table
        const { data: recipe_data, error: recipe_error } = await supabase
            .from('recipe')
            .insert({ account_id: accountId, name: title, image: image, description: description, time: time })
            .select()
        if (recipe_error) {
            console.error('Error:', recipe_error);
            res.status(500).json({ error: 'Server error' });
        }
        if (recipe_data) {
            recipeId = recipe_data[0].id;
        }

        // Insert into material table
        for (var i = 0; i < material.length; i++) {
            const { data: material_data, error: material_error } = await supabase
                .from('material')
                .insert({ recipe_id: recipeId, name: material[i].name, quantity: material[i].quantity })
                .select()
            if (material_error) {
                console.error('Error:', material_error);
                res.status(500).json({ error: 'Server error' });
            }
        }

        // Insert into label table
        for (var i = 0; i < label.length; i++) {
            const { data: label_data, error: label_error } = await supabase
                .from('label')
                .insert({ recipe_id: recipeId, name: label[i] })
                .select()
            if (label_error) {
                console.error('Error:', label_error);
                res.status(500).json({ error: 'Server error' });
            }
        }

        // Insert into process table
        for (var i = 0; i < process.length; i++) {
            const { data: process_data, error: process_error } = await supabase
                .from('process')
                .insert({ recipe_id: recipeId, step: process[i]["step"], name: process[i]["name"] })
                .select()
            if (process_error) {
                console.error('Error:', process_error);
                res.status(500).json({ error: 'Server error' });
            }
        }

        res.status(201).json({ message: 'Success!', recipe: recipe_data }); 

    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server: ${PORT}`);
});
