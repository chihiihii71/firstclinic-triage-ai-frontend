const ANON_ID_KEY = "firstclinic_anon_id";

export function getAnonId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}