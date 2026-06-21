const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.redirect("/host");
});

app.get("/host", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/join", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "participant.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});