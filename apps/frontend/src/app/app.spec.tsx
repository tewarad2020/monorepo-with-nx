import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';

describe('App', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const task = { id: 1, title: 'Test task', completed: false };

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('toggles the theme and remembers it without extra API requests', async () => {
    fetchMock.mockResolvedValue(new Response('[]'));
    const { unmount } = render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('light');
    const toggle = screen.getByRole('button', { name: 'โหมดมืด' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('frontend-theme')).toBe('dark');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'โหมดมืด' }));
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('frontend-theme')).toBe('light');
  });

  it('defaults to the system dark theme when no theme is saved', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    fetchMock.mockResolvedValue(new Response('[]'));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
  });

  it('prefers a saved theme over the system preference', async () => {
    localStorage.setItem('frontend-theme', 'light');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    fetchMock.mockResolvedValue(new Response('[]'));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('light');
  });

  it('ignores invalid saved themes', async () => {
    localStorage.setItem('frontend-theme', 'invalid');
    fetchMock.mockResolvedValue(new Response('[]'));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('light');
  });

  it('allows switching themes when local storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    fetchMock.mockRejectedValue(new Error('Offline'));
    render(<App />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'โหมดมืด' }));
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
  });

  it('loads existing tasks', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([task])));
    render(<App />);
    expect(await screen.findByText(task.title)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'รายการ Tasks' })).toBeTruthy();
  });

  it('adds a task and clears the input', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]'));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(task), { status: 201 }));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Test task ' } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม task' }));
    expect(await screen.findByText(task.title)).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/todos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title }),
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('deletes a task', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([task])));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: `ลบ ${task.title}` }));
    await screen.findByText(/ยังไม่มี task/);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/todos/1', { method: 'DELETE' });
  });

  it('keeps the input when creation fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]'));
    fetchMock.mockResolvedValueOnce(new Response('Failed', { status: 500 }));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: task.title } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม task' }));
    expect((await screen.findByRole('alert')).textContent).toContain('เพิ่ม task ไม่สำเร็จ');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(task.title);
  });

  it('keeps a task when deletion fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([task])));
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: `ลบ ${task.title}` }));
    expect((await screen.findByRole('alert')).textContent).toContain('ลบ task ไม่สำเร็จ');
    expect(screen.getByText(task.title)).toBeTruthy();
  });

  it('allows retrying a failed load', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    fetchMock.mockResolvedValueOnce(new Response('[]'));
    render(<App />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'โหลดใหม่' }));
    await screen.findByText(/ยังไม่มี task/);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('handles a legacy null task list', async () => {
    fetchMock.mockResolvedValueOnce(new Response('null'));
    render(<App />);
    await screen.findByText(/ยังไม่มี task/);
  });
});
