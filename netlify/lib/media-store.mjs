// Pictures and small files the owner uploads. They live in the content store and are served from /u/<id>.<ext>.
export const kindOf = (buf) => {
  const b = Buffer.from(buf.subarray ? buf.subarray(0, 12) : buf);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", image: true };
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png", image: true };
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp", image: true };
  if (b.slice(0, 3).toString() === "GIF") return { mime: "image/gif", ext: "gif", image: true };
  if (b.slice(0, 4).toString() === "%PDF") return { mime: "application/pdf", ext: "pdf", image: false };
  return null;
};
export const upKey = (id, thumb) => `up-${id}${thumb ? "-t" : ""}`;
export const newId = () => Math.random().toString(16).slice(2, 12).padEnd(10, "0");
