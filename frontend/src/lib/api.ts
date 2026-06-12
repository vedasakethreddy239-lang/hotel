import axios from "axios";

const API_URL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_API_URL || "";

export const api = axios.create({ baseURL: `${API_URL}/api` });

export async function downloadPdf(path: string, filename: string) {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
