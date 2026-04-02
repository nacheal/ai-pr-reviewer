import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'pr_pilot_history';

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

/**
 * useHistory — 管理当前 Session 的 PR 审查历史
 *
 * 数据结构：
 * [{ id, prUrl, owner, repo, pullNumber, title, report, status, createdAt }]
 */
export function useHistory() {
  const [history, setHistory] = useState(() => loadHistory());

  // 同步到 sessionStorage
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  /** 添加一条历史记录（status='pending'），返回 id */
  const addRecord = useCallback((prUrl, owner, repo, pullNumber) => {
    const id = `${owner}-${repo}-${pullNumber}-${Date.now()}`;
    const record = {
      id,
      prUrl,
      owner,
      repo,
      pullNumber,
      title: null,
      report: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => [record, ...prev]);
    return id;
  }, []);

  /** 更新历史记录（分析完成后写入 report + title） */
  const updateRecord = useCallback((id, patch) => {
    setHistory((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }, []);

  /** 删除历史记录 */
  const removeRecord = useCallback((id) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { history, addRecord, updateRecord, removeRecord };
}
