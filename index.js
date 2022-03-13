const socketio = require("socket.io");
const { createServer } = require("http");
const express = require("express");
const cors = require("cors");

const allowedList = require("./allowedList");

const app = express();

const server = createServer(app);

const users = {};
const drawing = {};
const sockets = {};

const io = socketio(server, {
  cors: {
    origin: (origin, fn) => {
      if (allowedList.indexOf(origin) !== -1) return fn(null, origin);
      return fn("Error Invalid domain");
    },
    methods: ["GET", "POST"],
  },
  //   allowEIO3: true,
});

app.use(cors());
app.options("*", cors());

io.on("connection", (socket) => {
  socket.on("join-drawing", ({ drawingId, name, color }) => {
    socket.join(drawingId);
    if (!users[drawingId]) {
      users[drawingId] = {};
    } else {
      users[drawingId][color] = { name, color };
    }
    sockets[socket.id] = { drawingId, color };
    socket.to(drawingId).emit("joined-users", {
      users: users[drawingId],
    });
    io.to(socket.id).emit("joined-drawing", {
      users: users[drawingId],
      drawing: drawing[drawingId] || [],
    });
  });

  socket.on("leave-drawing", () => {
    const canvasInfo = sockets[socket.id] || {};
    if (canvasInfo.drawingId && canvasInfo.color) {
      delete users[canvasInfo.drawingId][canvasInfo.color];
      socket
        .to(canvasInfo.drawingId)
        .emit("left-drawing", users[canvasInfo.drawingId]);
      socket.leave(canvasInfo.drawingId);
    }
  });

  socket.on("disconnect", () => {
    const canvasInfo = sockets[socket.id] || {};
    if (canvasInfo.drawingId && canvasInfo.color) {
      delete users[canvasInfo.drawingId][canvasInfo.color];
      socket
        .to(canvasInfo.drawingId)
        .emit("left-drawing", users[canvasInfo.drawingId]);
      socket.leave(canvasInfo.drawingId);
    }
  });

  socket.on("input-canvas", ({ drawingId, msg }) => {
    if (!drawing[drawingId]) {
      drawing[drawingId] = [];
    } else {
      drawing[drawingId].push(msg);
    }
    socket.to(drawingId).emit("update-canvas", msg);
    console.log(drawing, users);
  });

  socket.on("update-canvas", ({ drawingId, msg }) => {
    drawing[drawingId] = msg;
  });

  socket.on("input-control", ({ drawingId, type }) => {
    socket.to(drawingId).emit("update-control", type);
  });
});

server.listen(process.env.PORT || 4000, () => {
  console.log(`Listening to PORT ${process.env.PORT || 4000}`);
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});

process.once("SIGHUP", function () {
  process.kill(process.pid, "SIGHUP");
});
