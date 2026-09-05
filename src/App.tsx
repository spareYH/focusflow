import { useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import AuthPage from "./AuthPage";
import { supabase } from "./lib/supabase";

type Priority = "High" | "Medium" | "Low";
type Category = "Work" | "Personal";
type Status = "todo" | "inprogress" | "done";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  status: Status;
  dueDate?: string;
  createdAt: number;
}

type NavItem = "Today" | "All Tasks" | "Work" | "Personal";

interface Toast {
  id: string;
  message: string;
  type: "success" | "delete" | "update" | "error";
}

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  status: Status;
  due_date: string | null;
  created_at: string;
}

const STORAGE_KEY = "focusflow_tasks";

const priorityConfig: Record<Priority, { label: string; dot: string; badge: string; text: string }> = {
  High: { label: "高", dot: "bg-red-400", badge: "bg-red-50 border-red-100", text: "text-red-600" },
  Medium: { label: "中", dot: "bg-amber-400", badge: "bg-amber-50 border-amber-100", text: "text-amber-600" },
  Low: { label: "低", dot: "bg-emerald-400", badge: "bg-emerald-50 border-emerald-100", text: "text-emerald-600" },
};

const statusLabels: Record<Status, string> = { todo: "待处理", inprogress: "进行中", done: "已完成" };
const catLabels: Record<Category, string> = { Work: "工作", Personal: "个人" };

function genId() { return Math.random().toString(36).slice(2, 9); }

function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    status: row.status,
    dueDate: row.due_date ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ── Icons ──────────────────────────────────────────────────────────
function IconFocus() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
function IconToday() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" /><rect x="4.5" y="9" width="2.5" height="2.5" rx="0.5" fill="currentColor" /></svg>;
}
function IconAll() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /></svg>;
}
function IconWork() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 5V3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5V5" stroke="currentColor" strokeWidth="1.3" /><path d="M1.5 9h13" stroke="currentColor" strokeWidth="1.3" /></svg>;
}
function IconPersonal() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" /><path d="M2 13.5c0-2.5 2.686-4.5 6-4.5s6 2 6 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}
function IconBell() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2a5.5 5.5 0 0 0-5.5 5.5V11l-1 2h13l-1-2V7.5A5.5 5.5 0 0 0 9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M7.5 14a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" /></svg>;
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
function IconDots() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="3" cy="7.5" r="1.2" fill="currentColor" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /><circle cx="12" cy="7.5" r="1.2" fill="currentColor" /></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 3.5h11M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M3 3.5l.75 8a.5.5 0 0 0 .5.5h5.5a.5.5 0 0 0 .5-.5L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconCheck() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function IconEdit() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-7 7H2v-2l7-7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}
function IconCheckCircle() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 7.5l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconInfo() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M7.5 6.5v4M7.5 4.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

// ── Toast ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium shadow-lg"
          style={{
            background: t.type === "delete" || t.type === "error" ? "#fef2f2" : "white",
            border: `1px solid ${t.type === "delete" || t.type === "error" ? "#fecaca" : t.type === "update" ? "#e0e7ff" : "#d1fae5"}`,
            color: t.type === "delete" || t.type === "error" ? "#dc2626" : t.type === "update" ? "#4f46e5" : "#059669",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            animation: "slideUp 0.2s ease",
          }}
        >
          <span>{t.type === "delete" ? <IconTrash /> : t.type === "update" || t.type === "error" ? <IconInfo /> : <IconCheckCircle />}</span>
          {t.message}
          <button onClick={() => onDismiss(t.id)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
            <IconX />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Shared form fields ────────────────────────────────────────────────
function TaskFormFields({
  title, setTitle,
  description, setDescription,
  priority, setPriority,
  category, setCategory,
  status, setStatus,
  titleError,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  priority: Priority; setPriority: (v: Priority) => void;
  category: Category; setCategory: (v: Category) => void;
  status: Status; setStatus: (v: Status) => void;
  titleError: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
          标题 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="需要完成什么？"
          className={`w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-slate-50 border rounded-xl outline-none placeholder-slate-300 transition-all ${
            titleError
              ? "border-red-300 ring-2 ring-red-100"
              : "border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          }`}
        />
        {titleError && <p className="text-[11px] text-red-500 mt-1">请输入任务标题</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="添加简短描述…"
          rows={2}
          className="w-full px-3.5 py-2.5 text-[14px] text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none placeholder-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">优先级</label>
          <div className="flex gap-1.5">
            {(["High", "Medium", "Low"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  priority === p
                    ? `${priorityConfig[p].badge} ${priorityConfig[p].text} border-current`
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {priorityConfig[p].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">分类</label>
          <div className="flex gap-1.5">
            {(["Work", "Personal"] as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  category === c
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {catLabels[c]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">状态</label>
        <div className="flex gap-1.5">
          {(["todo", "inprogress", "done"] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                status === s
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────
function CreateTaskModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (task: Omit<Task, "id" | "createdAt">) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [category, setCategory] = useState<Category>("Work");
  const [status, setStatus] = useState<Status>("todo");
  const [titleError, setTitleError] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 180);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleError(true); return; }
    if (submitting) return;
    setSubmitting(true);
    const saved = await onCreate({ title: title.trim(), description: description.trim(), priority, category, status });
    setSubmitting(false);
    if (saved) close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: `rgba(15,20,40,${visible ? 0.35 : 0})`,
        backdropFilter: "blur(4px)",
        transition: "background 0.18s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[480px] mx-4 overflow-hidden"
        style={{
          boxShadow: "0 24px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.08)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.18s ease, opacity 0.18s ease",
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">新建任务</h2>
            <p className="text-xs text-slate-400 mt-0.5">将任务添加到你的看板</p>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <TaskFormFields
            title={title} setTitle={(v) => { setTitle(v); if (v.trim()) setTitleError(false); }}
            description={description} setDescription={setDescription}
            priority={priority} setPriority={setPriority}
            category={category} setCategory={setCategory}
            status={status} setStatus={setStatus}
            titleError={titleError}
          />
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={close} className="flex-1 py-2.5 text-[13px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">取消</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "正在创建…" : "创建任务"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Task Modal ───────────────────────────────────────────────────
function EditTaskModal({ task, onClose, onSave, onDelete }: {
  task: Task;
  onClose: () => void;
  onSave: (updated: Task) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [category, setCategory] = useState<Category>(task.category);
  const [status, setStatus] = useState<Status>(task.status);
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 180);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleError(true); return; }
    if (submitting) return;
    setSubmitting(true);
    const saved = await onSave({ ...task, title: title.trim(), description: description.trim(), priority, category, status });
    setSubmitting(false);
    if (saved) close();
  }

  async function handleDelete() {
    if (submitting) return;
    setSubmitting(true);
    const deleted = await onDelete(task.id);
    setSubmitting(false);
    if (deleted) close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: `rgba(15,20,40,${visible ? 0.35 : 0})`,
        backdropFilter: "blur(4px)",
        transition: "background 0.18s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[480px] mx-4 overflow-hidden"
        style={{
          boxShadow: "0 24px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.08)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.18s ease, opacity 0.18s ease",
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
              <IconEdit /> 编辑任务
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">修改后立即同步到看板</p>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <IconX />
          </button>
        </div>

        {confirmDelete ? (
          <div className="px-6 py-6 text-center">
            <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-red-500"><IconTrash /></span>
            </div>
            <p className="text-[14px] font-semibold text-slate-700 mb-1">确认删除任务？</p>
            <p className="text-[12px] text-slate-400 mb-5">「{task.title}」将被永久删除，无法恢复。</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-[13px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">取消</button>
              <button onClick={handleDelete} disabled={submitting} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "正在删除…" : "确认删除"}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="px-6 py-5">
            <TaskFormFields
              title={title} setTitle={(v) => { setTitle(v); if (v.trim()) setTitleError(false); }}
              description={description} setDescription={setDescription}
              priority={priority} setPriority={setPriority}
              category={category} setCategory={setCategory}
              status={status} setStatus={setStatus}
              titleError={titleError}
            />
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all flex-shrink-0"
                title="删除任务"
              >
                <IconTrash />
              </button>
              <button type="button" onClick={close} className="flex-1 py-2.5 text-[13px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">取消</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "正在保存…" : "保存更改"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, onEdit, disabled }: {
  task: Task;
  onStatusChange: (id: string, status: Status) => void;
  onEdit: (task: Task) => void;
  disabled: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDone = task.status === "done";
  const p = priorityConfig[task.priority];

  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group relative bg-white border rounded-[11px] p-4 transition-all ${disabled ? "cursor-wait opacity-60" : "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"} ${
        isDone ? "border-slate-100 opacity-75" : "border-slate-200/80 hover:border-indigo-200"
      } ${isDragging ? "opacity-40 scale-[0.98]" : ""}`}
      style={{ boxShadow: isDone ? "none" : "0 1px 3px rgba(0,0,0,0.04)" }}
      onClick={() => { if (!disabled) onEdit(task); }}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h4 className={`text-[13.5px] font-semibold leading-snug flex-1 ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
          {task.title}
        </h4>
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-md opacity-0 group-hover:opacity-100 transition-all"
          >
            <IconDots />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                {(["todo", "inprogress", "done"] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(task.id, s); setMenuOpen(false); }}
                    className={`w-full text-left px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-slate-50 flex items-center gap-2 ${task.status === s ? "text-indigo-600" : "text-slate-600"}`}
                  >
                    {task.status === s ? <IconCheck /> : <span className="w-3.5" />}
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {task.description && (
        <p className={`text-[12px] leading-relaxed mb-3 ${isDone ? "text-slate-300" : "text-slate-400"}`}>
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${p.badge} ${p.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 border border-slate-100 text-slate-400">
          {catLabels[task.category]}
        </span>
        {task.dueDate && !isDone && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 border border-slate-100 text-slate-400 ml-auto">
            {task.dueDate}
          </span>
        )}
        {isDone && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 border border-emerald-100 text-emerald-500 ml-auto">
            <IconCheck /> 已完成
          </span>
        )}
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────
function KanbanColumn({ status, tasks, onStatusChange, onEdit, disabled }: {
  status: Status;
  tasks: Task[];
  onStatusChange: (id: string, status: Status) => void;
  onEdit: (task: Task) => void;
  disabled: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const titles: Record<Status, string> = { todo: "待处理", inprogress: "进行中", done: "已完成" };
  const accents: Record<Status, string> = { todo: "bg-slate-400", inprogress: "bg-indigo-500", done: "bg-emerald-500" };
  const bgs: Record<Status, string> = { todo: "bg-slate-50", inprogress: "bg-indigo-50/50", done: "bg-emerald-50/40" };

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2.5 mb-3 px-0.5">
        <span className={`w-2 h-2 rounded-full ${accents[status]}`} />
        <span className="text-[12px] font-semibold text-slate-500 tracking-widest uppercase">{titles[status]}</span>
        <span className="ml-auto text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{tasks.length}</span>
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragOver(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const taskId = event.dataTransfer.getData("text/plain");
          setIsDragOver(false);
          if (taskId && !disabled) onStatusChange(taskId, status);
        }}
        className={`flex-1 rounded-[13px] p-2.5 min-h-[280px] transition-all ${bgs[status]} ${
          isDragOver ? "ring-2 ring-indigo-300 ring-offset-2" : ""
        }`}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEdit} disabled={disabled} />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-2.5">
                <span className="text-slate-300 text-lg">·</span>
              </div>
              <p className="text-[12px] text-slate-300 font-medium">暂无任务</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
// Retained for Issue #6. Logged-in task rendering never calls this reader.
function loadLocalTasksForMigration(userId: string): Task[] {
  try {
    const storageKey = `${STORAGE_KEY}_${userId}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as Task[];

    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const legacyTasks = JSON.parse(legacyRaw) as Task[];
      return legacyTasks;
    }
  } catch { /* ignore */ }
  return [];
}

function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [activeNav, setActiveNav] = useState<NavItem>("Today");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = genId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  function dismissToast(id: string) { setToasts((prev) => prev.filter((t) => t.id !== id)); }

  const loadCloudTasks = useCallback(async () => {
    setTasks([]);
    setEditingTask(null);
    setLoadError(null);
    setLoadingTasks(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("id,user_id,title,description,priority,category,status,due_date,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError("任务加载失败，请检查网络后重试。");
    } else {
      setTasks((data as TaskRow[]).map(taskFromRow));
    }
    setLoadingTasks(false);
  }, [user.id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setTasks([]);
      setLoadingTasks(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("tasks")
        .select("id,user_id,title,description,priority,category,status,due_date,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) setLoadError("任务加载失败，请检查网络后重试。");
      else setTasks((data as TaskRow[]).map(taskFromRow));
      setLoadingTasks(false);
    })();
    return () => { active = false; };
  }, [user.id]);

  // Derived stats (always from full task list)
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "inprogress").length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sidebar filtering
  const filteredTasks: Task[] = (() => {
    switch (activeNav) {
      case "Work": return tasks.filter((t) => t.category === "Work");
      case "Personal": return tasks.filter((t) => t.category === "Personal");
      case "Today": return tasks; // treat all as "today" for demo
      default: return tasks;
    }
  })();

  const todoTasks = filteredTasks.filter((t) => t.status === "todo");
  const inProgressTasks = filteredTasks.filter((t) => t.status === "inprogress");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  async function handleCreate(task: Omit<Task, "id" | "createdAt">) {
    if (mutating) return false;
    setMutating(true);
    const { data, error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      category: task.category,
      status: task.status,
      due_date: task.dueDate ?? null,
    }).select("id,user_id,title,description,priority,category,status,due_date,created_at").single();
    setMutating(false);
    if (error) {
      addToast("创建失败，请重试", "error");
      return false;
    }
    setTasks((prev) => [taskFromRow(data as TaskRow), ...prev]);
    addToast("任务已创建", "success");
    return true;
  }

  async function handleSave(updated: Task) {
    if (mutating) return false;
    setMutating(true);
    const { data, error } = await supabase.from("tasks").update({
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      category: updated.category,
      status: updated.status,
      due_date: updated.dueDate ?? null,
    }).eq("id", updated.id).eq("user_id", user.id)
      .select("id,user_id,title,description,priority,category,status,due_date,created_at").single();
    setMutating(false);
    if (error) {
      addToast("保存失败，原任务未更改", "error");
      return false;
    }
    const saved = taskFromRow(data as TaskRow);
    setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    addToast("任务已更新", "update");
    return true;
  }

  async function handleDelete(id: string) {
    if (mutating) return false;
    setMutating(true);
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id).select("id").single();
    setMutating(false);
    if (error) {
      addToast("删除失败，任务仍然保留", "error");
      return false;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setEditingTask(null);
    addToast("任务已删除", "delete");
    return true;
  }

  async function handleStatusChange(id: string, status: Status) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status || mutating) return;
    setMutating(true);
    const { data, error } = await supabase.from("tasks").update({ status })
      .eq("id", id).eq("user_id", user.id)
      .select("id,user_id,title,description,priority,category,status,due_date,created_at").single();
    setMutating(false);
    if (error) {
      addToast("状态更新失败，任务未移动", "error");
      return;
    }
    const saved = taskFromRow(data as TaskRow);
    setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
    const label = statusLabels[status];
    addToast(`已移至「${label}」`, "update");
  }

  const navItems: { label: NavItem; display: string; icon: React.ReactNode }[] = [
    { label: "Today", display: "今天", icon: <IconToday /> },
    { label: "All Tasks", display: "全部任务", icon: <IconAll /> },
    { label: "Work", display: "工作", icon: <IconWork /> },
    { label: "Personal", display: "个人", icon: <IconPersonal /> },
  ];

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: "#f3f4f8", fontFamily: '"PingFang SC", "苹方", "PingFang TC", "Microsoft YaHei", "微软雅黑", system-ui, sans-serif' }}
    >
      {/* Sidebar */}
      <aside className="flex flex-col flex-shrink-0 h-full" style={{ width: "232px", background: "white", borderRight: "1px solid #e8eaf0" }}>
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)" }}>
            <IconFocus />
          </div>
          <span className="text-[15px] font-bold text-slate-800 tracking-tight">FocusFlow</span>
        </div>

        <div className="mx-4 h-px bg-slate-100 mb-4" />

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase px-2.5 mb-2">视图</p>
          {navItems.map(({ label, display, icon }) => {
            const isActive = activeNav === label;
            const count = label === "Today" ? tasks.filter((t) => t.status !== "done").length
              : label === "Work" ? tasks.filter((t) => t.category === "Work" && t.status !== "done").length
              : label === "Personal" ? tasks.filter((t) => t.category === "Personal" && t.status !== "done").length
              : tasks.filter((t) => t.status !== "done").length;
            return (
              <button
                key={label}
                onClick={() => setActiveNav(label)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13.5px] font-medium transition-all text-left ${
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={isActive ? "text-indigo-500" : "text-slate-400"}>{icon}</span>
                {display}
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}

          <div className="h-px bg-slate-100 my-3" />

          <div className="px-2.5 py-3">
            <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2.5">今日进度</p>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">{progress}%</span>
            </div>
            <p className="text-[11.5px] text-slate-400">{totalCount} 项中已完成 {completedCount} 项</p>
          </div>
        </nav>

        <div className="p-4">
          <button
            onClick={() => setShowCreate(true)}
            disabled={loadingTasks || mutating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}
          >
            <IconPlus /> 新建任务
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-8 py-4 flex-shrink-0">
          <div>
            <h1 className="text-[22px] font-bold text-slate-800 tracking-tight leading-none">下午好 👋</h1>
            <p className="text-[13px] text-slate-400 mt-1 font-medium">专注当下，把今天过得充实。</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-slate-400">2026年8月31日</span>
            <div className="w-px h-4 bg-slate-200" />
            <button className="relative w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition-all border border-transparent hover:border-slate-200">
              <IconBell />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            </button>
            <span className="hidden max-w-44 truncate text-[12px] font-medium text-slate-500 lg:block" title={user.email}>{user.email}</span>
            <button
              onClick={onSignOut}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
            >
              退出
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loadError && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700" role="alert">
              <span>{loadError}</span>
              <button onClick={() => void loadCloudTasks()} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold hover:bg-red-100">重试</button>
            </div>
          )}
          {/* Progress surface */}
          <div className="rounded-2xl mb-6 p-5" style={{ background: "white", border: "1px solid #e8eaf0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <p className="text-[13px] font-semibold text-slate-700">今日进度</p>
                <p className="text-[12px] text-slate-400 mt-0.5">共 {totalCount} 项任务，已完成 {completedCount} 项</p>
              </div>
              <span className="text-[28px] font-bold tracking-tight leading-none" style={{ color: "#6366f1" }}>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)" }} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-[12px] text-slate-500 font-medium"><span className="text-slate-700 font-semibold">{totalCount}</span> 项任务</span>
              </div>
              <div className="w-px h-3 bg-slate-100" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-[12px] text-slate-500 font-medium"><span className="text-slate-700 font-semibold">{inProgressCount}</span> 进行中</span>
              </div>
              <div className="w-px h-3 bg-slate-100" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[12px] text-slate-500 font-medium"><span className="text-slate-700 font-semibold">{completedCount}</span> 已完成</span>
              </div>
            </div>
          </div>

          {/* Kanban */}
          {loadingTasks ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white" role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-3 text-[13px] font-medium text-slate-500">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                正在加载云端任务…
              </div>
            </div>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <KanbanColumn status="todo" tasks={todoTasks} onStatusChange={handleStatusChange} onEdit={setEditingTask} disabled={mutating} />
              <KanbanColumn status="inprogress" tasks={inProgressTasks} onStatusChange={handleStatusChange} onEdit={setEditingTask} disabled={mutating} />
              <KanbanColumn status="done" tasks={doneTasks} onStatusChange={handleStatusChange} onEdit={setEditingTask} disabled={mutating} />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSave={handleSave} onDelete={handleDelete} />}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        正在恢复登录状态…
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Unable to restore Supabase session", error);
      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Unable to sign out", error);
  }

  if (initializing) return <SessionLoading />;
  if (!session?.user) return <AuthPage />;
  return <Dashboard key={session.user.id} user={session.user} onSignOut={handleSignOut} />;
}
