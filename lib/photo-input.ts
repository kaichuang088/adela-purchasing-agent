// Inline images count toward the free gateway's per-request input budget.
export const AI_PHOTO_MAX_BYTES = 24 * 1024;

export async function optimizePhoto(file: File,maxBytes=AI_PHOTO_MAX_BYTES) {
 if (file.size <= maxBytes) return file;
 const bitmap = await createImageBitmap(file);
 try {
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw new Error('無法處理照片，請改用較小的圖片。');
  for (const longestSide of [1024, 896, 768, 640, 512, 384, 256, 192]) {
   const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
   canvas.width = Math.max(1, Math.round(bitmap.width * scale));
   canvas.height = Math.max(1, Math.round(bitmap.height * scale));
   context.fillStyle = '#fff';
   context.fillRect(0, 0, canvas.width, canvas.height);
   context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
   for (const quality of [.82, .72, .62, .52]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {type: 'image/jpeg'});
   }
  }
  throw new Error('照片細節過多，請裁切為單一商品，保留清楚的品名與容量後重試。');
 } finally {
  bitmap.close();
 }
}
