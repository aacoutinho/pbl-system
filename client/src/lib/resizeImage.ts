/**
 * Redimensiona uma imagem para um tamanho máximo, mantendo proporção quadrada (crop central),
 * e retorna como base64 JPEG comprimido.
 * Ideal para fotos de perfil/identificação facial.
 */
export function resizeImageToSquare(
  file: File,
  maxSize: number = 150,
  quality: number = 0.7
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas não suportado")); return; }

        // Crop central quadrado
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Retorna o tamanho aproximado em KB de uma string base64.
 */
export function base64SizeKB(base64: string): number {
  return Math.round((base64.length * 3) / 4 / 1024);
}
