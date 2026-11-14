
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
    throw err;
  }
}

app.use(cors());
app.use(express.json());

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("studionest");
const studioCollection = db.collection("studios");
const bookingCollection = db.collection("bookings");

// Verify Better Auth JWT
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
};

// ===================================
// STUDIO ROUTES
// ===================================

// Get all studios
app.get("/api/studios", async (req, res) => {
  const result = await studioCollection.find().toArray();
  res.send(result);
});

// Get featured studios
app.get("/api/studios/featured", async (req, res) => {
  const result = await studioCollection
    .find()
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  res.send(result);
});

// Get my studio listings
app.get("/api/studios/my-listings", verifyToken, async (req, res) => {
  const result = await studioCollection
    .find({ hostId: req.user.sub })
    .toArray();

  res.send(result);
});

// Get single studio
app.get("/api/studios/:id", async (req, res) => {
  const { id } = req.params;

  const result = await studioCollection.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

// Add studio
app.post("/api/studios", verifyToken, async (req, res) => {
  const data = req.body;

  const studio = {
    ...data,
    hostId: req.user.sub,
    hostEmail: req.user.email,
    createdAt: new Date(),
  };

  const result = await studioCollection.insertOne(studio);
  res.send(result);
});

// Update studio
app.patch("/api/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await studioCollection.updateOne(
    {
      _id: new ObjectId(id),
      hostId: req.user.sub,
    },
    {
      $set: data,
    }
  );

  res.send(result);
});

// Delete studio
app.delete("/api/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  const result = await studioCollection.deleteOne({
    _id: new ObjectId(id),
    hostId: req.user.sub,
  });

  res.send(result);
});

// ===================================
// BOOKING ROUTES
// ===================================

// Add booking
app.post("/api/bookings", verifyToken, async (req, res) => {
  const data = req.body;

  const booking = {
    ...data,
    userId: req.user.sub,
    userEmail: req.user.email,
    status: "Pending",
    createdAt: new Date(),
  };

  const result = await bookingCollection.insertOne(booking);
  res.send(result);
});

// Get my bookings
app.get("/api/bookings/my-bookings", verifyToken, async (req, res) => {
  const result = await bookingCollection
    .find({ userId: req.user.sub })
    .toArray();

  res.send(result);
});

// Cancel pending booking
app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
  const { id } = req.params;

  const result = await bookingCollection.updateOne(
    {
      _id: new ObjectId(id),
      userId: req.user.sub,
      status: "Pending",
    },
    {
      $set: { status: "Cancelled" },
    }
  );

  res.send(result);
});

// Check booking time conflicts for confirmed bookings
app.post("/api/bookings/check-availability", async (req, res) => {
  const { studioId, startAt, endAt } = req.body;

  const result = await bookingCollection.findOne({
    studioId,
    status: "Confirmed",
    startAt: { $lt: new Date(endAt) },
    endAt: { $gt: new Date(startAt) },
  });

  res.send({ available: !result });
});

// Server status
app.get("/", (req, res) => {
  res.send({ message: "StudioNest server is running fine!" });
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

export default app;



