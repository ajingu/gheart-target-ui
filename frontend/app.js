const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const list = document.querySelector("#todo-list");
const summary = document.querySelector("#summary");
const emptyState = document.querySelector("#empty-state");
const filterButtons = Array.from(document.querySelectorAll(".filter-button"));

let todos = [];
let currentFilter = "all";

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(error.error || "Request failed.");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function visibleTodos() {
  if (currentFilter === "active") {
    return todos.filter((todo) => !todo.completed);
  }

  if (currentFilter === "completed") {
    return todos.filter((todo) => todo.completed);
  }

  return todos;
}

function render() {
  const activeCount = todos.filter((todo) => !todo.completed).length;
  const filteredTodos = visibleTodos();

  summary.textContent = `${activeCount} left`;
  emptyState.hidden = filteredTodos.length > 0;
  list.innerHTML = "";

  for (const todo of filteredTodos) {
    const item = document.createElement("li");
    item.className = todo.completed ? "todo-item completed" : "todo-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `Mark ${todo.title} as ${todo.completed ? "active" : "done"}`);
    checkbox.addEventListener("change", () => toggleTodo(todo));

    const title = document.createElement("span");
    title.textContent = todo.title;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTodo(todo));

    item.append(checkbox, title, deleteButton);
    list.append(item);
  }
}

async function loadTodos() {
  todos = await requestJson("/api/todos");
  render();
}

async function addTodo(title) {
  const todo = await requestJson("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

  todos = [todo, ...todos];
  render();
}

async function toggleTodo(todo) {
  const updatedTodo = await requestJson(`/api/todos/${todo.id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: !todo.completed }),
  });

  todos = todos.map((item) => (item.id === updatedTodo.id ? updatedTodo : item));
  render();
}

async function deleteTodo(todo) {
  await requestJson(`/api/todos/${todo.id}`, { method: "DELETE" });
  todos = todos.filter((item) => item.id !== todo.id);
  render();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }

  input.value = "";
  await addTodo(title);
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });

    render();
  });
});

loadTodos().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
