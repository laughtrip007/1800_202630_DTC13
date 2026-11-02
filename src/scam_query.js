import { db } from "./firebaseConfig.js";
import { doc, onSnapshot } from "firebase/firestore";


function input_username() {
    //reference to the quotes collection
    const quoteRef = doc(db, "scamReports", "reports");

    //read the collection
    onSnapshot(quoteRef, docSnap => {
        if (docSnap.exists()) {
            //replace the front end with the quote from the day document
            document.getElementById("username_goes_here").innerHTML = docSnap.data().username;
            document.getElementById("query_goes_here").innerHTML = docSnap.data().query;
            document.getElementById("message_goes_here").innerHTML = docSnap.data().message;
        } else {
            console.log("no such document");
        }


    }, (error) => {
        console.error("failed reading the document", error);
    })



}
input_username();