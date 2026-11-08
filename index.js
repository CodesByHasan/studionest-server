import express from "express";
import { MongoClient } from 'mongodb';

const app = express();
const PORT = 8000;



const client = new MongoClient("mongodb://studionest:BfYErMkOlRNrEmcr@ac-jzh5o95-shard-00-00.cya527b.mongodb.net:27017,ac-jzh5o95-shard-00-01.cya527b.mongodb.net:27017,ac-jzh5o95-shard-00-02.cya527b.mongodb.net:27017/?ssl=true&replicaSet=atlas-hqa170-shard-0&authSource=admin");

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB().catch(console.error);

// http://localhost:8000/

app.get("/", (req, res) => {
  res.send("msg: server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
