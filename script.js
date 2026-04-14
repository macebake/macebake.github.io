const canvas = document.getElementById("sky-canvas");
const context = canvas.getContext("2d");
const linkStrip = document.getElementById("link-strip");
const showAllLinksCheckbox = document.getElementById("show-all-links");
const emailLink = document.getElementById("email-link");
const sourceImage = new Image();
sourceImage.src = "./assets/compressionsky.png?v=2";
const planeImage = new Image();
planeImage.src = "./assets/plane-source.webp?v=3";

const buffer = document.createElement("canvas");
const bufferContext = buffer.getContext("2d", { willReadFrequently: true });
const baseBuffer = document.createElement("canvas");
const baseBufferContext = baseBuffer.getContext("2d", { willReadFrequently: true });
const planeBuffer = document.createElement("canvas");
const planeBufferContext = planeBuffer.getContext("2d", { willReadFrequently: true });
const NAV_ITEMS = [
  { label: "🎲 die", url: "https://macey.info/die", featured: true },
  { label: "👁️ eyes", url: "https://macey.info/eyes", featured: true },
  { label: "🚪 doors", url: "https://macey.info/doors", featured: true },
  { label: "🖼️ mona", url: "https://docs.google.com/spreadsheets/d/1w0pJMozN3VxkUkayMVujJqXDNQjZL_XedOQKWH41jeQ/edit?usp=sharing", featured: true },
  { label: "🎹 piano", url: "https://macey.info/keyboard-piano", featured: true },
  { label: "🐺 wolves", url: "https://github.com/macebake/wolves", featured: false },
  { label: "⚔️ split-steal", url: "https://github.com/macebake/split-steal", featured: false },
];
const flights = [];
const FLIGHT_COUNT = NAV_ITEMS.length;
let started = false;
let lastTime = 0;
let simulationTime = 0;
let lastFrameStamp = 0;
let paused = false;
let hoveredFlightIndex = -1;
let renderedFlights = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const targetWidth = Math.max(220, Math.round(window.innerWidth / 5));
  const targetHeight = Math.max(220, Math.round(window.innerHeight / 5));
  buffer.width = targetWidth;
  buffer.height = targetHeight;
  baseBuffer.width = targetWidth;
  baseBuffer.height = targetHeight;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function choosePerimeterPoint(side) {
  if (side === "top") {
    return { x: rand(0.08, 0.92), y: -0.18 };
  }
  if (side === "right") {
    return { x: 1.18, y: rand(0.08, 0.92) };
  }
  if (side === "bottom") {
    return { x: rand(0.08, 0.92), y: 1.18 };
  }
  return { x: -0.18, y: rand(0.08, 0.92) };
}

function createFlight(index = 0) {
  const routePairs = [
    ["top", "bottom"],
    ["left", "right"],
    ["top", "right"],
    ["left", "bottom"],
    ["right", "bottom"],
    ["top", "left"],
  ];
  const [startSide, endSide] = routePairs[index % routePairs.length];
  const start = choosePerimeterPoint(startSide);
  const end = choosePerimeterPoint(endSide);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const heading = Math.atan2(dy, dx) + Math.PI / 2;
  const baseScale = rand(0.05, 0.11);
  const duration = rand(24000, 42000);
  const wobble = rand(0.002, 0.008);

  return {
    item: NAV_ITEMS[index % NAV_ITEMS.length],
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    scale: baseScale,
    duration,
    wobble,
    wobblePhase: rand(0, Math.PI * 2),
    heading,
    startedAt: lastTime + index * rand(2200, 4800),
  };
}

function ensureFlights() {
  while (flights.length < FLIGHT_COUNT) {
    flights.push(createFlight(flights.length));
  }
}

function drawSourceCover() {
  if (!sourceImage.complete || !sourceImage.naturalWidth) {
    return false;
  }

  baseBufferContext.clearRect(0, 0, baseBuffer.width, baseBuffer.height);
  baseBufferContext.drawImage(
    sourceImage,
    0,
    0,
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    0,
    0,
    baseBuffer.width,
    baseBuffer.height
  );
  bufferContext.clearRect(0, 0, buffer.width, buffer.height);
  bufferContext.drawImage(baseBuffer, 0, 0);
  return true;
}

function preparePlaneBuffer() {
  if (!planeImage.complete || !planeImage.naturalWidth) {
    return false;
  }

  planeBuffer.width = planeImage.naturalWidth;
  planeBuffer.height = planeImage.naturalHeight;
  planeBufferContext.clearRect(0, 0, planeBuffer.width, planeBuffer.height);
  planeBufferContext.drawImage(planeImage, 0, 0);

  const image = planeBufferContext.getImageData(0, 0, planeBuffer.width, planeBuffer.height);
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;

    if (brightness > 246) {
      data[i + 3] = 0;
      continue;
    }

    data[i] = Math.round((r + 10) / 18) * 18;
    data[i + 1] = Math.round((g + 8) / 18) * 18;
    data[i + 2] = Math.round((b + 12) / 20) * 20;

    data[i] = Math.min(255, data[i] + 16);
    data[i + 1] = Math.min(255, data[i + 1] + 10);
    data[i + 2] = Math.min(255, data[i + 2] + 20);
  }

  planeBufferContext.putImageData(image, 0, 0);
  return true;
}

function drawPlanes(time) {
  if (!preparePlaneBuffer()) {
    return;
  }

  ensureFlights();
  renderedFlights = [];

  flights.forEach((flight, index) => {
    const elapsed = time - flight.startedAt;
    if (elapsed < 0) {
      return;
    }

    const progress = elapsed / flight.duration;
    const t = Math.max(0, Math.min(1, progress));
    const xNorm = flight.startX + (flight.endX - flight.startX) * t;
    const yNorm = flight.startY + (flight.endY - flight.startY) * t;
    const perpX = -Math.sin(flight.heading - Math.PI / 2);
    const perpY = Math.cos(flight.heading - Math.PI / 2);
    const wobble = Math.sin(time * 0.00022 + flight.wobblePhase) * flight.wobble;
    const x = (xNorm + perpX * wobble) * buffer.width;
    const y = (yNorm + perpY * wobble) * buffer.height;

    const perspectiveScale = 1 - Math.max(0, yNorm - 0.18) * 0.55;
    const planeWidth = buffer.width * flight.scale * perspectiveScale;
    const planeHeight = planeWidth * (planeBuffer.height / planeBuffer.width);

    bufferContext.save();
    bufferContext.translate(x, y);
    bufferContext.rotate(flight.heading + Math.sin(time * 0.00016 + flight.wobblePhase) * 0.03);

    bufferContext.globalAlpha = 1;
    bufferContext.drawImage(
      planeBuffer,
      -planeWidth * 0.5,
      -planeHeight * 0.5,
      planeWidth,
      planeHeight
    );

    bufferContext.globalAlpha = 0.28;
    bufferContext.globalCompositeOperation = "screen";
    bufferContext.drawImage(
      planeBuffer,
      -planeWidth * 0.46,
      -planeHeight * 0.49,
      planeWidth,
      planeHeight
    );

    bufferContext.globalCompositeOperation = "source-over";

    bufferContext.restore();

    renderedFlights.push({
      index,
      url: flight.item.url,
      bounds: {
        left: x - planeWidth * 0.5,
        right: x + planeWidth * 0.5,
        top: y - planeHeight * 0.5,
        bottom: y + planeHeight * 0.5,
      },
    });

    if (progress >= 1) {
      flights[index] = createFlight(index);
      flights[index].startedAt = time + rand(1200, 5000);
    }
  });
}

function redrawForegroundTree() {
  const width = buffer.width;
  const height = buffer.height;
  const sourceImageData = baseBufferContext.getImageData(0, 0, width, height);
  const outputImageData = bufferContext.getImageData(0, 0, width, height);
  const source = sourceImageData.data;
  const output = outputImageData.data;

  for (let y = Math.floor(height * 0.68); y < height; y += 1) {
    for (let x = Math.floor(width * 0.7); x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = source[index];
      const g = source[index + 1];
      const b = source[index + 2];
      const brightness = (r + g + b) / 3;
      const greenDominant = g > r * 0.8 && g > b * 0.85;

      if (greenDominant && brightness < 135) {
        output[index] = source[index];
        output[index + 1] = source[index + 1];
        output[index + 2] = source[index + 2];
        output[index + 3] = 255;
      }
    }
  }

  bufferContext.putImageData(outputImageData, 0, 0);
}

function renderSky(time) {
  lastTime = time;
  if (!drawSourceCover()) {
    return;
  }

  drawPlanes(time);
  redrawForegroundTree();

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}

function animate(time) {
  if (!lastFrameStamp) {
    lastFrameStamp = time;
  }

  if (!paused) {
    simulationTime += time - lastFrameStamp;
  }
  lastFrameStamp = time;

  renderSky(simulationTime);

  requestAnimationFrame(animate);
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * buffer.width,
    y: ((event.clientY - rect.top) / rect.height) * buffer.height,
  };
}

function hitFlight(point) {
  return renderedFlights.find((flight) => (
    point.x >= flight.bounds.left &&
    point.x <= flight.bounds.right &&
    point.y >= flight.bounds.top &&
    point.y <= flight.bounds.bottom
  ));
}

function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  document.querySelectorAll(".timestamp").forEach((el) => {
    el.textContent = `[${hours}:${minutes}]`;
  });
}

function showTypingIndicator(duration = 1000) {
  const typingIndicator = document.getElementById("typing-indicator");
  typingIndicator.classList.add("visible");
  window.setTimeout(() => {
    typingIndicator.classList.remove("visible");
  }, duration);
}

function initializeChat() {
  updateTime();
  window.setInterval(updateTime, 60000 * 5);

  const messages = document.querySelectorAll(".chat-line");
  const cursors = document.querySelectorAll(".cursor");
  cursors.forEach((cursor, index) => {
    if (index > 0) {
      cursor.style.display = "none";
    }
  });

  const delays = [2000, 3000, 4000, 6000];
  const randomDelay = delays[Math.floor(Math.random() * delays.length)];

  messages.forEach((message, index) => {
    if (index === 0) {
      return;
    }

    window.setTimeout(() => {
      showTypingIndicator(900);
      window.setTimeout(() => {
        document.getElementById("typing-indicator").classList.remove("visible");
        cursors[index - 1].style.display = "none";
        message.classList.add("visible");
        cursors[index].style.display = "inline-block";
      }, 1000);
    }, index * randomDelay);
  });

  window.setTimeout(() => {
    window.setInterval(() => {
      showTypingIndicator(900);
    }, Math.random() * 8000 + 5000);
  }, messages.length * randomDelay);
}

function renderLinks() {
  const showAll = showAllLinksCheckbox.checked;
  const linksToShow = showAll ? NAV_ITEMS : [];
  linkStrip.innerHTML = "";

  linksToShow.forEach((item) => {
    const anchor = document.createElement("a");
    anchor.href = item.url;
    anchor.textContent = item.label;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    linkStrip.appendChild(anchor);
  });
}

function copyEmail(event) {
  event.preventDefault();
  navigator.clipboard.writeText("macebake@gmail.com");
}

function startIfReady() {
  if (started || !sourceImage.complete || !planeImage.complete) {
    return;
  }
  started = true;
  resizeCanvas();
  requestAnimationFrame(animate);
}

sourceImage.addEventListener("load", startIfReady);
planeImage.addEventListener("load", startIfReady);

resizeCanvas();
startIfReady();
window.addEventListener("resize", resizeCanvas);
initializeChat();
renderLinks();
showAllLinksCheckbox.addEventListener("change", renderLinks);
emailLink.addEventListener("click", copyEmail);
canvas.addEventListener("mousemove", (event) => {
  const target = hitFlight(getCanvasPoint(event));
  hoveredFlightIndex = target ? target.index : -1;
  paused = hoveredFlightIndex !== -1;
  canvas.style.cursor = target ? "pointer" : "default";
});
canvas.addEventListener("mouseleave", () => {
  hoveredFlightIndex = -1;
  paused = false;
  canvas.style.cursor = "default";
});
canvas.addEventListener("click", (event) => {
  const target = hitFlight(getCanvasPoint(event));
  if (target) {
    window.open(target.url, "_blank", "noopener,noreferrer");
  }
});
