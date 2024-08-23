import {lancementChat} from "./chat.js";

const loginForm = document.getElementById("login-form");
const LoginButt = document.getElementById("login-form-submit");


function foo() {
	
	console.log("username : %s | password: %s", loginForm.username.value, loginForm.password.value);
}

LoginButt.addEventListener("click", e => {
	e.preventDefault();
	foo();

	
	fetch('https://localhost:8083/api/login/', {
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
        if (data.token)
        {
            localStorage.setItem('authToken', data.token);
            console.log('Token saved: ', data.token);
            console.log("is a token"); 
            document.querySelector("#app").innerHTML = '<textarea id="chat-log" cols="100" rows="20"></textarea><br> <input id="chat-message-input" type="text" size="100"><br> <input id="chat-message-submit" type="button" value="Send"> {lobby}';
            lancementChat();
        }
        else
            console.error('Token not found in response');
       })
       .catch(error => {
            console.error('There was a problem with the fetch operation: ', error);
       })

});