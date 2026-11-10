import { db } from "./firebaseConfig.js";
import { doc, onSnapshot } from "firebase/firestore";

function showReport() {
  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    location.replace("scam_reports.html");
    return;
  }

  onSnapshot(
    doc(db, "scamReports", id),
    (docSnap) => {
      if (!docSnap.exists()) {
        document.getElementById("username_goes_here").textContent = "Report not found";
        document.getElementById("query_goes_here").textContent = "This report may have been deleted.";
        document.getElementById("message_goes_here").textContent = "";
        return;
      }

      // older reports used username/message instead of ownerName/details
      const report = docSnap.data();
      document.getElementById("username_goes_here").textContent =
        report.ownerName || report.username || "Anonymous";
      document.getElementById("query_goes_here").textContent = report.query || "Untitled report";
      document.getElementById("message_goes_here").textContent = report.details || report.message || "";
      document.getElementById("")
    },
    (error) => {
      console.error("failed reading the document", error);
    },
  );
}

showReport();
