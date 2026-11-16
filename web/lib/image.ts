// web/lib/image.ts
// Turns a photo the user picked into a small square JPEG (256 x 256 unless a
// size is given), so photos stay light no matter how big the original was.

const AVATAR_SIZE = 256;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not an image we can read."));
    image.src = src;
  });
}

export async function photoToAvatar(file: File, size: number = AVATAR_SIZE): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't process images.");

    // Crop the middle square, then shrink it.
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    context.drawImage(image, sx, sy, side, side, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
