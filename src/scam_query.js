import { db } from "./firebaseConfig.js";
import { doc, onSnapshot } from "firebase/firestore";


function input_username() {
    const quoteRef = doc(db, "scamReports", "reports");

    onSnapshot(quoteRef, docSnap => {
        if (docSnap.exists()) {
            document.getElementById("username_goes_here").textContent = docSnap.data().username;
            document.getElementById("query_goes_here").textContent = docSnap.data().query;
            document.getElementById("message_goes_here").textContent = docSnap.data().message;
        } else {
            console.log("no such document");
        }


    }, (error) => {
        console.error("failed reading the document", error);
    })



}
input_username();