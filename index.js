import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs'; 
import { createClient } from '@supabase/supabase-js'
import multer from 'multer';

dotenv.config();
const supabaseUrl = 'https://jysaghwdfkutombynqst.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const app = express();
app.use(cors());
app.use(bodyParser.json());
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


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
                ingredient(id, recipe_id, name, quantity),
                process(id, recipe_id, step, name)
            `)
            .eq('account_id', account_id)
            .order('date', { ascending: false });
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            return res.status(200).json({ message: 'Success!', recipe: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});

app.post('/recipe/add/image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        console.error('No file received');
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Received file:', req.file.size);    
    const fileName = `${Date.now()}_${req.file.originalname}`;
    console.log(fileName);

    try {
        const { data, error } = await supabase.storage
            .from("recipe_image")
            .upload(fileName, req.file.buffer);
        if (error) {
            console.error("Error:", error.message);
            return res.status(500).json({ error: 'Server error' });
        }
        const { data: urlData } = supabase.storage
            .from("recipe_image")
            .getPublicUrl(fileName);
        return res.status(201).json({ message: 'Success!', url: urlData.publicUrl }); 
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/recipe/add', async (req, res) => {
    const {public_private, accountId, title, image, time, description, ingredient, process, label} = req.body;
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

        // Insert into ingredient table
        for (var i = 0; i < ingredient.length; i++) {
            const { data: ingredient_data, error: ingredient_error } = await supabase
                .from('ingredient')
                .insert({ recipe_id: recipeId, name: ingredient[i].name, quantity: ingredient[i].quantity })
                .select()
            if (ingredient_error) {
                console.error('Error:', ingredient_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

        // Insert into label table
        for (var i = 0; i < label.length; i++) {
            console.log(label[i]["name"]);
            const { data: label_data, error: label_error } = await supabase
                .from('label')
                .insert({ recipe_id: recipeId, name: label[i]["name"] })
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
    const {set_id, public_private, accountId, recipeId, title, image, time, description, ingredient, process, label} = req.body;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        if (set_id !== "nothing") {
            const { data, error } = await supabase
                .from('single_set_links')
                .insert({ recipe_id: recipeId, set_id: set_id, account_id: accountId })
                .select()
            if (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

        if (image) {
            const { data: recipe_data, error: recipe_error } = await supabase
                .from('recipe')
                .update({ image: image })
                .eq('id', recipeId)
                .select()
            if (recipe_error) {
                console.error('Error:', recipe_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }


        // Insert into recipe table
        const { data: recipe_data, error: recipe_error } = await supabase
            .from('recipe')
            .update({ public: public_private, account_id: accountId, name: title, description: description, time: time })
            .eq('id', recipeId)
            .select()
        if (recipe_error) {
            console.error('Error:', recipe_error);
            return res.status(500).json({ error: 'Server error' });
        }

        // Delete the ingredients data
        const { data: delete_ingredient_data, error: delete_ingredient_error } = await supabase
            .from('ingredient')
            .delete()
            .eq('recipe_id', recipeId)
            .select()  
        if (delete_ingredient_error) {
            console.error('Error:', delete_ingredient_error);
            res.status(500).json({ error: 'Server error' });
        }

        // Reupload the ingredients data
        for (var i = 0; i < ingredient.length; i++) {
            const { data: ingredient_data, error: ingredient_error } = await supabase
                .from('ingredient')
                .insert({ recipe_id: recipeId, name: ingredient[i].name, quantity: ingredient[i].quantity })
                .select()
            if (ingredient_error) {
                console.error('Error:', ingredient_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

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
                .insert({ recipe_id: recipeId, name: label[i]['name'] })
                .select()
            if (label_error) {
                console.error('Error:', label_error);
                return res.status(500).json({ error: 'Server error' });
            }
        }

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
            res.status(201).json({ message: 'Success!', data: data }); 
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/recipe/mylist/search', async (req, res) => {
    const {account_id, keyword, option} = req.body;
    if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        if (option === 'title') {
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
                    ingredient(id, recipe_id, name, quantity),
                    process(id, recipe_id, step, name)
                `)
                .eq('account_id', account_id)
                .order('date', { ascending: false });
            if (keyword) {
                query = query.ilike('name', `%${keyword}%`);           
            }
            const { data, error } = await query;

            if (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Failed to fetch recipes' });
            }
            if (data && data.length > 0) {
                return res.status(200).json({ message: 'Success!', recipe: data }); 
            } else {
                return res.status(404).json({ error: 'No recipes found' });
            }
        }

        if (option === 'label') {
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
                    label!inner(id, recipe_id, name),
                    ingredient(id, recipe_id, name, quantity),
                    process(id, recipe_id, step, name)
                `)
                .eq('account_id', account_id)
                .order('date', { ascending: false });
            if (keyword) {
                query = query.ilike('label.name', `%${keyword}%`);           
            }
            const { data, error } = await query;

            if (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Failed to fetch recipes' });
            }
            if (data && data.length > 0) {
                return res.status(200).json({ message: 'Success!', recipe: data }); 
            } else {
                return res.status(404).json({ error: 'No recipes found' });
            }
        }

        if (option === 'ingredients') {
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
                    ingredient!inner(id, recipe_id, name, quantity),
                    process(id, recipe_id, step, name)
                `)
                .eq('account_id', account_id)
                .order('date', { ascending: false });
            if (keyword) {
                query = query.ilike('ingredient.name', `%${keyword}%`);           
            }
            const { data, error } = await query;

            if (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Failed to fetch recipes' });
            }
            if (data && data.length > 0) {
                return res.status(200).json({ message: 'Success!', recipe: data }); 
            } else {
                return res.status(404).json({ error: 'No recipes found' });
            }
        }

    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.get('/recipe/public', async (req, res) => {

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
                ingredient(id, recipe_id, name, quantity),
                process(id, recipe_id, step, name)
            `)
            .eq('public', true)
            .order('date', { ascending: false });
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            return res.status(200).json({ message: 'Success!', recipe: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/set/all', async (req, res) => {
    const {accountId} = req.body;
    console.log(accountId);

    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        const { data, error } = await supabase
            .from('recipe_set')
            .select(`
                id,
                account_id,
                name,
                description,
                date
            `)
            .eq('account_id', accountId)
            .order('date', { ascending: false });
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            return res.status(200).json({ message: 'Success!', set: data }); 
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});


app.post('/set/create', async (req, res) => {
    var {accountId, title, description} = req.body;

    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }
    if (!title) {
        title = 'No title';
    }
    if (!description) {
        description = 'No description';
    }

    try {
        const { data, error } = await supabase
            .from('recipe_set')
            .insert({ account_id: accountId, name: title, description: description })
            .select()
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Server error' });
        }
        if (data) {
            return res.status(201).json({ message: 'Success!', recipe: data }); 
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
});

app.post('/set/add', async (req, res) => {
    const {accountId, setId, recipeIds} = req.body;

    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }
    if (!setId) {
        return res.status(400).json({ error: 'Set ID is required' });
    }
    if (!recipeIds) {
        return res.status(400).json({ error: 'Recipe ID is required' });
    }

    for (var i = 0; i < recipeIds.length; i++) {
        try {
            const { data, error } = await supabase
                .from('single_set_links')
                .insert({ recipe_id: recipeIds[i], set_id: setId, account_id: accountId })
                .select()
            if (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Server error' });
            }
            if (data) {
                return res.status(201).json({ message: 'Success!', links: data }); 
            }
        } catch (error) {
            console.error('Unexpected Error:', error);
            return res.status(500).json({ error: 'Unexpected server error' });
        }
    }
});

app.post('/set/recipe_list', async (req, res) => {
    const {set_id} = req.body;
    if (!set_id) {
        return res.status(400).json({ error: 'Set meal ID is required' });
    }

    var recipeIdList = []
    try {
        const { data, error } = await supabase
            .from('single_set_links')
            .select(`
                id,
                recipe_id, 
                set_id, 
                account_id
            `)
            .eq('set_id', set_id)
        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Failed to fetch recipes' });
        }
        if (data && data.length > 0) {
            console.log(data);
            // return res.status(200).json({ message: 'Success!', recipe: data }); 
            
            for (var i = 0; i < data.length; i++) {
                recipeIdList.push(data[i]["recipe_id"]);
            }
        } else {
            return res.status(404).json({ error: 'No recipes found' });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }

    if (recipeIdList.length > 0) {
        var recipeList = [];
        for (var i = 0; i < recipeIdList.length; i++) {
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
                        ingredient(id, recipe_id, name, quantity),
                        process(id, recipe_id, step, name)
                    `)
                    .eq('id', recipeIdList[i])
                if (error) {
                    console.error('Error:', error);
                    return res.status(500).json({ error: 'Failed to fetch recipes' });
                }
                if (data && data.length > 0) {
                    recipeList.push(data[0]);
                    // return res.status(200).json({ message: 'Success!', recipe: data }); 
                } else {
                    return res.status(404).json({ error: 'No recipes found' });
                }
            } catch (error) {
                console.error('Unexpected Error:', error);
                return res.status(500).json({ error: 'Unexpected server error' });
            }
        }
        console.log(recipeList);
        return res.status(200).json({ message: 'Success!', recipeList: recipeList }); 
    }

    
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server: ${PORT}`);
});
