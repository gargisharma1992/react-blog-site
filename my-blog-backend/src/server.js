import fs from 'fs';
import admin from 'firebase-admin';
import express from "express";
import { MongoClient } from "mongodb";
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// calling credentials
const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);

//Adding Firebase admin to backend
admin.initializeApp({
    credentials : admin.credential.cert(credentials)
});

const app = express();
app.use(express.json()); // EXTRA FUNCTIONALITY, whenever it sees request to have json body, its going to parse that and available to us through req.body
app.use(express.static(path.join(__dirname, '../build')));


app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'))
})
// adding middleware
app.use( async (req, res, next) => {
    const { authtoken } = req.headers;
    if(authtoken) {
        try{
            req.user =  await admin.auth().verifyIdToken(authtoken);
        }catch(e){
           return  res.sendStatus(400);
        }
    }
    req.user = req.user || {};
    next();
   
});

app.get('/api/articles/:name' , async (req, res) => {    
    const { name } = req.params;
    const { uid } = req.user;

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.o4pzyo4.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();    
    const db = client.db('react-blog-db');  

    const article =  await db.collection('articles').findOne({ name });
    if(article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.includes(uid);
        res.json(article);
    }else{
        res.sendStatus(404);
    } 
});

// adding another middleware
app.use( async (req, res, next) => {
    if(req.user) {
        next();
    } else{
        res.sendStatus(401);
    }
   
});

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;    
    const article =  await db.collection('articles').findOne({ name });

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.o4pzyo4.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();    
    const db = client.db('react-blog-db');  
   
    if (article) {
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);
        if(canUpvote) {
            await db.collection('articles').updateOne({ name } ,  { 
                $inc: { upvotes : 1 },
                $push: {upvoteIds: uid}
            });
        }
        const updatedArticle =  await db.collection('articles').findOne({ name });
        res.json(updatedArticle);
    } else {
        res.send('The article doesnot exist !!!');
    }
});

app.post('/api/articles/:name/comments', async (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    const { email } = req.user;

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.o4pzyo4.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();    
    const db = client.db('react-blog-db');  
    
    db.collection('articles').updateOne({ name } ,  { 
        $push: { comments : { postedBy : email, text} }
    });

    const article = db.collection('articles').findOne({ name });
    if(article) {
        
        res.json(article);
    }else{
        res.send('The article doesnot exist !!');
    }
   
}) 


const PORT = process.env.PORT ?? 8000;
app.listen(PORT, () => {
    console.log("Server is listening on port : " +PORT);
})