const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();
const path = require("path");

const app = express();
const URL = process.env.DB;

const DB_NAME = "movie_db";
const COLLECTION_NAME = "movie";

app.use(cors({ origin: "*" }));
app.use(express.json());

// Step 1: Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Step 2: Add a route for the root ("/") to serve the index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Step 3: Your existing API routes
app.get("/movie/get-movies", async (req, res) => {
  try {
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let collection = await db.collection(COLLECTION_NAME);
    let movies = await collection.find({}).toArray();
    (await client).close();
    res.json(movies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let collection = await db.collection(COLLECTION_NAME);
    let movie = await collection.findOne({ _id: new ObjectId(id) });
    (await client).close();
    res.json(movie);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/movie/book-movie", async (req, res) => {
  let bookingRequest = req.body;
  if (
    !bookingRequest.movieId ||
    !bookingRequest.showId ||
    !bookingRequest.seats ||
    !bookingRequest.name ||
    !bookingRequest.email ||
    !bookingRequest.phoneNumber
  ) {
    return res.status(401).json({ message: "Some fields are missing" });
  }
  
  let requestedSeat = parseInt(bookingRequest.seats);
  if (isNaN(requestedSeat) || requestedSeat <= 0) {
    return res.status(401).json({ message: "Invalid seat count" });
  }

  try {
    const client = new MongoClient(URL, {}).connect();
    let db = (await client).db(DB_NAME);
    let collection = await db.collection(COLLECTION_NAME);

    let movie = await collection.findOne({ _id: new ObjectId(bookingRequest.movieId) });
    if (!movie) {
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    const show = Object.values(movie.shows).flat().find(s => s.id === bookingRequest.showId);
    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    if (parseInt(show.seats) < requestedSeat) {
      return res.status(404).json({ message: "Not enough seats available" });
    }

    const updateSeats = parseInt(show.seats) - requestedSeat;
    const date = Object.keys(movie.shows).find(d => movie.shows[d].some(s => s.id === bookingRequest.showId));
    const showIndex = movie.shows[date].findIndex(s => s.id === bookingRequest.showId);

    const userBooking = {
      name: bookingRequest.name,
      email: bookingRequest.email,
      phoneNumber: bookingRequest.phoneNumber,
      seats: bookingRequest.seats
    };

    const updatedResult = await collection.updateOne(
      { _id: new ObjectId(bookingRequest.movieId) },
      {
        $set: { [`shows.${date}.${showIndex}.seats`]: updateSeats },
        $push: { [`shows.${date}.${showIndex}.bookings`]: userBooking }
      }
    );

    if (updatedResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update" });
    }

    return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Start the server
app.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
