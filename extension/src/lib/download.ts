/** Saves text as a file through a Blob URL and an `a[download]` link (US-08). */
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // The download has started from the URL by now; keep it a moment for slow starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
