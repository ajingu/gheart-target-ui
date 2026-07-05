const { spawn } = require("child_process");

const port = 3910;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["backend/server.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start in time.")), 5000);

    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Todo app running")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    server.on("exit", (code) => {
      reject(new Error(`Server exited before tests completed with code ${code}.`));
    });
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function run() {
  await waitForServer();

  const created = await request("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title: "Smoke test task" }),
  });

  if (!created.id || created.completed !== false) {
    throw new Error("Created todo did not include the expected fields.");
  }

  const updated = await request(`/api/todos/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });

  if (updated.completed !== true) {
    throw new Error("Todo completion did not persist.");
  }

  await request(`/api/todos/${created.id}`, { method: "DELETE" });
  console.log("Smoke tests passed.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
  });
