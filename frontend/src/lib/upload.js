import { axiosInstance } from "./axios";

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.78;

const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return res.blob();
};

export const compressImageFile = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.onload = async () => {
        const scale = Math.min(
          1,
          MAX_IMAGE_DIMENSION / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
        const blob = await dataUrlToBlob(dataUrl);
        resolve({
          blob,
          dataUrl,
          name: file.name.replace(/\.[^.]+$/, ".jpg"),
          type: "image/jpeg",
          size: blob.size,
        });
      };
      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const uploadToCloudinary = async (fileLike, onProgress) => {
  const signatureRes = await axiosInstance.get("/messages/upload/signature");
  const { cloudName, apiKey, folder, timestamp, signature } = signatureRes.data;
  const formData = new FormData();

  formData.append("file", fileLike.blob || fileLike.file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadRes = await axiosInstance.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    formData,
    {
      withCredentials: false,
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }
  );

  return {
    url: uploadRes.data.secure_url,
    name: fileLike.name,
    type: fileLike.type,
    size: fileLike.size,
  };
};
