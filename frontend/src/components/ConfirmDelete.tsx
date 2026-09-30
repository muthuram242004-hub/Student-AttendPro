import { useEffect, useRef } from "react";

export function ConfirmDelete({ title, message, label, busy, error, onConfirm, onCancel }: {
  title: string; message: string; label: string; busy: boolean; error: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-message" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="delete-title">{title}</h2><p id="delete-message">{message}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="page-actions"><button autoFocus className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="danger" disabled={busy} onClick={onConfirm}>{busy ? "Deleting..." : label}</button></div>
  </dialog>;
}
