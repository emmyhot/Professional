/**
 * Learn IT - Authentication & Session Work Manager
 * Manages user login, registration, and persistent user work (editor state, quiz score, notes)
 */

(function (window) {
    'use strict';

    const USERS_KEY = 'learnIT_users_db';
    const SESSION_KEY = 'learnIT_active_session';
    const WORK_KEY_PREFIX = 'learnIT_user_work_';
    const GUEST_WORK_KEY = 'learnIT_guest_work';

    const DEFAULT_WORK = {
        cssCode: `body {
    background: #0f172a;
    color: #f8fafc;
    font-family: 'Segoe UI', Arial, sans-serif;
    padding: 20px;
}

h1 {
    color: #38bdf8;
    text-align: center;
    margin-bottom: 20px;
}

.box {
    background: #1e293b;
    border: 2px solid #3b82f6;
    padding: 25px;
    margin: 20px auto;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
}

.box h2 {
    color: #facc15;
    margin-bottom: 10px;
}

.box p {
    color: #94a3b8;
    line-height: 1.6;
}`,
        activeLesson: 'intro',
        quizAnswers: {},
        userNotes: '',
        completedLessons: [],
        lastUpdated: null
    };

    // Initialize initial sample user if DB is empty
    function getStoredUsers() {
        try {
            const data = localStorage.getItem(USERS_KEY);
            if (!data) {
                const initialUsers = {
                    'student': {
                        username: 'student',
                        name: 'Alex Johnson',
                        email: 'student@learnit.com',
                        password: 'password123',
                        createdAt: new Date().toISOString()
                    }
                };
                localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
                // Set default sample work for student
                const studentWork = Object.assign({}, DEFAULT_WORK, {
                    userNotes: 'Started CSS Box Model lesson. Remember margin is outside the border!'
                });
                localStorage.setItem(WORK_KEY_PREFIX + 'student', JSON.stringify(studentWork));
                return initialUsers;
            }
            return JSON.parse(data);
        } catch (e) {
            console.error('Error reading stored users:', e);
            return {};
        }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    const AuthEngine = {
        // Get currently logged-in user
        getCurrentUser: function () {
            try {
                const session = localStorage.getItem(SESSION_KEY);
                return session ? JSON.parse(session) : null;
            } catch (e) {
                return null;
            }
        },

        // Sign Up a new user (Starts fresh work session for the user)
        signUp: function (name, username, email, password) {
            const users = getStoredUsers();
            const cleanUsername = username.trim().toLowerCase();
            const cleanEmail = email.trim().toLowerCase();

            if (!cleanUsername || !cleanEmail || !password) {
                return { success: false, message: 'Please fill in all required fields.' };
            }

            if (users[cleanUsername]) {
                return { success: false, message: 'Username is already taken. Please choose another.' };
            }

            // Check email uniqueness
            for (let key in users) {
                if (users[key].email === cleanEmail) {
                    return { success: false, message: 'An account with this email already exists.' };
                }
            }

            const newUser = {
                username: cleanUsername,
                name: name.trim() || cleanUsername,
                email: cleanEmail,
                password: password, // In production, use standard hash
                createdAt: new Date().toISOString()
            };

            users[cleanUsername] = newUser;
            saveUsers(users);

            // Initialize brand new fresh work state for new user ("starts again when sign in/up")
            const newWork = Object.assign({}, DEFAULT_WORK, {
                lastUpdated: new Date().toISOString()
            });
            localStorage.setItem(WORK_KEY_PREFIX + cleanUsername, JSON.stringify(newWork));

            // Set active session
            const sessionUser = {
                username: newUser.username,
                name: newUser.name,
                email: newUser.email,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

            this.notifySessionChange(sessionUser);
            return { success: true, user: sessionUser, work: newWork };
        },

        // Sign In an existing user (Loads their remembered work)
        signIn: function (identifier, password) {
            const users = getStoredUsers();
            const cleanId = identifier.trim().toLowerCase();

            let targetUser = users[cleanId];
            if (!targetUser) {
                // Try finding by email
                for (let key in users) {
                    if (users[key].email === cleanId) {
                        targetUser = users[key];
                        break;
                    }
                }
            }

            if (!targetUser || targetUser.password !== password) {
                return { success: false, message: 'Invalid username/email or password.' };
            }

            const sessionUser = {
                username: targetUser.username,
                name: targetUser.name,
                email: targetUser.email,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

            const work = this.loadUserWork(targetUser.username);
            this.notifySessionChange(sessionUser);
            return { success: true, user: sessionUser, work: work };
        },

        // Sign Out user
        signOut: function () {
            localStorage.removeItem(SESSION_KEY);
            this.notifySessionChange(null);
        },

        // Load saved work for specified user or currently active user
        loadUserWork: function (username) {
            const user = username || (this.getCurrentUser() ? this.getCurrentUser().username : null);
            const key = user ? (WORK_KEY_PREFIX + user) : GUEST_WORK_KEY;

            try {
                const data = localStorage.getItem(key);
                if (data) {
                    return JSON.parse(data);
                }
            } catch (e) {
                console.error('Error loading work state:', e);
            }

            // Fallback default
            const initialWork = Object.assign({}, DEFAULT_WORK);
            localStorage.setItem(key, JSON.stringify(initialWork));
            return initialWork;
        },

        // Save current work for active user
        saveUserWork: function (workData) {
            const currentUser = this.getCurrentUser();
            const key = currentUser ? (WORK_KEY_PREFIX + currentUser.username) : GUEST_WORK_KEY;

            try {
                const existing = this.loadUserWork();
                const updatedWork = Object.assign({}, existing, workData, {
                    lastUpdated: new Date().toISOString()
                });
                localStorage.setItem(key, JSON.stringify(updatedWork));

                // Dispatch custom event for UI updates (e.g., auto-saved badge)
                window.dispatchEvent(new CustomEvent('learnIT_workSaved', { detail: updatedWork }));
                return updatedWork;
            } catch (e) {
                console.error('Error saving user work:', e);
                return null;
            }
        },

        // Start Fresh / Reset work for current user
        resetUserWork: function () {
            const currentUser = this.getCurrentUser();
            const freshWork = Object.assign({}, DEFAULT_WORK, {
                lastUpdated: new Date().toISOString()
            });
            const key = currentUser ? (WORK_KEY_PREFIX + currentUser.username) : GUEST_WORK_KEY;
            localStorage.setItem(key, JSON.stringify(freshWork));

            window.dispatchEvent(new CustomEvent('learnIT_workSaved', { detail: freshWork }));
            return freshWork;
        },

        // Event listener subscription helper
        onSessionChange: function (callback) {
            window.addEventListener('learnIT_sessionChange', function (e) {
                callback(e.detail);
            });
        },

        notifySessionChange: function (user) {
            window.dispatchEvent(new CustomEvent('learnIT_sessionChange', { detail: user }));
        },

        // Render dynamic header auth UI across all pages
        renderHeaderAuthUI: function () {
            const authContainers = document.querySelectorAll('.nav-auth-container, nav ul');
            const currentUser = this.getCurrentUser();

            authContainers.forEach(container => {
                let existingAuth = container.querySelector('.auth-header-widget');
                if (existingAuth) {
                    existingAuth.remove();
                }

                const widget = document.createElement('div');
                widget.className = 'auth-header-widget';
                widget.style.display = 'inline-flex';
                widget.style.alignItems = 'center';
                widget.style.gap = '12px';
                widget.style.marginLeft = '15px';

                if (currentUser) {
                    widget.innerHTML = `
                        <div class="user-badge-menu" style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.1); padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2);">
                            <span style="width: 28px; height: 28px; background: #3b82f6; color: #fff; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 13px;">
                                ${currentUser.name.charAt(0).toUpperCase()}
                            </span>
                            <span style="font-weight: 600; font-size: 14px; color: #fff;">${currentUser.name}</span>
                            <span title="Your work is auto-saved when logged in" style="font-size: 11px; background: #10b981; color: #fff; padding: 2px 8px; border-radius: 10px; font-weight: 700;">
                                Saved ✓
                            </span>
                            <button id="headerLogoutBtn" style="background: transparent; border: none; color: #f87171; font-weight: 700; cursor: pointer; font-size: 13px; margin-left: 5px;" title="Sign out of account">
                                Sign Out
                            </button>
                        </div>
                    `;
                } else {
                    widget.innerHTML = `
                        <a href="login.html" class="auth-btn-signin" style="background: #facc15; color: #0f172a; padding: 8px 18px; border-radius: 999px; font-weight: 800; text-decoration: none; font-size: 14px; transition: all 0.2s ease;">
                            Sign In / Register
                        </a>
                    `;
                }

                container.appendChild(widget);

                const logoutBtn = widget.querySelector('#headerLogoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.signOut();
                        window.location.reload();
                    });
                }
            });
        }
    };

    // Expose AuthEngine to global scope
    window.AuthEngine = AuthEngine;

    // Auto-render header on DOM content loaded
    document.addEventListener('DOMContentLoaded', function () {
        AuthEngine.getStoredUsers(); // Ensure storage is initialized
        AuthEngine.renderHeaderAuthUI();
    });

})(window);
