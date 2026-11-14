import express from "express";
import { MongoClient } from 'mongodb';
import 'dotenv/config'
import cors from 'cors';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB().catch(console.error);
const db = mongoClient.db('studionest');
const studiosCollection = db.collection('studios');

app.post ('/add-studio', async (req, res) => {
    const data = req.body;
    const result = await studiosCollection.insertOne(data);
  console.log('data', data);
    // res.json({ message: "studio added successfully" });
    console.log('result', result);
    res.send(result);
    // res.send({ message: "studio added successfully" });
});

// http://localhost:8000/add-studio

app.get("/", (req, res) => {
  res.send("msg: server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
