const DATA_URI_RE = /^(data:|blob:)/i;

type ImageFormat = "avif" | "webp" | "jpeg" | "png";

type BuildImageOptions = {
  width?: number;
  quality?: number;
  format?: ImageFormat;
  version?: string | number;
};

export function buildImageUrl(src: string, options: BuildImageOptions = {}) {
  if (!src) return "";
  if (DATA_URI_RE.test(src)) return src;

  const { width, quality, format, version } = options;
  const [pathWithQuery, hash = ""] = src.split("#");
  const [path, query = ""] = pathWithQuery.split("?");
  const params = new URLSearchParams(query);

  if (width) params.set("w", String(width));
  if (quality) params.set("q", String(quality));
  if (format) params.set("format", format);
  if (version) params.set("v", String(version));

  const rebuilt = params.toString() ? `${path}?${params.toString()}` : path;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

