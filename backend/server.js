import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import axios from "axios";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- Nodemailer (Email) ---
const emailUser = "appt31205@gmail.com";
const emailPass = "gvvz sina lejt lpqd";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: emailUser, pass: emailPass },
});

// --- SMSO API v1 ---
const SMSO_API_URL = "https://app.smso.ro/api/v1/send";
const SMSO_API_KEY = "mTr3xmoP3M9usuncicnqdD57DbxHlXWTpz4uePpz";
const SENDER_ID = "4"; // poate fi orice ID valid din cont

// --- Stocare coduri temporar ---
let codes = {}; // { "email sau telefon": "cod" }


// app.post("/register", async (req, res) => {
//   const { firstName, secondName, email, phoneNumber, username, password, birthDate, role, status } = req.body;

//   if (!firstName || !secondName || !email || !phoneNumber || !username || !password || !birthDate || !role || !status) {
//     return res.status(400).json({ message: "Completează toate câmpurile!" });
//   }

//   console.log("Date primite de la formular:", req.body);

//   const apiPayload = {
//     firstName,
//     secondName,
//     username,
//     password,
//     status,
//     role,
//     dataBirth: birthDate,
//     phoneNumber,
//     email
//   };

//   try {

//     const apiResponse = await axios.post("http://localhost:8080/auth/register", apiPayload, {
//       headers: { "Content-Type": "application/json" }
//     });

//     console.log("Răspuns de la API extern:", apiResponse.data);

 
//     res.status(200).json({
//       message: "Datele au fost trimise cu succes către API-ul extern!",
//       apiResponse: apiResponse.data
//     });

//   } catch (err) {
//     console.error("Eroare la conectarea cu API-ul extern:", err.response?.data || err.message);
//     res.status(500).json({ message: "Eroare la trimiterea datelor către API-ul extern!" });
//   }
// });

app.post("/register", async (req, res) => {
  const { firstName, secondName, email, phoneNumber, username, password, birthDate, role, status } = req.body;

  if (!firstName || !secondName || !email || !phoneNumber || !username || !password || !birthDate || !role || !status) {
    return res.status(400).json({ message: "Completează toate câmpurile!" });
  }

  const apiPayload = {
    firstName,
    secondName,
    username,
    password,
    status,
    role,
    dataBirth: birthDate,
    phoneNumber,
    email
  };

  try {
    const apiResponse = await axios.post("http://localhost:8080/auth/register", apiPayload, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("Răspuns de la API extern:", apiResponse.data);

    // Extragem userId din răspunsul API-ului extern
    const userId = apiResponse.data.userId;

    // Returnăm și userId către frontend
    res.status(200).json({
      message: "Datele au fost trimise cu succes către API-ul extern!",
      userId: apiResponse.data.message
    });

  } catch (err) {
    console.error("Eroare la conectarea cu API-ul extern:", err.response?.data || err.message);
    res.status(500).json({ message: "Eroare la trimiterea datelor către API-ul extern!" });
  }
});

app.post("/security_questions", async (req, res) => {
  const { userId, sec_quest, response } = req.body;
  if (!userId || !sec_quest || !response) {
    return res.status(400).json({ message: "Toate câmpurile sunt obligatorii!" });
  }

  try {
    const apiResponse = await axios.post("http://localhost:8080/security_questions", {
      userId,
      sec_quest,
      response
    }, {
      headers: { "Content-Type": "application/json" }
    });

    res.status(200).json(apiResponse.data);
  } catch (err) {
    console.error("Eroare la trimiterea întrebării de securitate:", err.response?.data || err.message);
    res.status(500).json({ message: "Eroare la trimiterea întrebării de securitate!" });
  }
});



app.post("/sendEmailCode", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email-ul este obligatoriu!" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes[email] = code;

  try {
    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: "Codul tău de validare",
      text: `Codul tău de validare este: ${code}`,
    });

    console.log(`Cod email trimis către ${email}: ${code}`);
    res.json({ message: "Cod trimis cu succes pe email!" });
  } catch (err) {
    console.error("Eroare la trimiterea email-ului:", err);
    res.status(500).json({ message: "Eroare la trimiterea email-ului" });
  }
});

// === Trimitere cod pe SMS (SMSO API v1) ===
app.post("/sendSMSCode", async (req, res) => {
    console.log("Body primit la backend:", req.body);
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        console.log("Număr telefon gol!");
        return res.status(400).json({ message: "Telefonul este obligatoriu!" });
    }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes[phoneNumber] = code;

  const params = new URLSearchParams();
  params.append("sender", SENDER_ID);
  params.append("to", phoneNumber);
  params.append("body", `Codul tău de validare este: ${code}`);

  try {
    const response = await axios.post(SMSO_API_URL, params, {
      headers: {
        "X-Authorization": SMSO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log("Răspuns SMSO:", response.data);
    res.json({ message: "Cod SMS trimis cu succes!" });
  } catch (err) {
    console.error("Eroare SMSO:", err.response?.data || err.message);
    res.status(500).json({ message: "Eroare la trimiterea SMS-ului" });
  }
});

// === Verificare cod ===
app.post("/verifyCode", (req, res) => {
  const { identifier, code } = req.body; // identifier = email sau telefon
  if (codes[identifier] && codes[identifier] === code) {
    return res.json({ success: true, message: "Cod valid!" });
  }
  res.json({ success: false, message: "Cod invalid!" });
});

// === Pornire server ===
app.listen(PORT, () => {
  console.log(`✅ Server pornit pe http://localhost:${PORT}`);
});
