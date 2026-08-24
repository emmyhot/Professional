/**
 * Learn IT - Authentication, Session & Professional Student Hub Manager
 * Manages user authentication, persistent work, progress XP, streak, badges & certificates
 */

(function (window) {
    'use strict';

    const USERS_KEY = 'learnIT_users_db';
    const SESSION_KEY = 'learnIT_active_session';
    const WORK_KEY_PREFIX = 'learnIT_user_work_';
    const GUEST_WORK_KEY = 'learnIT_guest_work';

    const DEFAULT_WORK = {
        htmlCode: `<div class="card">
  <h1>Welcome to Learn IT!</h1>
  <p>Edit HTML, CSS, and JavaScript in real-time below.</p>
  <button id="clickBtn">Click Me!</button>
  <div id="output"></div>
</div>`,
        cssCode: `body {
  background: #0f172a;
  color: #f8fafc;
  font-family: 'Segoe UI', Tahoma, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
}

.card {
  background: #1e293b;
  border: 2px solid #3b82f6;
  padding: 30px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  max-width: 400px;
}

h1 {
  color: #38bdf8;
  font-size: 1.8rem;
  margin-bottom: 10px;
}

p {
  color: #94a3b8;
  line-height: 1.5;
}

button {
  background: #facc15;
  color: #0f172a;
  border: none;
  padding: 12px 24px;
  font-weight: 800;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 15px;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}`,
        jsCode: `document.getElementById('clickBtn').addEventListener('click', function() {
  const output = document.getElementById('output');
  output.innerHTML = '<p style="color:#10b981; font-weight:bold; margin-top:15px;">🎉 Awesome! Your JavaScript is working!</p>';
  console.log('Button clicked successfully at ' + new Date().toLocaleTimeString());
});`,
        activeLesson: 'intro',
        quizAnswers: { 'q1': 'correct', 'q2': 'correct' },
        userNotes: 'Mastering CSS Flexbox and HTML structure. Keep practicing daily!',
        completedLessons: ['intro', 'selectors', 'colors'],
        xpPoints: 450,
        streakDays: 5,
        level: 2,
        badges: ['first_code', 'quiz_whiz', 'streak_5'],
        certificates: [
            {
                id: 'CERT-CSS-9821',
                title: 'Responsive Web Design & CSS Mastery',
                issueDate: '2026-08-20',
                score: '95%'
            }
        ],
        lastUpdated: new Date().toISOString()
    };

    // Initialize sample user DB if empty
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
                localStorage.setItem(WORK_KEY_PREFIX + 'student', JSON.stringify(DEFAULT_WORK));
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
        getCurrentUser: function () {
            try {
                const session = localStorage.getItem(SESSION_KEY);
                return session ? JSON.parse(session) : null;
            } catch (e) {
                return null;
            }
        },

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

            for (let key in users) {
                if (users[key].email === cleanEmail) {
                    return { success: false, message: 'An account with this email already exists.' };
                }
            }

            const newUser = {
                username: cleanUsername,
                name: name.trim() || cleanUsername,
                email: cleanEmail,
                password: password,
                createdAt: new Date().toISOString()
            };

            users[cleanUsername] = newUser;
            saveUsers(users);

            // Fresh work session for new user
            const newWork = Object.assign({}, DEFAULT_WORK, {
                xpPoints: 100,
                streakDays: 1,
                level: 1,
                badges: ['welcome_badge'],
                certificates: [],
                userNotes: '',
                quizAnswers: {},
                lastUpdated: new Date().toISOString()
            });
            localStorage.setItem(WORK_KEY_PREFIX + cleanUsername, JSON.stringify(newWork));

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

        signIn: function (identifier, password) {
            const users = getStoredUsers();
            const cleanId = identifier.trim().toLowerCase();

            let targetUser = users[cleanId];
            if (!targetUser) {
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

        signOut: function () {
            localStorage.removeItem(SESSION_KEY);
            this.notifySessionChange(null);
        },

        loadUserWork: function (username) {
            const user = username || (this.getCurrentUser() ? this.getCurrentUser().username : null);
            const key = user ? (WORK_KEY_PREFIX + user) : GUEST_WORK_KEY;

            try {
                const data = localStorage.getItem(key);
                if (data) {
                    return Object.assign({}, DEFAULT_WORK, JSON.parse(data));
                }
            } catch (e) {
                console.error('Error loading work state:', e);
            }

            const initialWork = Object.assign({}, DEFAULT_WORK);
            localStorage.setItem(key, JSON.stringify(initialWork));
            return initialWork;
        },

        saveUserWork: function (workData) {
            const currentUser = this.getCurrentUser();
            const key = currentUser ? (WORK_KEY_PREFIX + currentUser.username) : GUEST_WORK_KEY;

            try {
                const existing = this.loadUserWork();
                const updatedWork = Object.assign({}, existing, workData, {
                    lastUpdated: new Date().toISOString()
                });

                // Calculate level from XP
                if (updatedWork.xpPoints) {
                    updatedWork.level = Math.floor(updatedWork.xpPoints / 250) + 1;
                }

                localStorage.setItem(key, JSON.stringify(updatedWork));
                window.dispatchEvent(new CustomEvent('learnIT_workSaved', { detail: updatedWork }));
                return updatedWork;
            } catch (e) {
                console.error('Error saving user work:', e);
                return null;
            }
        },

        addXP: function (amount, reason) {
            const work = this.loadUserWork();
            const newXP = (work.xpPoints || 0) + amount;
            this.saveUserWork({ xpPoints: newXP });
            this.showToast(`+${amount} XP Earned! (${reason})`, 'success');
        },

        issueCertificate: function (courseTitle) {
            const work = this.loadUserWork();
            const user = this.getCurrentUser() || { name: 'Student' };
            const certId = 'CERT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            
            const newCert = {
                id: certId,
                title: courseTitle,
                issueDate: new Date().toISOString().split('T')[0],
                score: '100%'
            };

            const certs = work.certificates || [];
            certs.push(newCert);

            this.saveUserWork({ certificates: certs });
            this.addXP(250, 'Certificate Earned');
            return newCert;
        },

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

        notifySessionChange: function (user) {
            window.dispatchEvent(new CustomEvent('learnIT_sessionChange', { detail: user }));
        },

        showToast: function (message, type = 'info') {
            let container = document.getElementById('learnIT_toast_container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'learnIT_toast_container';
                container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; font-family: system-ui, sans-serif;';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
            toast.style.cssText = `background: ${bg}; color: #fff; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,0.3); animation: slideIn 0.3s ease; display: flex; align-items: center; gap: 8px;`;
            toast.innerHTML = `<span>${message}</span>`;
            
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        renderHeaderAuthUI: function () {
            const authContainers = document.querySelectorAll('.nav-auth-container, nav ul, nav.nav-links');
            const currentUser = this.getCurrentUser();
            const work = this.loadUserWork();

            authContainers.forEach(container => {
                let existingAuth = container.querySelector('.auth-header-widget');
                if (existingAuth) {
                    existingAuth.remove();
                }

                const widget = document.createElement('div');
                widget.className = 'auth-header-widget';
                widget.style.cssText = 'display: inline-flex; align-items: center; gap: 10px; margin-left: 15px; position: relative;';

                if (currentUser) {
                    widget.innerHTML = `
                        <div class="user-menu-dropdown-wrap" style="position: relative;">
                            <button id="userHeaderBadgeBtn" style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.12); padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); color: #fff; cursor: pointer; font-weight: 600; font-size: 13px;">
                                <span style="width: 26px; height: 26px; background: #3b82f6; color: #fff; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 12px;">
                                    ${currentUser.name.charAt(0).toUpperCase()}
                                </span>
                                <span>${currentUser.name}</span>
                                <span style="background: #facc15; color: #0f172a; padding: 2px 6px; border-radius: 10px; font-weight: 800; font-size: 10px;">
                                    Lvl ${work.level || 1}
                                </span>
                                <span>▼</span>
                            </button>
                            <div id="userHeaderMenu" style="display: none; position: absolute; right: 0; top: 120%; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; min-width: 220px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px 0; z-index: 1000;">
                                <div style="padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <div style="font-weight: 700; color: #fff; font-size: 14px;">${currentUser.name}</div>
                                    <div style="font-size: 11px; color: #94a3b8;">${currentUser.email}</div>
                                    <div style="margin-top: 6px; font-size: 11px; color: #facc15; font-weight: 700;">⚡ ${work.xpPoints || 0} XP • 🔥 ${work.streakDays || 1} Day Streak</div>
                                </div>
                                <a href="dashboard.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: #f8fafc; text-decoration: none; font-size: 13px; font-weight: 600;">📊 Student Dashboard</a>
                                <a href="playground.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: #f8fafc; text-decoration: none; font-size: 13px; font-weight: 600;">⚡ Code Playground</a>
                                <a href="css-note.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: #f8fafc; text-decoration: none; font-size: 13px; font-weight: 600;">🎨 CSS Lessons</a>
                                <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 4px 0;"></div>
                                <button id="headerLogoutBtn" style="width: 100%; text-align: left; background: transparent; border: none; padding: 10px 16px; color: #ef4444; font-weight: 700; font-size: 13px; cursor: pointer;">🚪 Sign Out</button>
                            </div>
                        </div>
                    `;
                } else {
                    widget.innerHTML = `
                        <a href="login.html" class="auth-btn-signin" style="background: #facc15; color: #0f172a; padding: 8px 18px; border-radius: 999px; font-weight: 800; text-decoration: none; font-size: 13px; transition: all 0.2s ease;">
                            Sign In / Register
                        </a>
                    `;
                }

                container.appendChild(widget);

                const badgeBtn = widget.querySelector('#userHeaderBadgeBtn');
                const menu = widget.querySelector('#userHeaderMenu');
                if (badgeBtn && menu) {
                    badgeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                    });
                    document.addEventListener('click', () => {
                        menu.style.display = 'none';
                    });
                }

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

    window.AuthEngine = AuthEngine;

    document.addEventListener('DOMContentLoaded', function () {
        AuthEngine.getStoredUsers();
        AuthEngine.renderHeaderAuthUI();
    });

})(window);
