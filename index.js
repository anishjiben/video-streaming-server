const express = require("express");
const https = require("https");
const path = require("path");
// const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

const outputPath = path.join(__dirname, "output");

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  // res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

app.get("/video", (req, res) => {
  const range = req.headers.range;
  console.log(range);
  if (!range) {
    res.status(400).send("Requires Range header");
  }

  // get video stats (about 61MB)
  const videoPath = "640.mp4";
  const videoSize = fs.statSync("640.mp4").size;

  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range?.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});

// Generate DASH manifest and segments
app.get("/manifest.mpd", async (req, res) => {
  try {
    const manifest = await readFile(path.join(outputPath, "640_manifest.mpd"));
    res.setHeader("Content-Type", "application/dash+xml");
    res.send(manifest);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating DASH manifest");
  }
});

// Create a route to serve the media files
app.get("/segments", (req, res) => {
  // Get the filename of the media file
  const filename = req.query.filename;

  // Read the media file
  const mediaFile = fs.readFileSync(`output/${filename}`, null);

  // Set the content type of the response
  res.setHeader("Content-Type", "video/mp4");

  // Send the media file in the response
  res.send(mediaFile);
});

// Serve video segments
app.get("/video/:segmentNumber.m4s", async (req, res) => {
  try {
    const segmentNumber = parseInt(req.params.segmentNumber, 10);
    const segmentFile = path.join(outputPath, `seg-${segmentNumber}.m4s`);

    const segmentData = await readFile(segmentFile);
    res.setHeader("Content-Type", "video/mp4");
    res.send(segmentData);
  } catch (error) {
    console.error(error);
    res.status(404).send("Segment not found");
  }
});

async function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

app.listen(8000, () => {
  console.log("Listening on port 8000");
});
