const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const DATA_DIR = path.join(ROOT, "data");
const TODOS_FILE = path.join(DATA_DIR, "todos.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function readTodos() {
  try {
    const text = await fs.readFile(TODOS_FILE, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeTodos(todos) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TODOS_FILE, `${JSON.stringify(todos, null, 2)}\n`);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": contentTypes[".json"] });
  response.end(JSON.stringify(data));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function getTodoId(urlPath) {
  const match = urlPath.match(/^\/api\/todos\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/todos" && request.method === "GET") {
    sendJson(response, 200, await readTodos());
    return;
  }

  if (url.pathname === "/api/todos" && request.method === "POST") {
    const body = await readJson(request);
    const title = String(body.title || "").trim();

    if (!title) {
      sendError(response, 400, "Task title is required.");
      return;
    }

    const todos = await readTodos();
    const todo = {
      id: randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.unshift(todo);
    await writeTodos(todos);
    sendJson(response, 201, todo);
    return;
  }

  if (url.pathname === "/api/todos/completed" && request.method === "DELETE") {
    const todos = await readTodos();
    const nextTodos = todos.filter((todo) => !todo.completed);
    await writeTodos(nextTodos);
    sendJson(response, 200, { deleted: todos.length - nextTodos.length });
    return;
  }

  const todoId = getTodoId(url.pathname);

  if (todoId && request.method === "PATCH") {
    const body = await readJson(request);
    const todos = await readTodos();
    const todo = todos.find((item) => item.id === todoId);

    if (!todo) {
      sendError(response, 404, "Task was not found.");
      return;
    }

    if (typeof body.completed === "boolean") {
      todo.completed = body.completed;
    }

    if (typeof body.title === "string" && body.title.trim()) {
      todo.title = body.title.trim();
    }

    await writeTodos(todos);
    sendJson(response, 200, todo);
    return;
  }

  if (todoId && request.method === "DELETE") {
    const todos = await readTodos();
    const nextTodos = todos.filter((todo) => todo.id !== todoId);

    if (nextTodos.length === todos.length) {
      sendError(response, 404, "Task was not found.");
      return;
    }

    await writeTodos(nextTodos);
    response.writeHead(204);
    response.end();
    return;
  }

  sendError(response, 404, "Not found.");
}

async function serveStatic(response, urlPath) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(FRONTEND_DIR, requestedPath));
  const relativePath = path.relative(FRONTEND_DIR, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendError(response, 403, "Forbidden.");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      const fallback = await fs.readFile(path.join(FRONTEND_DIR, "index.html"));
      response.writeHead(200, { "Content-Type": contentTypes[".html"] });
      response.end(fallback);
      return;
    }

    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Something went wrong.");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try PORT=3101 npm run dev.`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`Todo app running at http://${HOST}:${PORT}`);
});
