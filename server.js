const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

function generateMeetingId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.get("/", (req, res) => {
    const meetingId = generateMeetingId();
    res.redirect(`/host/${meetingId}`);
});

app.get("/host/:meetingId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/join/:meetingId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "participant.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});