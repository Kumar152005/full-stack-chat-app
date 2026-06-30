export const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='48' fill='%231f2937'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%239ca3af'/%3E%3Cpath d='M20 82c5-18 18-28 28-28s23 10 28 28' fill='%239ca3af'/%3E%3C/svg%3E";

export const normalizeImageUrl = (url, fallback = DEFAULT_AVATAR) => {
  if (!url) return fallback;
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
};

export const normalizeMessageImageUrl = (url) => {
  const normalizedUrl = normalizeImageUrl(url, "");

  if (
    normalizedUrl.includes("res.cloudinary.com") &&
    normalizedUrl.includes("/image/upload/") &&
    !normalizedUrl.includes("/image/upload/f_jpg,q_auto/")
  ) {
    return normalizedUrl.replace("/image/upload/", "/image/upload/f_jpg,q_auto/");
  }

  return normalizedUrl;
};

export const useImageFallback = (event, fallback = DEFAULT_AVATAR) => {
  if (event.currentTarget.src !== fallback) {
    event.currentTarget.src = fallback;
  }
};
