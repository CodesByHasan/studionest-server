import express from "express";
import { MongoClient } from 'mongodb';
import 'dotenv/config'
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8000;

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from .env");
}

app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

let db;
let studioCollection;
let bookingCollection;

async function connectToMongoDB() {
  await client.connect();
  console.log("Successfully connected to MongoDB!");

  db = client.db("studionest");
  studioCollection = db.collection("studios");
  bookingCollection = db.collection("bookings");

  // Useful indexes
  await studioCollection.createIndex({ createdAt: -1 });
  await studioCollection.createIndex({ hostId: 1 });
  await bookingCollection.createIndex({ studioId: 1, status: 1 });
  await bookingCollection.createIndex({ userId: 1 });

  return client;
}

// Temporary route (replaced in a later commit)
app.post("/add-studio", async (req, res) => {
  try {
    const result = await studioCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to add studio." });
  }
});

app.get("/", (req, res) => {
  res.send("msg: server is running fine!");
});

// Start server after MongoDB connects
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();