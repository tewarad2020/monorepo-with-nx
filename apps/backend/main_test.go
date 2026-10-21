package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func request(handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
	return w
}

func TestTaskLifecycle(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.json")
	h := newHandler(path)
	if w := request(h, "GET", "/api/todos", ""); w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatalf("empty list: %d %s", w.Code, w.Body)
	}
	for i := 1; i <= 3; i++ {
		w := request(h, "POST", "/api/todos", fmt.Sprintf(`{"title":" Task %d "}`, i))
		var todo Todo
		if err := json.Unmarshal(w.Body.Bytes(), &todo); err != nil || w.Code != 201 || todo.ID != i || todo.Title != fmt.Sprintf("Task %d", i) {
			t.Fatalf("create: %d %s", w.Code, w.Body)
		}
	}
	if w := request(h, "DELETE", "/api/todos/2", ""); w.Code != 204 {
		t.Fatalf("delete: %d %s", w.Code, w.Body)
	}
	w := request(h, "POST", "/api/todos", `{"title":"Task 4"}`)
	var created Todo
	json.Unmarshal(w.Body.Bytes(), &created)
	if w.Code != 201 || created.ID != 4 {
		t.Fatalf("ID collision: %s", w.Body)
	}
	// A new handler must see the persisted data, not just in-memory state.
	w = request(newHandler(path), "GET", "/api/todos", "")
	var todos []Todo
	if err := json.Unmarshal(w.Body.Bytes(), &todos); err != nil || len(todos) != 3 || todos[1].ID != 3 {
		t.Fatalf("persisted list: %s", w.Body)
	}
	for _, id := range []int{1, 3, 4} {
		request(h, "DELETE", fmt.Sprintf("/api/todos/%d", id), "")
	}
	if w := request(h, "GET", "/api/todos", ""); strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatalf("last delete should produce []: %s", w.Body)
	}
}

func TestInvalidRequests(t *testing.T) {
	h := newHandler(filepath.Join(t.TempDir(), "data.json"))
	for _, body := range []string{`{`, `null`, `{}`, `{"title":"  "}`, `{"title":1}`, `{"title":"x"} {}`} {
		if w := request(h, "POST", "/api/todos", body); w.Code != 400 {
			t.Errorf("body %s: %d", body, w.Code)
		}
	}
	for _, id := range []string{"abc", "0", "-1"} {
		if w := request(h, "DELETE", "/api/todos/"+id, ""); w.Code != 400 {
			t.Errorf("id %s: %d", id, w.Code)
		}
	}
	if w := request(h, "DELETE", "/api/todos/99", ""); w.Code != 404 {
		t.Errorf("missing ID: %d", w.Code)
	}
	for _, path := range []string{"/api/todos", "/api/todos/1"} {
		w := request(h, "OPTIONS", path, "")
		if w.Code != 204 || w.Header().Get("Access-Control-Allow-Origin") != "*" || !strings.Contains(w.Header().Get("Access-Control-Allow-Methods"), "DELETE") {
			t.Errorf("preflight: %d %v", w.Code, w.Header())
		}
	}
}

func TestStorageErrors(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.json")
	if err := os.WriteFile(path, []byte("invalid"), 0600); err != nil {
		t.Fatal(err)
	}
	h := newHandler(path)
	for _, method := range []string{"GET", "POST", "DELETE"} {
		url := "/api/todos"
		if method == "DELETE" {
			url += "/1"
		}
		if w := request(h, method, url, `{"title":"x"}`); w.Code != 500 {
			t.Errorf("corrupt file %s: %d", method, w.Code)
		}
	}
	h = newHandler(filepath.Join(t.TempDir(), "missing", "data.json"))
	if w := request(h, "POST", "/api/todos", `{"title":"x"}`); w.Code != 500 {
		t.Errorf("write error: %d", w.Code)
	}
}

func TestConcurrentCreates(t *testing.T) {
	h := newHandler(filepath.Join(t.TempDir(), "data.json"))
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if w := request(h, "POST", "/api/todos", `{"title":"Concurrent"}`); w.Code != 201 {
				t.Errorf("create: %d", w.Code)
			}
		}()
	}
	wg.Wait()
	w := request(h, "GET", "/api/todos", "")
	var todos []Todo
	if err := json.Unmarshal(w.Body.Bytes(), &todos); err != nil || len(todos) != 20 {
		t.Fatalf("lost tasks: %s", w.Body)
	}
	ids := map[int]bool{}
	for _, todo := range todos {
		if ids[todo.ID] {
			t.Fatalf("duplicate ID %d", todo.ID)
		}
		ids[todo.ID] = true
	}
}
