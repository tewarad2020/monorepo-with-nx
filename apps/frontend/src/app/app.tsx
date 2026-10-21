import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import styles from './app.module.css';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

type Theme = 'light' | 'dark' | 'ocean';
const themeStorageKey = 'frontend-theme';
const themes: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'โหมดสว่าง', icon: '☀' },
  { value: 'dark', label: 'โหมดมืด', icon: '☾' },
  { value: 'ocean', label: 'Ocean', icon: '≈' },
];

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'ocean') return savedTheme;
  } catch {
    // Keep theme switching available when browser storage is blocked.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const query = search.trim().toLocaleLowerCase();
  const visibleTodos = todos.filter((todo) => todo.title.toLocaleLowerCase().includes(query));

  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The current theme still works without persistent storage.
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/todos', { signal: controller.signal })
      .then(checkResponse)
      .then((response) => response.json())
      .then((data: Todo[] | null) => {
        if (!controller.signal.aborted) setTodos(data ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('โหลดรายการไม่สำเร็จ กรุณาตรวจสอบว่า backend กำลังทำงาน');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  const addTodo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || saving || loading) return;
    setSaving(true);
    setError('');
    try {
      const response = await checkResponse(await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      }));
      const todo: Todo = await response.json();
      setTodos((current) => [...current, todo]);
      setTitle('');
    } catch {
      setError('เพิ่ม task ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const deleteTodo = async (id: number) => {
    setDeleting((current) => [...current, id]);
    setError('');
    try {
      await checkResponse(await fetch(`/api/todos/${id}`, { method: 'DELETE' }));
      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch {
      setError('ลบ task ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeleting((current) => current.filter((value) => value !== id));
    }
  };

  return (
    <main className={styles.page} data-theme={theme}>
      <section className={styles.card} aria-labelledby="task-heading">
        <div className={styles.toolbar}>
          <p className={styles.eyebrow}>REACT + GO</p>
          <div className={styles.themeOptions} role="group" aria-label="เลือกธีม">
            {themes.map((option) => (
              <button key={option.value} type="button" className={styles.themeToggle}
                aria-pressed={theme === option.value} onClick={() => setTheme(option.value)}>
                <span aria-hidden="true">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <h1 id="task-heading">รายการ Tasks</h1>
        <p className={styles.subtitle}>เพิ่มงานใหม่หรือลบงานที่ไม่ต้องการ</p>
        <form onSubmit={addTodo} className={styles.form}>
          <input
            type="text"
            aria-label="ชื่อ task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เพิ่ม task ใหม่..."
            disabled={saving || loading}
          />
          <button type="submit" disabled={saving || loading || !title.trim()}>
            {saving ? 'กำลังเพิ่ม...' : 'เพิ่ม task'}
          </button>
        </form>
        {error && <div role="alert" className={styles.error}>
          {error}
          <button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)}>โหลดใหม่</button>
        </div>}
        {loading ? <p role="status">กำลังโหลด...</p> : <>
          <div className={styles.search}>
            <label htmlFor="task-search">ค้นหา Tasks</label>
            <div className={styles.searchControls}>
              <input id="task-search" type="search" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="พิมพ์ชื่อ task ที่ต้องการค้นหา..." />
              {search && <button type="button" onClick={() => setSearch('')}>ล้างการค้นหา</button>}
            </div>
          </div>
          <p className={styles.count} role="status">
            {query ? `พบ ${visibleTodos.length} จาก ${todos.length} tasks` : `${todos.length} tasks`}
          </p>
          {todos.length === 0 ? <p className={styles.empty}>ยังไม่มี task เริ่มเพิ่มงานแรกได้เลย</p> : visibleTodos.length === 0 ? (
            <p className={styles.empty}>ไม่พบ task ที่ตรงกับการค้นหา</p>
          ) : (
            <ul className={styles.list}>
              {visibleTodos.map((todo) => (
                <li key={todo.id}>
                  <span>{todo.title}</span>
                  <button type="button" className={styles.delete}
                    aria-label={`ลบ ${todo.title}`} disabled={deleting.includes(todo.id)}
                    onClick={() => deleteTodo(todo.id)}>
                    {deleting.includes(todo.id) ? 'กำลังลบ...' : 'ลบ'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>}
      </section>
    </main>
  );
}

async function checkResponse(response: Response) {
  if (!response.ok) throw new Error('Request failed');
  return response;
}

export default App;