const OPEN_ATTRIBUTE = "open";

function openModal(dialog: HTMLDialogElement | null): void {
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute(OPEN_ATTRIBUTE, "");
}

function closeModal(dialog: HTMLDialogElement | null): void {
  if (!dialog?.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute(OPEN_ATTRIBUTE);
}

export { closeModal, openModal };
