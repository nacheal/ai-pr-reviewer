import { useReducer, useRef, useCallback } from 'react';

// ── 状态结构 ──────────────────────────────────────────────
const initialState = {
  status: 'idle',       // "idle" | "running" | "done" | "error"
  thinkingSteps: [],    // [{ id, text }]  — 每个 ReAct 迭代的思考文字（按轮次合并）
  toolCalls: [],        // [{ id, name, input, durationMs, isError, status }]
  report: null,         // string | null
  error: null,          // string | null
};

function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...initialState, status: 'running' };

    case 'thinking': {
      const steps = [...state.thinkingSteps];
      const last = steps[steps.length - 1];
      if (last && last.iteration === action.iteration) {
        steps[steps.length - 1] = { ...last, text: last.text + action.text };
      } else {
        steps.push({ id: action.iteration, iteration: action.iteration, text: action.text });
      }
      return { ...state, thinkingSteps: steps };
    }

    case 'tool_start': {
      const call = {
        id: action.id,
        name: action.name,
        input: action.input,
        status: 'running',
        durationMs: null,
        isError: false,
      };
      return { ...state, toolCalls: [...state.toolCalls, call] };
    }

    case 'tool_done': {
      const toolCalls = state.toolCalls.map((c) =>
        c.id === action.id
          ? { ...c, status: 'done', durationMs: action.durationMs, isError: action.isError }
          : c
      );
      return { ...state, toolCalls };
    }

    case 'report':
      return { ...state, report: action.content };

    case 'DONE':
      return { ...state, status: 'done' };

    case 'error':
      return { ...state, status: 'error', error: action.message };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────
export function useAgentStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const esRef = useRef(null);
  const iterationRef = useRef(0);
  const toolIdRef = useRef(0);
  // track current tool call id for matching tool_done
  const pendingToolsRef = useRef({}); // name -> id (简单映射，同名工具不会并发)

  const start = useCallback((prUrl) => {
    // 关闭已有连接
    if (esRef.current) {
      esRef.current.close();
    }
    dispatch({ type: 'START' });
    iterationRef.current = 0;
    toolIdRef.current = 0;
    pendingToolsRef.current = {};

    const url = `/api/review?url=${encodeURIComponent(prUrl)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      let event;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }

      switch (event.type) {
        case 'thinking':
          // 每次 thinking chunk 属于当前 iteration
          dispatch({ type: 'thinking', iteration: iterationRef.current, text: event.text });
          break;

        case 'tool_start': {
          iterationRef.current += 1; // 调用工具代表新一轮 ReAct
          const id = ++toolIdRef.current;
          pendingToolsRef.current[event.name] = id;
          dispatch({ type: 'tool_start', id, name: event.name, input: event.input });
          break;
        }

        case 'tool_done': {
          const id = pendingToolsRef.current[event.name];
          dispatch({ type: 'tool_done', id, name: event.name, durationMs: event.durationMs, isError: event.isError });
          break;
        }

        case 'report':
          dispatch({ type: 'report', content: event.content });
          break;

        case 'error':
          dispatch({ type: 'error', message: event.message });
          break;

        case 'done':
          dispatch({ type: 'DONE' });
          es.close();
          break;

        default:
          break;
      }
    };

    es.onerror = () => {
      dispatch({ type: 'error', message: '连接中断，请重试。' });
      es.close();
    };
  }, []);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    dispatch({ type: 'DONE' });
  }, []);

  return { ...state, start, stop };
}
