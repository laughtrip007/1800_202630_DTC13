import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";


let currentUser = null;

onAuthReady(function (user) {
    if (!user) {
        location.href = "index.html";  
        return;
    }
    currentUser = user;                 
});

async function saveReport(event) {
    event.preventDefault();


    const newReport = {
        query: document.getElementById("queryInput").value,
        details: document.getElementById("detailsInput").value,
        owner: currentUser.uid,                                      
        ownerName: currentUser.displayName || currentUser.email,
        last_updated: serverTimestamp()                           
    };


    try {
        await addDoc(collection(db, "scamReports"), newReport);
        location.href = "main.html";    
    } catch (error) {
        alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
    }
}

document.getElementById("addReportForm").addEventListener("submit", saveReport);