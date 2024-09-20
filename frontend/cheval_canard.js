var i = 0
var intervalID;

intervalID = setInterval(log, 1000);

function log() {
	console.log("i =", i);
	i++;
}

function clean(){
	console.log("function clean called");
	if (intervalID)
	{
		clearInterval(intervalID);
		intervalID = null;
	}
}