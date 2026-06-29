const express = require("express");
const path = require("path");
const http = require("http");
const QRCode = require("qrcode");
const { Server } = require("socket.io");
const crypto = require("crypto");


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

function generateModeratorPassword() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateModeratorKey() {
    return Math.random().toString(36).substring(2, 14);
}

function generateCreatorToken() {
    return Math.random().toString(36).substring(2, 18);
}

function generateModeratorSessionToken() {
    return Math.random().toString(36).substring(2, 24);
}

function createAgendaItem(title, targetMinutes = null) {
    return {
        id: crypto.randomUUID(),
        title,
        targetMinutes,
        createdAt: Date.now()
    };
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
            currentSpeakerStartedAt: Date.now(),
            speakerLog: [],
            agenda: [],
            currentAgendaIndex: null,
            currentAgendaStartedAt: null,
            agendaLog: [],
            hosts: [],
            speakerLimitMinutes: null,
            moderatorPassword: generateModeratorPassword(),
            moderatorKey: generateModeratorKey(),
            creatorToken: generateCreatorToken(),
            moderatorSessions: [],
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
        moderatorCount: meeting.hosts.length,
        agenda: meeting.agenda,
        currentAgendaIndex: meeting.currentAgendaIndex,
        currentAgendaStartedAt: meeting.currentAgendaStartedAt,
        speakerLimitMinutes: meeting.speakerLimitMinutes,
        currentSpeakerStartedAt: meeting.currentSpeakerStartedAt,
        moderatorPassword: meeting.moderatorPassword,
        moderatorKey: meeting.moderatorKey,
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
    const meetingName = req.body.meetingName?.trim();

    if (!meetingName) {
        return res.redirect("/?error=missing-meeting-name");
    }

    const meeting = getOrCreateMeeting(meetingId, meetingName);

    let submittedAgenda = [];

    if (req.body.agenda) {
        try {
            submittedAgenda = JSON.parse(req.body.agenda);
        } catch (error) {
            submittedAgenda = [];
        }
    }

    meeting.agenda = submittedAgenda
        .filter(item => item.title && item.title.trim())
        .map(item =>
            createAgendaItem(
                item.title.trim(),
                item.targetMinutes ? Number(item.targetMinutes) : null
            )
        );

    if (meeting.agenda.length > 0) {
        meeting.currentAgendaIndex = 0;
        meeting.currentAgendaStartedAt = Date.now();
    }

    res.redirect(`/host/${meetingId}?key=${meeting.moderatorKey}&creator=${meeting.creatorToken}`);
});

app.post("/join-participant", (req, res) => {
    const meetingId = req.body.meetingId?.trim().toUpperCase();

    if (!meetingId || !meetings[meetingId]) {
        return res.redirect("/?error=meeting-not-found");
    }

    res.redirect(`/join/${meetingId}`);
});

app.post("/join-moderator", (req, res) => {
    const meetingId = req.body.meetingId?.trim().toUpperCase();
    const moderatorPassword = req.body.moderatorPassword?.trim().toUpperCase();

    if (!meetingId || !moderatorPassword) {
        return res.redirect("/?error=missing-moderator-details");
    }

    const meeting = meetings[meetingId];

    if (!meeting || moderatorPassword !== meeting.moderatorPassword) {
        return res.redirect("/?error=invalid-moderator-login");
    }

    const sessionToken = generateModeratorSessionToken();
    meeting.moderatorSessions.push(sessionToken);

    res.redirect(
        `/host/${meetingId}?key=${meeting.moderatorKey}&session=${sessionToken}`
    );
});

app.get("/host/:meetingId", (req, res) => {
    const meetingId = req.params.meetingId;
    const suppliedKey = req.query.key;

    const meeting = meetings[meetingId];

    if (!meeting || suppliedKey !== meeting.moderatorKey) {
        return res.redirect("/?error=invalid-moderator-link");
    }

    res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/join/:meetingId", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "participant.html"));
});

app.get("/qr/:meetingId", async (req, res) => {
    const meetingId = req.params.meetingId;
    const type = req.query.type === "cohost" ? "cohost" : "participant";

    const meeting = meetings[meetingId];

    const sharePath =
        type === "cohost" && meeting
            ? `/host/${meetingId}?key=${meeting.moderatorKey}`
            : `/join/${meetingId}`;

    const shareUrl = `${req.protocol}://${req.get("host")}${sharePath}`;

    try {
        const qrPng = await QRCode.toBuffer(shareUrl, {
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

function closeCurrentSpeakerLog(meeting) {
    if (!meeting.currentSpeaker || !meeting.currentSpeakerStartedAt) return;

    const endedAt = Date.now();

    meeting.speakerLog.push({
        name: meeting.currentSpeaker.name,
        role: meeting.currentSpeaker.role,
        startedAt: meeting.currentSpeakerStartedAt,
        endedAt,
        durationSeconds: Math.round(
            (endedAt - meeting.currentSpeakerStartedAt) / 1000
        )
    });
}

function closeCurrentAgendaLog(meeting) {
    if (
        meeting.currentAgendaIndex === null ||
        !meeting.currentAgendaStartedAt ||
        !meeting.agenda[meeting.currentAgendaIndex]
    ) {
        return;
    }

    const endedAt = Date.now();
    const agendaItem = meeting.agenda[meeting.currentAgendaIndex];

    meeting.agendaLog.push({
        agendaItemId: agendaItem.id,
        title: agendaItem.title,
        startedAt: meeting.currentAgendaStartedAt,
        endedAt,
        durationSeconds: Math.round(
            (endedAt - meeting.currentAgendaStartedAt) / 1000
        )
    });
}

function startAgendaItem(meeting, index) {
    if (!meeting.agenda[index]) return;

    closeCurrentAgendaLog(meeting);

    meeting.currentAgendaIndex = index;
    meeting.currentAgendaStartedAt = Date.now();
}

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-moderator", (
        { meetingId, moderatorKey, moderatorPassword, creatorToken, sessionToken },
        callback
    ) => {
        const meeting = meetings[meetingId];

        if (!meeting) {
            callback?.({ ok: false, message: "Meeting not found." });
            return;
        }

        const validKey = moderatorKey === meeting.moderatorKey;
        const validPassword = moderatorPassword === meeting.moderatorPassword;
        const validCreatorToken = creatorToken === meeting.creatorToken;
        const validSessionToken =
            typeof sessionToken === "string" &&
            meeting.moderatorSessions.includes(sessionToken);

        if (!validKey || (!validPassword && !validCreatorToken && !validSessionToken)) {
            callback?.({ ok: false, message: "Invalid moderator credentials." });
            return;
        }

        let newSessionToken = sessionToken;

        if (!validSessionToken) {
            newSessionToken = generateModeratorSessionToken();
            meeting.moderatorSessions.push(newSessionToken);
        }

        socket.join(meetingId);
        socket.data.meetingId = meetingId;
        socket.data.role = "host";

        if (!meeting.hosts.includes(socket.id)) {
            meeting.hosts.push(socket.id);
        }

        callback?.({
            ok: true,
            sessionToken: newSessionToken
        });

        broadcastMeetingState(meetingId);
    });

    socket.on("join-meeting", ({ meetingId, role, name, participantRole }) => {
        const meeting = getOrCreateMeeting(meetingId);
        if (role === "host") return;

        socket.join(meetingId);
        socket.data.meetingId = meetingId;
        socket.data.role = role;
        if (role === "host" && !meeting.hosts.includes(socket.id)) {
            meeting.hosts.push(socket.id);
        }

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
                    role: participantRole || "Gast/Guest",
                    state: "connected",
                    joinedAt: Date.now(),
                    handRaisedAt: null
                });
            }
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("set-agenda", ({ agenda }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = meetings[meetingId];
        if (!meeting) return;

        closeCurrentAgendaLog(meeting);

        meeting.agenda = (agenda || [])
            .filter(item => item.title && item.title.trim())
            .map(item =>
                createAgendaItem(
                    item.title.trim(),
                    item.targetMinutes ? Number(item.targetMinutes) : null
                )
            );

        meeting.currentAgendaIndex =
            meeting.agenda.length > 0 ? 0 : null;

        meeting.currentAgendaStartedAt =
            meeting.agenda.length > 0 ? Date.now() : null;

        broadcastMeetingState(meetingId);
    });

    socket.on("next-agenda-item", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);

        if (
            meeting.currentAgendaIndex === null ||
            meeting.currentAgendaIndex >= meeting.agenda.length - 1
        ) {
            return;
        }

        startAgendaItem(meeting, meeting.currentAgendaIndex + 1);
        broadcastMeetingState(meetingId);
    });

    socket.on("previous-agenda-item", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);

        if (
            meeting.currentAgendaIndex === null ||
            meeting.currentAgendaIndex <= 0
        ) {
            return;
        }

        startAgendaItem(meeting, meeting.currentAgendaIndex - 1);
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
            closeCurrentSpeakerLog(meeting);
            meeting.currentSpeaker = null;
            meeting.currentSpeakerStartedAt = Date.now();
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("next-speaker", () => {
        const meetingId = socket.data.meetingId;
        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        if (meeting.currentSpeaker) {
            closeCurrentSpeakerLog(meeting);

            const previousSpeaker = meeting.participants.find(
                participant => participant.socketId === meeting.currentSpeaker.socketId
            );

            if (previousSpeaker) {
                previousSpeaker.state = "connected";
                previousSpeaker.handRaisedAt = null;
            }

            meeting.currentSpeaker = null;
            meeting.currentSpeakerStartedAt = Date.now();
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

        meeting.currentSpeakerStartedAt = Date.now();

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

    socket.on("set-speaker-limit", ({ minutes }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);

        const allowedLimits = [null, 1, 2, 3, 5, 10, 15];

        const parsedMinutes =
            minutes === null ? null : Number(minutes);

        if (!allowedLimits.includes(parsedMinutes)) return;

        meeting.speakerLimitMinutes = parsedMinutes;

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
            closeCurrentSpeakerLog(meeting);
            meeting.currentSpeaker = null;
            meeting.currentSpeakerStartedAt = Date.now();
        }

        socket.data.role = "viewer";

        broadcastMeetingState(meetingId);
    });

    socket.on("leave-dashboard", () => {
        const meetingId = socket.data.meetingId;

        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        meeting.hosts = meeting.hosts.filter(
            hostSocketId => hostSocketId !== socket.id
        );

        socket.leave(meetingId);

        socket.data.role = "viewer";
        socket.data.meetingId = null;

        broadcastMeetingState(meetingId);
    });

    socket.on("end-meeting", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);

        if (meeting.currentSpeaker) {
            closeCurrentSpeakerLog(meeting);
        }

        meeting.ended = true;

        io.to(meetingId).emit("meeting-ended");

        delete meetings[meetingId];
    });

    socket.on("queue-participant", ({ participantId }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);
        const participant = meeting.participants.find(
            participant => participant.socketId === participantId
        );

        if (!participant) return;

        participant.state = "raised";
        participant.handRaisedAt = Date.now();

        if (!meeting.queue.includes(participantId)) {
            meeting.queue.push(participantId);
        }

        broadcastMeetingState(meetingId);
    });

    socket.on("reorder-queue", ({ orderedParticipantIds }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;
        if (!Array.isArray(orderedParticipantIds)) return;

        const meeting = getOrCreateMeeting(meetingId);

        const validQueuedIds = new Set(meeting.queue);

        const reorderedQueue = orderedParticipantIds.filter(
            participantId => validQueuedIds.has(participantId)
        );

        if (reorderedQueue.length !== meeting.queue.length) {
            return;
        }

        meeting.queue = reorderedQueue;

        broadcastMeetingState(meetingId);
    });

    socket.on("remove-from-queue", ({ participantId }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);
        const participant = meeting.participants.find(
            participant => participant.socketId === participantId
        );

        if (!participant) return;

        participant.state = "connected";
        participant.handRaisedAt = null;

        meeting.queue = meeting.queue.filter(
            socketId => socketId !== participantId
        );

        broadcastMeetingState(meetingId);
    });

    socket.on("remove-participant", ({ participantId }) => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId || role !== "host") return;

        const meeting = getOrCreateMeeting(meetingId);

        meeting.participants = meeting.participants.filter(
            participant => participant.socketId !== participantId
        );

        meeting.queue = meeting.queue.filter(
            socketId => socketId !== participantId
        );

        if (meeting.currentSpeaker?.socketId === participantId) {
            closeCurrentSpeakerLog(meeting);
            meeting.currentSpeaker = null;
            meeting.currentSpeakerStartedAt = Date.now();
        }

        io.to(participantId).emit("removed-from-meeting");

        broadcastMeetingState(meetingId);
    });

    socket.on("disconnect", () => {
        const meetingId = socket.data.meetingId;
        const role = socket.data.role;

        if (!meetingId) return;

        const meeting = getOrCreateMeeting(meetingId);

        if (role === "host") {
            meeting.hosts = meeting.hosts.filter(
                hostSocketId => hostSocketId !== socket.id
            );
        }

        if (role === "participant") {
            meeting.participants = meeting.participants.filter(
                participant => participant.socketId !== socket.id
            );

            meeting.queue = meeting.queue.filter(
                socketId => socketId !== socket.id
            );

        if (meeting.currentSpeaker?.socketId === socket.id) {
            closeCurrentSpeakerLog(meeting);
            meeting.currentSpeaker = null;
            meeting.currentSpeakerStartedAt = Date.now();
        }
        }

        broadcastMeetingState(meetingId);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});