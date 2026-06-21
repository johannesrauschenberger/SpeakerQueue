const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

const meetings = {};

app.use(express.static(path.join(__dirname, "public")));

function generateMeetingId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getOrCreateMeeting(meetingId) {
    if (!meetings[meetingId]) {
        meetings[meetingId] = {
            participants: [],
            queue: [],
            currentSpeaker: null
        };
    }

    return meetings[meetingId];
}

function broadcastMeetingState(meetingId) {
    const meeting = getOrCreateMeeting(meetingId);

    io.to(meetingId).emit("meeting-state", {
        participantCount: meeting.participants.length
    });
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

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-meeting", ({ meetingId, role }) => {
        const meeting = getOrCreateMeeting(meetingId);

        socket.join(meetingId);
        socket.data.meetingId = meetingId;
        socket.data.role = role;

        if (role === "participant") {
            meeting.participants.push({
                socketId: socket.id
            });
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("disconnect", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        if (role === "participant") {
            meeting.participants = meeting.participants.filter(
                participant => participant.socketId !== socket.id
            );
        }

        broadcastMeetingState(meetingId);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});