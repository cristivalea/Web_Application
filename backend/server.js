import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import axios from "axios";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

//Email transmission 
const emailUser = "appt31205@gmail.com";
const emailPass = "gvvz sina lejt lpqd";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: emailUser, pass: emailPass },
});

// SMS transmission
const SMSO_API_URL = "https://app.smso.ro/api/v1/send";
const SMSO_API_KEY = "mTr3xmoP3M9usuncicnqdD57DbxHlXWTpz4uePpz";
const SENDER_ID = "4"; 

// Codes TEMPORARY Store
let codes = {}; 


//============Registration============
app.post("/register", async (req, res) => {
  const { firstName, secondName, email, phoneNumber, username, password, birthDate, role, status } = req.body;

  if (!firstName || !secondName || !email || !phoneNumber || !username || !password || !birthDate || !role || !status) {
    return res.status(400).json({ message: "All fields are required!" });
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

    console.log("Answer from API:", apiResponse.data);

    const userId = apiResponse.data.userId;

    res.status(200).json({
      message: "Data sent successfully!",
      userId: apiResponse.data.message
    });

  } catch (err) {
    console.error("Error connect to API", err.response?.data || err.message);
    res.status(500).json({ message: "Error sending data to API!" });
  }
});


//===Security Questions===
app.post("/security_questions", async (req, res) => {
  const { userId, sec_quest, response } = req.body;
  if (!userId || !sec_quest || !response) {
    return res.status(400).json({ message: "All fields are required!" });
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
    console.error("Error sent security question:", err.response?.data || err.message);
    res.status(500).json({ message: "Error sending security question!" });
  }
});


// === Sent Email Code ===
app.post("/sendEmailCode", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is necessary" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes[email] = code;

  try {
    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: "Validation code ",
      text: `The validation code is: ${code}`,
    });

    console.log(`Email code sent to ${email}: ${code}`);
    res.json({ message: "Code successfully sent to email!" });
  } catch (err) {
    console.error("Error sending email", err);
    res.status(500).json({ message: "Error sending email" });
  }
});

// === Sending SMS ===
app.post("/sendSMSCode", async (req, res) => {
    console.log("Body received at the backend:", req.body);
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        console.log("Empty phone number!");
        return res.status(400).json({ message: "The phone number is required!" });
    }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes[phoneNumber] = code;

  const params = new URLSearchParams();
  params.append("sender", SENDER_ID);
  params.append("to", phoneNumber);
  params.append("body", `Validation code: ${code}`);

  try {
    const response = await axios.post(SMSO_API_URL, params, {
      headers: {
        "X-Authorization": SMSO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log("SMSO response:", response.data);
    res.json({ message: "SMS code sent successfully!" });
  } catch (err) {
    console.error("Error SMSO:", err.response?.data || err.message);
    res.status(500).json({ message: "Error sending SMSO" });
  }
});

// === Code validation ===
app.post("/verifyCode", (req, res) => {
  const { identifier, code } = req.body; 
  if (codes[identifier] && codes[identifier] === code) {
    return res.json({ success: true, message: "Valide code" });
  }
  res.json({ success: false, message: "Invalid code" });
});



// === Login ===
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }
  try {
    const loginResponse = await axios.post("http://localhost:8080/auth/login", { username, password }, {
      headers: { "Content-Type": "application/json" }
    });
    const accessToken = loginResponse.data.accessToken;
    const userId = loginResponse.data.idUser;
    console.log("Login successfull, accessToken:", accessToken, "userId:", userId);
    const userResponse = await axios.get(`http://localhost:8080/emails/${userId}`, {
      headers: { "Content-Type": "application/json" }
    });
    const emails = userResponse.data;
    let email = null;
    if (emails && emails.length > 0) {
      email = emails[emails.length - 1]; 
    }
    if (!email) {
      return res.status(500).json({ message: "No email found for the user!!" });
    }
    console.log("Email:", email);    
    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: "Authentication Token",
      text: `Token: ${accessToken}`,
    });
    console.log(`Token sendiong to ${email}`);

    
    // res.status(200).json({ 
    //   token: accessToken });

    res.status(200).json({ 
      token: accessToken,
      userId: userId,
      emails: emails  
    });

  } catch (err) {
    console.error("Error login or sending email:", err.response?.data || err.message);
    res.status(401).json({ message: "Incorrect username or password!" });
  }
});


//==========Authorization==========
app.post("/verifyToken", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: "Empty token!" });
  }
  try {
    const response = await axios.post("http://localhost:8080/session/validate", { token });
    console.log("Serber response:", response.data);

    res.json({
      success: true,
      message: response.data.message,
      sessionId: response.data.sessionId,
      userId: response.data.userId
    });
  } catch (err) {
    console.error("Error token varification:", err.response?.data || err.message);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

//==========Reset Password==========
app.post("/reset-password", async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!phoneNumber || !email) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const url = `http://localhost:8080/users/search/phone?phoneNumber=${phoneNumber}`;
    const userResponse = await axios.get(url);
    const user = userResponse.data;
    if (!user || !user.idUser) {
      return res.status(404).json({ message: `User with phone number ${phoneNumber} not found!.` });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codes[phoneNumber] = code;
    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: "Reset password code!",
      text: `reset password code: ${code}`,
    });

    console.log(`Sending code to ${email} for userId ${user.idUser}: ${code}`);

    res.status(200).json({ 
    message: "Sendiing code to email was successful!",
    userId: user.idUser,
    phoneNumber: phoneNumber,  
    email: email               
  });

  } catch (err) {
    console.error("Error reset-password:", err.response?.data || err.message);
    res.status(500).json({ message: "Error sendin reset paSSWORD code!" });
  }
});



//======update password=======
app.post("/update-password", async (req, res) => {
  const { userId, phoneNumber, code, newPassword, confirmPassword } = req.body;

  console.log("Update parola:", { userId, phoneNumber, code, newPassword });

  if (!code || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields ar erequired!" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Password differ!" });
  }

  if (!codes[phoneNumber] || codes[phoneNumber] !== code) {
    return res.status(400).json({ message: "Invalid code !" });
  }

  try {
    //   const apiResponse = await axios.put(
    //   `http://localhost:8080/users/${userId}/password?newPassword=${encodeURIComponent(newPassword)}`,
    //   { headers: { "Content-Type": "application/json" } }
    // );

    const apiResponse = await axios.put(
      `http://localhost:8080/users/${userId}/password?newPassword=${encodeURIComponent(newPassword)}`,
      null,
      { headers: { "Content-Type": "application/json" } }
    );


    console.log("Respopnse Spring Boot update password:", apiResponse.data);

    delete codes[phoneNumber]; 

    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("Error updating password:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Error updating password!" });
  }
});

app.get("/profile/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required!" });
  }

  try {
    const response = await axios.get(`http://localhost:8080/users/${userId}`, {
      headers: { "Content-Type": "application/json" },
    });

    res.status(200).json(response.data);
  } catch (err) {
    console.error("Error fetching profile:", err.response?.data || err.message);
    res.status(500).json({ message: "Error fetching user profile!" });
  }
});

// === Add new email ===
app.post("/addEmail", async (req, res) => {
  const { userId, newEmail } = req.body;

  if (!userId || !newEmail) {
    return res.status(400).json({ message: "User ID and email are required!" });
  }

  try {
    const response = await axios.post(
      "http://localhost:8080/emails",
      {
        address: newEmail, 
        userId: userId
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    console.log("✅ Email added successfully:", response.data);
    res.status(200).json({ message: "Email added successfully!", data: response.data });

  } catch (err) {
    console.error(" Error adding email:", err.response?.data || err.message);
    res.status(500).json({ message: "Error adding email!" });
  }
});

// === Add new security question ===
app.post("/addNewSecurityQuestion", async (req, res) => {
  const { userId, sec_quest, response } = req.body;

  if (!userId || !sec_quest || !response) {
    return res.status(400).json({ message: "User ID, security question and response are required!" });
  }

  try {
    const axios_response = await axios.post(
      "http://localhost:8080/security_questions",
      {
        userId: userId,
        sec_quest: sec_quest,
        response: response
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    console.log("Security Question added successfully:", axios_response.data);
    res.status(200).json({
      message: "Security Question added successfully!",
      data: axios_response.data
    });

  } catch (err) {
    console.error("Error adding security question:", err.response?.data || err.message);
    res.status(500).json({ message: "Error adding security question!" });
  }
});

// === Get Active Security Questions ===
app.get("/getActiveSecurityQuestions/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const response = await axios.get(`http://localhost:8080/security_questions/${userId}`);
    const activeQuestions = response.data;
    res.json(activeQuestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching security questions" });
  }
});


// === Delete (Deactivate) Specific Security Question ===
app.put("/deleteSecurityQuestion", async (req, res) => {
  try {
    const { userId, question } = req.query; // preluăm din query

    if (!userId || !question) {
      return res.status(400).json({ message: "userId și question sunt necesare!" });
    }

    console.log(`🗑️ Ștergere întrebare pentru userId=${userId}, question=${question}`);


    const url = `http://localhost:8080/security_questions/delete?userId=${encodeURIComponent(userId)}&question=${encodeURIComponent(question)}`;

    const springResponse = await axios.delete(url, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("✅ Răspuns Spring Boot:", springResponse.data);

    res.status(200).json({ message: "Întrebare ștearsă cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la ștergerea întrebării:", err.response?.data || err.message);
    res.status(500).json({ message: "Eroare la ștergerea întrebării!" });
  }
});

//=====Update Security Question Response =====
app.put("/updateSecurityQuestionResponse", async (req, res) => {
  try {
    const { userId, question, newResponse} = req.query; 

    if (!userId || !question || !newResponse) {
      return res.status(400).json({ message: "userId și question sunt necesare!" });
    }


    const url = `http://localhost:8080/security_questions/${encodeURIComponent(userId)}?question=${encodeURIComponent(question)}&newResponse=${encodeURIComponent(newResponse)}`;

    const springResponse = await axios.put(url, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("✅ Răspuns Spring Boot:", springResponse.data);

    res.status(200).json({ message: "Modify response successfully!" });
  } catch (err) {
    console.error("Error nodify security question response", err.response?.data || err.message);
    res.status(500).json({ message: "Error modify security question response" });
  }
});


app.listen(3001, () => {
  console.log("✅ Server pornit pe http://localhost:3001");
});
