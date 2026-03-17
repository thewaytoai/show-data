import React, { useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import { ConnectionConfig, DbType } from "../types";
import { api } from "../lib/tauri";

interface Props {
  onClose: () => void;
  initial?: ConnectionConfig;
}

const defaultForm: Omit<ConnectionConfig, "id"> = {
  name: "",
  db_type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "",
  database: "",
};

export function ConnectionDialog({ onClose, initial }: Props) {
  const saveConnection = useAppStore((s) => s.saveConnection);
  const [form, setForm] = useState<Omit<ConnectionConfig, "id">>(
    initial ? { ...initial } : { ...defaultForm }
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setTestResult(null);
  }

  function handleDbTypeChange(db_type: DbType) {
    setForm((f) => ({
      ...f,
      db_type,
      port: db_type === "mysql" ? 3306 : 5432,
    }));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await api.testConnection({
        id: initial?.id ?? "",
        ...form,
      });
      setTestResult(`✓ ${msg}`);
    } catch (err) {
      setTestResult(`✗ ${String(err)}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveConnection({ id: initial?.id ?? "", ...form });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] rounded-lg bg-gray-800 shadow-xl border border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {initial ? "Edit Connection" : "New Connection"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* DB Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <div className="flex gap-3">
              {(["mysql", "postgres"] as DbType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleDbTypeChange(t)}
                  className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${
                    form.db_type === t
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-600 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {t === "mysql" ? "MySQL" : "PostgreSQL"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(v) => set("name", v)}
              placeholder="My Database"
            />
          </Field>

          {/* Host + Port */}
          <div className="flex gap-3">
            <Field label="Host" className="flex-1">
              <Input
                value={form.host}
                onChange={(v) => set("host", v)}
                placeholder="localhost"
              />
            </Field>
            <Field label="Port" className="w-24">
              <Input
                value={String(form.port)}
                onChange={(v) => set("port", Number(v))}
                placeholder="3306"
              />
            </Field>
          </div>

          {/* Username + Password */}
          <div className="flex gap-3">
            <Field label="Username" className="flex-1">
              <Input
                value={form.username}
                onChange={(v) => set("username", v)}
                placeholder="root"
              />
            </Field>
            <Field label="Password" className="flex-1">
              <Input
                value={form.password}
                onChange={(v) => set("password", v)}
                type="password"
                placeholder="••••••••"
              />
            </Field>
          </div>

          {/* Database */}
          <Field label="Default Database">
            <Input
              value={form.database}
              onChange={(v) => set("database", v)}
              placeholder="my_database"
            />
          </Field>

          {/* Test result */}
          {testResult && (
            <p
              className={`text-sm ${
                testResult.startsWith("✓")
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {testResult}
            </p>
          )}
        </div>

        <div className="flex justify-between px-6 py-4 border-t border-gray-700">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-300 hover:border-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
    />
  );
}
