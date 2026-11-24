// Date formats used across the app (Firestore timestamps in, text out).

// "Nov 16, 2026"
export function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

// "just now", "5 min ago", "3 hours ago", "2 days ago", then the date
export function formatTime(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return "";

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

  const days = Math.floor(hours / 24);
  if (days < 7) return days + (days === 1 ? " day ago" : " days ago");

  return formatDate(timestamp);
}

// "November 16, 2026 at 3:05 p.m.", for hover titles
export function formatFullTime(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? date.toLocaleString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}
