export type SuggestResponse = {
  y: number;
  naturalWidth: number;
  naturalHeight: number;
};

export async function suggestCrop(file: File): Promise<SuggestResponse> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/suggest-crop', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Suggest failed: ${res.status}`);
  return res.json();
}

export async function convertBatch(
  images: Array<{ file: File; y: number }>
): Promise<Blob> {
  const form = new FormData();
  const manifest = {
    images: images.map(({ file, y }) => ({ fileName: file.name, y })),
  };
  form.append('manifest', JSON.stringify(manifest));
  for (const { file } of images) {
    form.append('files', file, file.name);
  }

  const res = await fetch('/api/convert', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Convert failed: ${res.status}`);
  return await res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


