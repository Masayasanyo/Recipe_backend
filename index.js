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
            return res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            console.log(data);
            return res.status(201).json({ message: 'Success!', user: data }); 
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
            return res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            console.log(data);
            const match = await bcrypt.compare(password, data[0].password);
            if (match) {
                return res.status(200).json({ message: 'Success', data: data[0] });
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ error: 'User not found' });
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
                public, 
                date,
                label(id, recipe_id, name),
                material(id, recipe_id, name, quantity),
                process(id, recipe_id, step, name)
            `)
            .eq('account_id', account_id)
            .order('date', { ascending: false });
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            console.log(data);
            return res.status(200).json({ message: 'Success!', recipe: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/recipe/add', async (req, res) => {
    const {public_private, accountId, title, image, time, description, material, process, label} = req.body;
    let recipeId = 0;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        // Insert into recipe table
        const { data: recipe_data, error: recipe_error } = await supabase
            .from('recipe')
            .insert({ public: public_private, account_id: accountId, name: title, image: image, description: description, time: time })
            .select()
        if (recipe_error) {
            console.error('Error:', recipe_error);
            return res.status(500).json({ error: 'Server error' });
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
                return res.status(500).json({ error: 'Server error' });
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
                return res.status(500).json({ error: 'Server error' });
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
                return res.status(500).json({ error: 'Server error' });
            }
        }

        return res.status(201).json({ message: 'Success!', recipe: recipe_data }); 

    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/recipe/edit', async (req, res) => {
    const {public_private, accountId, recipeId, title, image, time, description, material, process, label} = req.body;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }
    console.log(recipeId);

    try {
        // Insert into recipe table
        const { data: recipe_data, error: recipe_error } = await supabase
            .from('recipe')
            .update({ public: public_private, account_id: accountId, name: title, image: image, description: description, time: time })
            .eq('id', recipeId)
            .select()
        if (recipe_error) {
            console.error('Error:', recipe_error);
            return res.status(500).json({ error: 'Server error' });
        }

        // Insert into material table
        // for (var i = 0; i < material.length; i++) {
        //     const { data: material_data, error: material_error } = await supabase
        //         .from('material')
        //         .update({ recipe_id: recipeId, name: material[i].name, quantity: material[i].quantity })
        //         .eq('recipe_id', recipeId)
        //         .select()
        //     console.log({"log": material[i].name});
        //     if (material_error) {
        //         console.error('Error:', material_error);
        //         return res.status(500).json({ error: 'Server error' });
        //     }
        // }

        // Delete the ingredients data
        const { data: delete_material_data, error: delete_material_error } = await supabase
            .from('material')
            .delete()
            .eq('recipe_id', recipeId)
            .select()  
        if (delete_material_error) {
            console.error('Error:', material_error);
            res.status(500).json({ error: 'Server error' });
        }

        // Reupload the ingredients data
        for (var i = 0; i < material.length; i++) {
            const { data: material_data, error: material_error } = await supabase
                .from('material')
                .insert({ recipe_id: recipeId, name: material[i].name, quantity: material[i].quantity })
                .select()
            if (material_error) {
                console.error('Error:', material_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }





        // Insert into label table
        // for (var i = 0; i < label.length; i++) {
        //     const { data: label_data, error: label_error } = await supabase
        //         .from('label')
        //         .update({ recipe_id: recipeId, name: label[i] })
        //         .eq('recipe_id', recipeId)
        //         .select()
        //     if (label_error) {
        //         console.error('Error:', label_error);
        //         return res.status(500).json({ error: 'Server error' });
        //     }
        // }

        // Delete the labels data
        const { data: delete_label_data, error: delete_label_error } = await supabase
            .from('label')
            .delete()
            .eq('recipe_id', recipeId)
            .select()  
        if (delete_label_error) {
            console.error('Error:', delete_label_error);
            res.status(500).json({ error: 'Server error' });
        }
        // Reupload the label data
        for (var i = 0; i < label.length; i++) {
            const { data: label_data, error: label_error } = await supabase
                .from('label')
                .insert({ recipe_id: recipeId, name: label[i] })
                .select()
            if (label_error) {
                console.error('Error:', label_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

        // Insert into process table
        // for (var i = 0; i < process.length; i++) {
        //     const { data: process_data, error: process_error } = await supabase
        //         .from('process')
        //         .update({ recipe_id: recipeId, step: process[i]["step"], name: process[i]["name"] })
        //         .eq('recipe_id', recipeId)
        //         .select()
        //     if (process_error) {
        //         console.error('Error:', process_error);
        //         return res.status(500).json({ error: 'Server error' });
        //     }
        // }


        // Delete the process data
        const { data: delete_process_data, error: delete_process_error } = await supabase
            .from('process')
            .delete()
            .eq('recipe_id', recipeId)
            .select()  
        if (delete_process_error) {
            console.error('Error:', delete_process_error);
            res.status(500).json({ error: 'Server error' });
        }

        // Reupload the process data
        for (var i = 0; i < process.length; i++) {
            const { data: process_data, error: process_error } = await supabase
                .from('process')
                .insert({ recipe_id: recipeId, step: process[i]["step"], name: process[i]["name"] })
                .select()
            if (process_error) {
                console.error('Error:', process_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

        return res.status(201).json({ message: 'Success!', recipe: recipe_data }); 

    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});



app.delete('/recipe/single', async (req, res) => {
    const {recipe_id} = req.body;

    if (!recipe_id) {
        return res.status(400).json({ error: 'Account ID is required' });
    }
    try {
        const { data, error } = await supabase
            .from('recipe')
            .delete()
            .eq('id', recipe_id)
            .select()  

        if (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            console.log(data);
            res.status(201).json({ message: 'Success!', data: data }); 
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});

app.post('/recipe/mylist/search', async (req, res) => {
    const {account_id, keyword} = req.body;
    console.log(account_id);
    if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {

        let query = supabase
            .from('recipe')
            .select(`
                id,
                account_id,
                name,
                image,
                description,
                time, 
                public, 
                date,
                label(id, recipe_id, name),
                material(id, recipe_id, name, quantity),
                process(id, recipe_id, step, name)
            `)
            .eq('account_id', account_id)
            .order('date', { ascending: false });
        if (keyword) {
            // query = query.eq('name', keyword);
            query = query.ilike('name', `%${keyword}%`);
            // query = query.eq('label.name', keyword);
            // query = query.or(`name.eq.${keyword},label.name.eq.${keyword}`);
            // query = query.or(`name.ilike.%${keyword}%,label.name.ilike.%${keyword}%`);
            // query = query.or(`name.eq.%${keyword}%`, `label.name.eq.%${keyword}%`);

        }
        const { data, error } = await query;
            // .from('recipe')
            // .select(`
            //     id,
            //     account_id,
            //     name,
            //     image,
            //     description,
            //     time,
            //     date,
            //     label(id, recipe_id, name),
            //     material(id, recipe_id, name, quantity),
            //     process(id, recipe_id, step, name)
            // `)
            // .eq('account_id', account_id)
            // .eq('name', keyword);
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            console.log(data);
            return res.status(200).json({ message: 'Success!', recipe: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server: ${PORT}`);
});
