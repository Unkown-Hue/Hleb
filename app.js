function processFile(shift) {
const fileInput = document.getElementById("fileInput");
if (!fileInput.files.length) {
alert("No file selected.");
return;
}

const file = fileInput.files[0];
const reader = new FileReader();

reader.onload = function (e) {
// ArrayBuffer → Uint8Array
const data = new Uint8Array(e.target.result);

// Apply your algorithm
for (let i = 0; i < data.length; i++) {
data[i] = (data[i] + shift) & 0xFF; // keep between 0–255
}

const outputBlob = new Blob([data], { type: "application/octet-stream" });
const url = URL.createObjectURL(outputBlob);

const a = document.createElement("a");
a.href = url;
a.download = file.name + (shift < 0 ? ".enc" : ".dec");
a.click();

URL.revokeObjectURL(url);
};

reader.readAsArrayBuffer(file);
}

function encrypt() {
processFile(-1); // Shift every byte -1
}

function decrypt() {
processFile(+1); // Shift every byte +1
}
