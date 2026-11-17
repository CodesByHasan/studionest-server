import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

app.use(cors());
app.use(express.json());

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("studionest");

const studioCollection = db.collection("studios");
const bookingCollection = db.collection("bookings");

// ===================================
// VERIFY BETTER AUTH JWT
// ===================================

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", process.env.CLIENT_URL)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    if (!payload.sub) {
      return res.status(401).send({ msg: "Unauthorized!" });
    }

    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT Error:", error.message);
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

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ msg: "Invalid studio ID." });
  }

  const result = await studioCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!result) {
    return res.status(404).send({ msg: "Studio not found." });
  }

  res.send(result);
});

// Add studio
app.post("/api/studios", verifyToken, async (req, res) => {
  const studio = {
    ...req.body,
    hostId: req.user.sub,
    hostEmail: req.user.email,
    createdAt: new Date(),
  };

  const result = await studioCollection.insertOne(studio);

  res.status(201).send({
    message: "Studio published successfully!",
    insertedId: result.insertedId,
  });
});

// Update studio
app.patch("/api/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ msg: "Invalid studio ID." });
  }

  const data = { ...req.body };

  delete data._id;
  delete data.hostId;
  delete data.hostEmail;

  const result = await studioCollection.updateOne(
    {
      _id: new ObjectId(id),
      hostId: req.user.sub,
    },
    {
      $set: data,
    }
  );

  if (!result.matchedCount) {
    return res.status(404).send({
      msg: "Studio not found or unauthorized.",
    });
  }

  res.send({ message: "Studio updated successfully!" });
});

// Delete studio
app.delete("/api/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ msg: "Invalid studio ID." });
  }

  const result = await studioCollection.deleteOne({
    _id: new ObjectId(id),
    hostId: req.user.sub,
  });

  if (!result.deletedCount) {
    return res.status(404).send({
      msg: "Studio not found or unauthorized.",
    });
  }

  res.send({ message: "Studio deleted successfully!" });
});

// ===================================
// BOOKING ROUTES
// ===================================

// Check booking availability
app.post("/api/bookings/check-availability", async (req, res) => {
  const { studioId, startAt, endAt } = req.body;

  if (
    !studioId ||
    !startAt ||
    !endAt ||
    !ObjectId.isValid(studioId)
  ) {
    return res.status(400).send({
      msg: "Invalid booking information.",
    });
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return res.status(400).send({
      msg: "Invalid booking dates.",
    });
  }

  const conflict = await bookingCollection.findOne({
    studioId,
    status: "Confirmed",
    startAt: { $lt: endDate },
    endAt: { $gt: startDate },
  });

  res.send({
    available: !conflict,
  });
});

// Add booking
app.post("/api/bookings", verifyToken, async (req, res) => {
  const { studioId, startAt, endAt } = req.body;

  if (
    !studioId ||
    !ObjectId.isValid(studioId) ||
    !startAt ||
    !endAt
  ) {
    return res.status(400).send({
      msg: "Invalid booking information.",
    });
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const currentDate = new Date();

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate <= currentDate ||
    endDate <= startDate
  ) {
    return res.status(400).send({
      msg: "Please select valid future booking hours.",
    });
  }

  // Find studio
  const studio = await studioCollection.findOne({
    _id: new ObjectId(studioId),
  });

  if (!studio) {
    return res.status(404).send({
      msg: "Studio not found.",
    });
  }

  const hourlyRate = Number(studio.hourlyRate);

  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return res.status(400).send({
      msg: "Invalid studio hourly rate.",
    });
  }

  // Calculate booking duration and price on server
  const duration = (endDate - startDate) / (1000 * 60 * 60);
  const totalAmount = Number((duration * hourlyRate).toFixed(2));

  // Check confirmed booking conflicts again
  const conflict = await bookingCollection.findOne({
    studioId,
    status: "Confirmed",
    startAt: { $lt: endDate },
    endAt: { $gt: startDate },
  });

  if (conflict) {
    return res.status(409).send({
      msg: "This studio is already booked for the selected time.",
    });
  }

  // Save booking
  const booking = {
    studioId,
    studioTitle: studio.title,
    studioImage: studio.image || "",
    location: studio.location || "",
    hourlyRate,
    startAt: startDate,
    endAt: endDate,
    duration: Number(duration.toFixed(2)),
    totalAmount,
    userId: req.user.sub,
    userEmail: req.user.email,
    status: "Pending",
    createdAt: new Date(),
  };

  const result = await bookingCollection.insertOne(booking);

  res.status(201).send({
    message: "Booking request submitted successfully!",
    insertedId: result.insertedId,
  });
});

// Get my bookings
app.get("/api/bookings/my-bookings", verifyToken, async (req, res) => {
  const result = await bookingCollection
    .find({ userId: req.user.sub })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});

// Cancel pending booking
app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ msg: "Invalid booking ID." });
  }

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

  if (!result.matchedCount) {
    return res.status(404).send({
      msg: "Booking not found or cannot be cancelled.",
    });
  }

  res.send({
    message: "Booking cancelled successfully!",
  });
});

// ===================================
// SERVER STATUS
// ===================================

app.get("/", (req, res) => {
  res.send({
    message: "StudioNest server is running fine!",
  });
});

app.listen(PORT, () => {
  console.log(`StudioNest server is running at port ${PORT}`);
});

export default app;







