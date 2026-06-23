const express = require("express");
const path = require("path");
const http = require("http");
const QRCode = require("qrcode");
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const meetings = {};

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function generateMeetingId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getOrCreateMeeting(meetingId, meetingName = "Untitled Meeting") {
    if (!meetings[meetingId]) {
        meetings[meetingId] = {
            id: meetingId,
            name: meetingName,
            createdAt: Date.now(),
            participants: [],
            queue: [],
            currentSpeaker: null,
            ended: false
        };
    }

    return meetings[meetingId];
}

function broadcastMeetingState(meetingId) {
    const meeting = getOrCreateMeeting(meetingId);

    io.to(meetingId).emit("meeting-state", {
        meetingName: meeting.name,
        createdAt: meeting.createdAt,
        participantCount: meeting.participants.length,
        participants: meeting.participants.map(participant => ({
            socketId: participant.socketId,
            name: participant.name,
            role: participant.role,
            state: participant.state,
            isManual: participant.isManual || false
        })),
        queue: meeting.queue
            .map(socketId => meeting.participants.find(p => p.socketId === socketId))
            .filter(Boolean)
            .map(participant => ({
                socketId: participant.socketId,
                name: participant.name,
                role: participant.role
            })),
        currentSpeaker: meeting.currentSpeaker
            ? {
                name: meeting.currentSpeaker.name,
                role: meeting.currentSpeaker.role
            }
            : null
    });
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/meetings", (req, res) => {
    const meetingId = generateMeetingId();
    const meetingName = req.body.meetingName?.trim() || "Untitled Meeting";

    getOrCreateMeeting(meetingId, meetingName);

    res.redirect(`/host/${meetingId}`);
});

app.get("/host/:meetingId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/join/:meetingId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "participant.html"));
});

app.get("/qr/:meetingId", async (req, res) => {
    const meetingId = req.params.meetingId;
    const participantUrl = `${req.protocol}://${req.get("host")}/join/${meetingId}`;

    try {
        const qrPng = await QRCode.toBuffer(participantUrl, {
            type: "png",
            margin: 1,
            width: 320
        });

        res.type("png");
        res.send(qrPng);
    } catch (error) {
        console.error("QR code generation failed:", error);
        res.status(500).send("QR code generation failed");
    }
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-meeting", ({ meetingId, role, name, participantRole }) => {
        const meeting = getOrCreateMeeting(meetingId);

        socket.join(meetingId);
        socket.data.meetingId = meetingId;
        socket.data.role = role;

        if (role === "participant") {
            const cleanName = typeof name === "string" ? name.trim() : "";

            if (!cleanName) return;

            const alreadyInMeeting = meeting.participants.some(
                participant => participant.socketId === socket.id
            );

            if (!alreadyInMeeting) {
                meeting.participants.push({
                    socketId: socket.id,
                    name: cleanName,
                    role: participantRole || "Andere",
                    state: "connected",
                    joinedAt: Date.now(),
                    handRaisedAt: null
                });
            }
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("raise-hand", () => {
        const meetingId = socket.data.meetingId;
        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);
        const participant = meeting.participants.find(p => p.socketId === socket.id);

        if (!participant) return;

        participant.state = "raised";
        participant.handRaisedAt = Date.now();

        if (!meeting.queue.includes(socket.id)) {
            meeting.queue.push(socket.id);
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("lower-hand", () => {
        const meetingId = socket.data.meetingId;
        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);
        const participant = meeting.participants.find(p => p.socketId === socket.id);

        if (!participant) return;

        participant.state = "connected";
        participant.handRaisedAt = null;

        meeting.queue = meeting.queue.filter(socketId => socketId !== socket.id);

        if (meeting.currentSpeaker?.socketId === socket.id) {
            meeting.currentSpeaker = null;
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("next-speaker", () => {
        const meetingId = socket.data.meetingId;
        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        if (meeting.currentSpeaker) {
            const previousSpeaker = meeting.participants.find(
                participant => participant.socketId === meeting.currentSpeaker.socketId
            );

            if (previousSpeaker) {
                previousSpeaker.state = "connected";
                previousSpeaker.handRaisedAt = null;
            }

            meeting.currentSpeaker = null;
        }

        const nextSocketId = meeting.queue.shift();

        if (!nextSocketId) {
            broadcastMeetingState(meetingId);
            return;
        }

        const nextParticipant = meeting.participants.find(
            participant => participant.socketId === nextSocketId
        );

        if (!nextParticipant) {
            broadcastMeetingState(meetingId);
            return;
        }

        nextParticipant.state = "speaking";

        meeting.currentSpeaker = {
            socketId: nextParticipant.socketId,
            name: nextParticipant.name,
            role: nextParticipant.role
        };

        broadcastMeetingState(meetingId);
    });

    socket.on("add-manual-participant", ({ name, participantRole }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);
        const cleanName = typeof name === "string" ? name.trim() : "";
        const cleanRole = typeof participantRole === "string" ? participantRole.trim() : "";

        if (!cleanName || !cleanRole) return;

        const manualParticipantId = `manual-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}`;

        meeting.participants.push({
            socketId: manualParticipantId,
            name: cleanName,
            role: cleanRole,
            state: "connected",
            joinedAt: Date.now(),
            handRaisedAt: null,
            isManual: true
        });

        broadcastMeetingState(meetingId);
    });

    socket.on("leave-meeting", () => {
        const meetingId = socket.data.meetingId;
        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        meeting.participants = meeting.participants.filter(
            participant => participant.socketId !== socket.id
        );

        meeting.queue = meeting.queue.filter(
            socketId => socketId !== socket.id
        );

        if (meeting.currentSpeaker?.socketId === socket.id) {
            meeting.currentSpeaker = null;
        }

        socket.data.role = "viewer";

        broadcastMeetingState(meetingId);
    });

    socket.on("end-meeting", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);
        meeting.ended = true;

        io.to(meetingId).emit("meeting-ended");

        delete meetings[meetingId];
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

            meeting.queue = meeting.queue.filter(
                socketId => socketId !== socket.id
            );

            if (meeting.currentSpeaker?.socketId === socket.id) {
                meeting.currentSpeaker = null;
            }
        }

        broadcastMeetingState(meetingId);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});