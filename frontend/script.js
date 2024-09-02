import {lancementChat} from "./chat.js";

const loginForm = document.getElementById("login-form");
const LoginButt = document.getElementById("login-form-submit");
const JoinButt = document.getElementById("join-room-submit");
const roomName = document.getElementById("room_form");

const chatScreen = document.getElementById("app");

function foo() {

	console.log("username : %s | password: %s", loginForm.username.value, loginForm.password.value);
}

LoginButt.addEventListener("click", e => {
	e.preventDefault();
	foo();


	fetch('https://localhost:8083/api/auth/login/', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "username": loginForm.username.value,
            "password": loginForm.password.value
        })
    })
       .then(response => {
        if (!response.ok)
                throw new Error('Network response was not ok : ' + response.status);
            return response.json();
       })
       .then(data=> {
           // lancementChat(chatScreen);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation: ', error);
        })

    });

    JoinButt.addEventListener("click", e => {
        e.preventDefault();
        lancementChat(chatScreen, roomName.room_name.value);
        // chatScreen.style.display = "contents";
});
