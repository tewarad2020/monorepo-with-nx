package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

type Todo struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

type todoStore struct {
	mu   sync.Mutex
	path string
}

// The caller holds mu across the whole read-modify-write operation.
func (s *todoStore) read() ([]Todo, error) {
	file, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return []Todo{}, nil
		}
		return nil, err
	}
	todos := []Todo{}
	if err := json.Unmarshal(file, &todos); err != nil {
		return nil, err
	}
	if todos == nil {
		todos = []Todo{}
	}
	return todos, nil
}

func (s *todoStore) write(todos []Todo) error {
	data, err := json.MarshalIndent(todos, "", "  ")
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(s.path), ".todos-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), s.path)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}

func newHandler(path string) http.Handler {
	store := &todoStore{path: path}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/todos", func(w http.ResponseWriter, r *http.Request) {
		store.mu.Lock()
		defer store.mu.Unlock()
		todos, err := store.read()
		if err != nil {
			http.Error(w, "Unable to read tasks", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, todos)
	})

	mux.HandleFunc("POST /api/todos", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Title string `json:"title"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
		if err := decoder.Decode(&input); err != nil {
			http.Error(w, "Invalid JSON body", http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			http.Error(w, "Expected a single JSON object", http.StatusBadRequest)
			return
		}
		input.Title = strings.TrimSpace(input.Title)
		if input.Title == "" {
			http.Error(w, "Task title is required", http.StatusBadRequest)
			return
		}
		store.mu.Lock()
		defer store.mu.Unlock()
		todos, err := store.read()
		if err != nil {
			http.Error(w, "Unable to read tasks", http.StatusInternalServerError)
			return
		}
		id := 1
		for _, todo := range todos {
			if todo.ID >= id {
				id = todo.ID + 1
			}
		}
		todo := Todo{ID: id, Title: input.Title}
		if err := store.write(append(todos, todo)); err != nil {
			http.Error(w, "Unable to save task", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, todo)
	})

	mux.HandleFunc("DELETE /api/todos/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil || id <= 0 {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}
		store.mu.Lock()
		defer store.mu.Unlock()
		todos, err := store.read()
		if err != nil {
			http.Error(w, "Unable to read tasks", http.StatusInternalServerError)
			return
		}
		for i, todo := range todos {
			if todo.ID != id {
				continue
			}
			if err := store.write(append(todos[:i], todos[i+1:]...)); err != nil {
				http.Error(w, "Unable to delete task", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Error(w, "Task not found", http.StatusNotFound)
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func main() {
	log.Println("Go Backend running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", newHandler("data.json")))
}
