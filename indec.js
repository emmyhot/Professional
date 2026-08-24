/**
 * Learn IT - Authentication & Helper Utilities
 */

function addPassword() {
    console.log("Password security initialized.");
}

function userLogin(username, password) {
    if (window.AuthEngine) {
        return window.AuthEngine.signIn(username, password);
    }
}