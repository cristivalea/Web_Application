import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Ruta pentru înregistrare
app.post("/register", (req, res) => {
    console.log("Date primite de la formular:");
    console.log(req.body);

    // Trimit răspuns către frontend
    res.status(200).json({
        message: "Datele au fost primite cu succes!",
        data: req.body
    });
});

// Pornim serverul
app.listen(PORT, () => {
    console.log(`✅ Server Node.js pornit pe http://localhost:${PORT}`);
});
