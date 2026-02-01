// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://alibag-co-in.onrender.com/api';

console.log('CuteStay App v2.2 - Loaded'); // Cache buster
let HOTELS = []; // Will be populated from API

class App {
    constructor() {
        this.state = {
            currentView: 'home',
            selectedHotel: null,
            bookings: [],
            isLoading: true,
            isMenuOpen: false
        };
        this.mainContent = document.getElementById('main-content');
        this.navItems = document.querySelectorAll('.nav-item');

        // Menu Elements
        this.menuBtn = document.getElementById('menu-btn');
        this.sideMenu = document.getElementById('side-menu');
        this.overlay = document.getElementById('side-menu-overlay');

        this.init();
    }

    async init() {
        this.setupMenu();
        this.checkFirstTimeVisitor();

        this.renderLoading();
        try {
            await this.fetchHotels();
            this.state.isLoading = false;
            this.render();
            this.attachNavListeners();
        } catch (error) {
            console.error('Failed to load data:', error);
            this.mainContent.innerHTML = `<div style="padding: 24px; color: red;">
                <h3>Connection Error</h3>
                <p>Could not connect to: ${API_URL}</p>
                <p>Details: ${error.message}</p>
                <p>Make sure you are not blocking the site.</p>
            </div>`;
        }
    }

    setupMenu() {
        const menuItems = [
            { icon: 'explore', label: 'Explore Alibag', action: () => this.navigate('home') },
            { icon: 'beach_access', label: 'Beach Stays', action: () => this.filterCategory('Beach') },
            { icon: 'forest', label: 'Jungle Stays', action: () => this.filterCategory('Jungle') },
            { icon: 'camping', label: 'Camping', action: () => this.filterCategory('Camping') },
            { icon: 'local_offer', label: 'Special Deals', action: () => this.renderDeals() },
            { icon: 'info', label: 'About Us', action: () => this.renderAboutUs() },
        ];

        const container = this.sideMenu.querySelector('.menu-items');
        container.innerHTML = menuItems.map(item => `
            <div class="menu-item" style="display: flex; align-items: center; gap: 12px; padding: 8px; cursor: pointer; border-radius: 8px; transition: background 0.2s;">
                <span class="material-symbols-rounded" style="color: var(--text-light);">${item.icon}</span>
                <span style="font-weight: 500;">${item.label}</span>
            </div>
        `).join('');

        container.querySelectorAll('.menu-item').forEach((el, i) => {
            el.onclick = () => {
                this.toggleMenu(false);
                menuItems[i].action();
            };
        });

        this.menuBtn.onclick = () => this.toggleMenu(true);
        this.overlay.onclick = () => this.toggleMenu(false);
    }

    renderLoginModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay fade-in';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="width: 350px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3 style="margin: 0;">Admin Login 🔐</h3>
                    <button class="icon-btn" id="close-login"><span class="material-symbols-rounded">close</span></button>
                </div>
                <input type="email" id="login-email" placeholder="Email" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px;">
                <input type="password" id="login-pass" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 24px; border: 1px solid #ddd; border-radius: 8px;">
                <button class="btn btn-primary" id="login-submit" style="width: 100%;">Login</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#close-login').onclick = () => document.body.removeChild(modal);

        modal.querySelector('#login-submit').onclick = async () => {
            const email = modal.querySelector('#login-email').value;
            const password = modal.querySelector('#login-pass').value;

            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (data.success) {
                    this.state.user = data.user;
                    this.state.token = data.token;
                    document.body.removeChild(modal);
                    alert(`Welcome, ${data.user.name}!`);
                    if (data.user.role === 'admin') this.renderAdminDashboard();
                } else {
                    alert('Login Failed: ' + data.message);
                }
            } catch (e) { alert('Connection Error'); }
        };
    }

    renderAdminDashboard() {
        this.mainContent.innerHTML = `
            <div class="fade-in" style="padding: 24px;">
                <h2 style="margin-bottom: 8px;">Admin Control Center ⚡</h2>
                <p style="color: var(--text-light); margin-bottom: 32px;">Manage data and users.</p>

                <div style="background: white; padding: 24px; border-radius: 16px; border: 1px dashed var(--primary); margin-bottom: 32px;">
                    <h3 style="margin-bottom: 16px;">Bulk Import Data 📊</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 16px;">
                        Upload your 'Master-trix' CSV file here. It will append new hotels to the database.
                    </p>
                    <input type="file" id="csv-file" accept=".csv" style="margin-bottom: 16px;">
                    <button class="btn btn-primary" id="upload-btn">
                        <span class="material-symbols-rounded">upload_file</span>
                        Upload CSV
                    </button>
                </div>

                <div style="background: white; padding: 24px; border-radius: 16px; border: 1px dashed var(--primary);">
                    <h3 style="margin-bottom: 16px;">Add Single Hotel 🏨</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                        <input type="text" id="add-name" placeholder="Hotel Name" style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                        <input type="number" id="add-price" placeholder="Price (₹)" style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                        <input type="text" id="add-location" placeholder="Location" style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                        <select id="add-category" style="padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                            <option value="Villa">Villa</option>
                            <option value="Resort">Resort</option>
                            <option value="Camping">Camping</option>
                        </select>
                    </div>
                    <input type="text" id="add-image" placeholder="Image URL (Unsplash/etc)" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px;">
                    <textarea id="add-desc" placeholder="Description..." style="width: 100%; height: 80px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px;"></textarea>
                    
                    <button class="btn btn-primary" id="add-hotel-btn">
                        <span class="material-symbols-rounded">add_business</span>
                        Add Hotel
                    </button>
                </div>
            </div>
        `;

        this.mainContent.querySelector('#upload-btn').onclick = async () => {
            const fileInput = document.getElementById('csv-file');
            if (fileInput.files.length === 0) return alert('Select a file first!');

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const res = await fetch(`${API_URL}/admin/import`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.state.token}` },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Success! Imported ${data.count} hotels.`);
                } else {
                    alert('Upload Failed: ' + (data.error || 'Unknown error'));
                }
            } catch (e) { alert('Upload Error: ' + e.message); }
        };

        this.mainContent.querySelector('#add-hotel-btn').onclick = async () => {
            const name = document.getElementById('add-name').value;
            const price = document.getElementById('add-price').value;
            const location = document.getElementById('add-location').value;
            const category = document.getElementById('add-category').value;
            const image = document.getElementById('add-image').value;
            const description = document.getElementById('add-desc').value;

            if (!name || !price || !location) return alert('Name, Price, and Location are required!');

            try {
                const res = await fetch(`${API_URL}/hotels`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.state.token}`
                    },
                    body: JSON.stringify({ name, price, location, category, image, description })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Hotel Added Successfully! 🏨');
                    // Clear form
                    document.getElementById('add-name').value = '';
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (e) { alert('Connection Error: ' + e.message); }
        };
    }

    toggleMenu(show) {
        this.state.isMenuOpen = show;
        this.sideMenu.style.left = show ? '0' : '-280px';
        this.overlay.style.display = show ? 'block' : 'none';
        setTimeout(() => this.overlay.style.opacity = show ? '1' : '0', 10); // Fade effect
    }

    checkFirstTimeVisitor() {
        const hasVisited = localStorage.getItem('alibag_visited');
        if (!hasVisited) {
            setTimeout(() => {
                this.showDealsPopup();
                localStorage.setItem('alibag_visited', 'true');
            }, 1000);
        }
    }

    showDealsPopup() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 2000;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.5s;
        `;
        dialog.innerHTML = `
            <div style="background: white; width: 85%; max-width: 400px; border-radius: 24px; padding: 32px; text-align: center; transform: scale(0.9); transition: transform 0.3s;">
                <span class="material-symbols-rounded" style="font-size: 48px; color: #FFD700; margin-bottom: 16px;">celebration</span>
                <h2 style="font-size: 24px; margin-bottom: 8px;">Welcome Friend! 🌴</h2>
                <p style="color: var(--text-light); margin-bottom: 24px;">First time in Alibag? Jump directly into the best curated deals for you.</p>
                <button id="deals-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 12px;">yes! Show me Deals</button>
                <button id="close-btn" style="background: none; border: none; color: var(--text-light); font-size: 14px; text-decoration: underline;">No, just browsing</button>
            </div>
        `;
        document.body.appendChild(dialog);

        // Animate in
        requestAnimationFrame(() => {
            dialog.style.opacity = '1';
            dialog.querySelector('div').style.transform = 'scale(1)';
        });

        dialog.querySelector('#deals-btn').onclick = () => {
            document.body.removeChild(dialog);
            this.renderDeals();
        };

        dialog.querySelector('#close-btn').onclick = () => {
            document.body.removeChild(dialog);
        };
    }

    async renderDeals() {
        this.state.currentView = 'deals';
        this.mainContent.innerHTML = '<div style="padding: 40px; text-align: center;">Loading amazing deals... ✨</div>';

        try {
            const res = await fetch(`${API_URL}/specials`);
            const json = await res.json();
            const deals = json.data;

            this.mainContent.innerHTML = `
                <div class="fade-in" style="padding-bottom: 80px;">
                    <!-- Hero -->
                    <div style="background: linear-gradient(135deg, #FF9800, #FF5722); padding: 32px 24px; color: white;">
                        <h1 style="font-size: 28px; margin-bottom: 8px;">Deals Hub 🏷️</h1>
                        <p style="opacity: 0.9;">Exclusive offers curated for you.</p>
                    </div>

                    <div style="padding: 24px;">
                        ${deals.map(deal => `
                < !--Deal Card-- >
                    <div style="background: white; border-radius: 16px; overflow: hidden; margin-bottom: 24px; box-shadow: var(--shadow-card);">
                        <div style="height: 150px; background: url('${deal.image}') center/cover;">
                            <div style="background: rgba(0,0,0,0.4); height: 100%; display: flex; align-items: flex-end; padding: 16px;">
                                <span style="background: #FFD700; color: black; font-weight: 700; font-size: 12px; padding: 4px 8px; border-radius: 4px;">
                                    ${deal.discount}
                                </span>
                            </div>
                        </div>
                        <div style="padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <h3 style="font-size: 18px;">${deal.title}</h3>
                                <span style="font-size: 12px; color: #777;">Valid: ${deal.valid_until}</span>
                            </div>
                            <p style="color: var(--text-light); font-size: 14px; margin-bottom: 16px;">${deal.description}</p>

                            <div style="background: #f5f5f5; border: 1px dashed #ccc; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <code style="font-weight: 700; color: var(--text-main); font-size: 16px;">${deal.code}</code>
                                <button onclick="navigator.clipboard.writeText('${deal.code}'); this.innerText = 'Copied!';" style="border: none; background: none; color: var(--primary); font-weight: 600; cursor: pointer;">
                                    Copy Code
                                </button>
                            </div>

                            <button class="btn btn-primary" style="width: 100%; background: ${deal.text_color}; border-color: ${deal.text_color};"
                                onclick="app.filterCategory('${deal.category_filter}')">
                                Browse ${deal.category_filter} Stays
                            </button>
                        </div>
                    </div>
            `).join('')}

                        <div style="text-align: center; margin-top: 32px; color: #999; font-size: 12px;">
                            <p>T&C Apply. Offers valid on select properties.</p>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            this.mainContent.innerHTML = `<div style="padding: 40px; text-align: center; color: red;">Failed to load deals. Check connection.</div>`;
        }
    }


    filterCategory(category) {
        this.mainContent.innerHTML = '';
        this.mainContent.scrollTop = 0;
        this.renderHome(category);
    }

    async fetchHotels() {
        const response = await fetch(`${API_URL}/hotels`);
        const json = await response.json();
        HOTELS = json.data; // Update global for compatibility
    }

    renderLoading() {
        this.mainContent.innerHTML = `
            <div style="height: 100%; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <span class="material-symbols-rounded" style="font-size: 48px; color: var(--primary); animation: spin 1s infinite linear;">refresh</span>
                <p style="margin-top: 16px; color: var(--text-light);">Connecting to server...</p>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
            </div>
        `;
    }

    attachNavListeners() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = item.dataset.target;
                this.navigate(target);
            });
        });
    }

    navigate(view, state = {}) {
        this.state.currentView = view;
        if (state.hotelId) {
            this.state.selectedHotel = HOTELS.find(h => h.id === state.hotelId);
        }

        // Update Bottom Nav UI
        this.navItems.forEach(item => {
            if (item.dataset.target === view) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        this.render();
    }

    render() {
        this.mainContent.innerHTML = '';
        this.mainContent.scrollTop = 0;

        switch (this.state.currentView) {
            case 'home':
                this.renderHome();
                break;
            case 'details':
                this.renderDetails();
                break;
            case 'booking':
                this.renderBooking();
                break;
            case 'payment':
                this.renderPayment();
                break;
            case 'bookings':
                this.renderMyBookings();
                break;
            case 'favorites':
                this.renderSaved();
                break;
            case 'profile':
                this.renderProfile();
                break;
        }
    }

    renderProfile() {
        const user = JSON.parse(localStorage.getItem('alibag_user'));

        if (!user) {
            this.renderLogin();
        } else {
            this.renderDashboard(user);
        }
    }

    renderLogin(isRegister = false) {
        const container = document.createElement('div');
        container.className = 'fade-in';
        container.innerHTML = `
             <div style="padding: 40px 24px; text-align: center;">
                <div style="width: 80px; height: 80px; background: var(--primary-light); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                    <span class="material-symbols-rounded" style="font-size: 40px; color: var(--primary);">person</span>
                </div>
                <h2 style="margin-bottom: 8px;">${isRegister ? 'Join Alibag.co.in' : 'Welcome Back'}</h2>
                <p style="margin-bottom: 32px;">${isRegister ? 'Create an account to unlock deals.' : 'Sign in to manage your bookings.'}</p>

                <div style="background: white; padding: 24px; border-radius: 16px; box-shadow: var(--shadow-card); text-align: left;">
                    ${isRegister ? `
            < label style = "display: block; margin-bottom: 8px; font-weight: 500;" > Full Name</label >
                <input type="text" id="auth-name" placeholder="John Doe" style="width: 100%; padding: 12px; border: 2px solid #eee; border-radius: 8px; margin-bottom: 16px;">
                    ` : ''}

                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Email</label>
                    <input type="email" id="login-email" placeholder="name@example.com" style="width: 100%; padding: 12px; border: 2px solid #eee; border-radius: 8px; margin-bottom: 16px;">

                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Password</label>
                        <input type="password" id="login-pass" placeholder="••••••••" style="width: 100%; padding: 12px; border: 2px solid #eee; border-radius: 8px; margin-bottom: 24px;">

                            <button class="btn btn-primary" id="login-btn">${isRegister ? 'Create Account' : 'Sign In'}</button>

                            <div style="margin-top: 24px; text-align: center; font-size: 13px;">
                                <span style="color: var(--text-light);">${isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
                                <a href="#" id="toggle-auth" style="color: var(--primary); font-weight: 600; text-decoration: none;">
                                    ${isRegister ? 'Sign In' : 'Create Account'}
                                </a>
                            </div>
                        </div>
                    </div>
                    `;
        this.mainContent.innerHTML = '';
        this.mainContent.appendChild(container);

        container.querySelector('#toggle-auth').onclick = (e) => {
            e.preventDefault();
            this.renderLogin(!isRegister);
        };

        container.querySelector('#login-btn').onclick = async () => {
            const email = container.querySelector('#login-email').value;
            const password = container.querySelector('#login-pass').value;
            const name = isRegister ? container.querySelector('#auth-name').value : null;

            if (!email || !password || (isRegister && !name)) return alert('Please fill in all fields');

            const endpoint = isRegister ? '/auth/register' : '/auth/login';
            const body = isRegister ? { name, email, password } : { email, password };

            try {
                const res = await fetch(`${API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();

                if (data.success) {
                    localStorage.setItem('alibag_user', JSON.stringify(data.user));
                    this.renderProfile();
                    if (isRegister) alert('Welcome to the family! 🌴');
                } else {
                    alert(data.message);
                }
            } catch (e) {
                console.error(e);
                alert('Connection failed.');
            }
        };
    }

    renderDashboard(user) {
        const container = document.createElement('div');
        container.className = 'fade-in';
        container.innerHTML = `
                    <div style="padding: 24px;">
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">
                            <div style="width: 64px; height: 64px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">
                                ${user.name.charAt(0)}
                            </div>
                            <div>
                                <h2 style="margin-bottom: 4px;">Hello, ${user.name} 👋</h2>
                                <p style="font-size: 13px;">${user.email}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                            <div class="stat-card" style="background: white; padding: 16px; border-radius: 16px; box-shadow: var(--shadow-card); text-align: center;">
                                <span class="material-symbols-rounded" style="color: var(--primary); font-size: 28px; margin-bottom: 8px;">luggage</span>
                                <div style="font-weight: 700; font-size: 20px;">${this.state.bookings.length}</div>
                                <div style="font-size: 12px; color: var(--text-light);">Trips</div>
                            </div>
                            <div class="stat-card" style="background: white; padding: 16px; border-radius: 16px; box-shadow: var(--shadow-card); text-align: center;">
                                <span class="material-symbols-rounded" style="color: #FFD700; font-size: 28px; margin-bottom: 8px;">star</span>
                                <div style="font-weight: 700; font-size: 20px;">0</div>
                                <div style="font-size: 12px; color: var(--text-light);">Reviews</div>
                            </div>
                        </div>

                        <h3 style="margin-bottom: 16px;">Account Settings</h3>
                        <div style="background: white; border-radius: 16px; box-shadow: var(--shadow-card); overflow: hidden;">
                            ${[
                { icon: 'person', label: 'Personal Information' },
                { icon: 'credit_card', label: 'Payments & Payouts' },
                { icon: 'notifications', label: 'Notifications' },
                { icon: 'shield', label: 'Privacy & Sharing' }
            ].map(item => `
                        <div style="padding: 16px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #f5f5f5; cursor: pointer;">
                            <span class="material-symbols-rounded" style="color: var(--text-light);">${item.icon}</span>
                            <span style="flex: 1; font-weight: 500;">${item.label}</span>
                            <span class="material-symbols-rounded" style="color: #ddd;">chevron_right</span>
                        </div>
                    `).join('')}
                        </div>

                        <button id="logout-btn" style="width: 100%; padding: 16px; margin-top: 32px; background: #FFEBEE; color: #D32F2F; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                            Log Out
                        </button>
                    </div>
                    `;
        this.mainContent.appendChild(container);

        container.querySelector('#logout-btn').onclick = () => {
            localStorage.removeItem('alibag_user');
            this.renderProfile();
        };
    }

    renderHome(filter = null) {
        const header = document.createElement('div');

        // Filter Data
        const displayHotels = filter ? HOTELS.filter(h => h.category === filter || (filter === 'Couple' && h.category === 'Villa')) : HOTELS;

        header.innerHTML = `
                    <h1 style="color: var(--primary);">Alibag.co.in 🌴</h1>
                    <p>Verified stays. Human confirmed.</p>
                    <div style="margin: 24px 0; display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;">
                        ${['All', 'Beach', 'Villa', 'Camping', 'Jungle'].map((tag, i) => `
                    <button style="
                        padding: 8px 16px; 
                        border-radius: 20px; 
                        border: none; 
                        background: ${filter && filter === tag ? 'var(--primary)' : (!filter && i === 0) ? 'var(--primary)' : 'var(--surface)'}; 
                        color: ${filter && filter === tag ? 'white' : (!filter && i === 0) ? 'white' : 'var(--text-light)'};
                        font-weight: 600;
                        white-space: nowrap;
                    " onclick="app.filterCategory('${tag === 'All' ? '' : tag}')">${tag}</button>
                `).join('')}
                    </div>
                    `;
        this.mainContent.appendChild(header);

        displayHotels.forEach((hotel, index) => {
            const card = document.createElement('div');
            card.className = 'hotel-card fade-in';
            // card.onclick = () => this.navigate('details', {hotelId: hotel.id }); // Moved to content click

            const images = hotel.images || [hotel.image];
            let currentImgIdx = 0;
            const cardId = `hotel-card-${hotel.id}`;

            card.innerHTML = `
                    <div style="position: relative; height: 200px; background: #eee;">
                        <img id="${cardId}-img" src="${images[0]}" class="card-image" alt="${hotel.name}" style="transition: opacity 0.3s;">

                            <button class="icon-btn" style="
                        position: absolute; top: 12px; right: 12px; 
                        background: rgba(255,255,255,0.9); width: 32px; height: 32px;
                        color: ${this.isSaved(hotel.id) ? 'red' : '#ccc'};
                    " onclick="event.stopPropagation(); app.toggleSave(${hotel.id})">
                                <span class="material-symbols-rounded" style="font-size: 20px;">favorite</span>
                            </button>

                            ${images.length > 1 ? `
                        <button class="icon-btn" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; background: rgba(255,255,255,0.8);" onclick="event.stopPropagation(); window.prevImg(${hotel.id}, 'hotel-card')">
                            <span class="material-symbols-rounded" style="font-size: 18px;">chevron_left</span>
                        </button>
                        <button class="icon-btn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; background: rgba(255,255,255,0.8);" onclick="event.stopPropagation(); window.nextImg(${hotel.id}, 'hotel-card')">
                            <span class="material-symbols-rounded" style="font-size: 18px;">chevron_right</span>
                        </button>
                        <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px;">
                            ${images.map((_, i) => `<div id="${cardId}-dot-${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? 'white' : 'rgba(255,255,255,0.5)'};"></div>`).join('')}
                        </div>
        ` : ''}
                </div>
                <div class="card-content" onclick="app.navigate('details', { hotelId: ${hotel.id} })">
                    <div class="card-header">
                        <h3>${hotel.name}</h3>
                        <div style="display: flex; align-items: center; gap: 4px; color: #FFB400; font-weight: 600;">
                            <span class="material-symbols-rounded" style="font-size: 16px;">star</span>
                            <span>${hotel.rating}</span>
                        </div>
                    </div>
                        </div>
                    </div>
                    <div class="price-tag">₹${hotel.price} / night</div>
                    <div class="location-chip">
                        <span class="material-symbols-rounded" style="font-size: 14px;">location_on</span>
                        <span>${hotel.location}</span>
                    </div>
                </div>
            `;
            this.mainContent.appendChild(card);
        });

        // Global helpers for inline onclicks (Hack for vanilla JS scope)
        window.nextImg = (id, prefix = 'hotel-card') => this.rotateImage(id, 1, prefix);
        window.prevImg = (id, prefix = 'hotel-card') => this.rotateImage(id, -1, prefix);
        window.app = this;
    }

    rotateImage(id, dir, prefix = 'hotel-card') {
        const hotel = HOTELS.find(h => h.id == id);
        if (!hotel || !hotel.images) return;

        const imgEl = document.getElementById(`${prefix}-${id}-img`);
        if (!imgEl) return;

        let currentSrc = imgEl.src;
        // Lax match to handle full URLs vs relative
        let currentIdx = hotel.images.findIndex(img => currentSrc.includes(img) || img.includes(currentSrc));
        if (currentIdx === -1) currentIdx = 0;

        let newIdx = currentIdx + dir;
        if (newIdx >= hotel.images.length) newIdx = 0;
        if (newIdx < 0) newIdx = hotel.images.length - 1;

        // Transition
        imgEl.style.opacity = '0.5';
        setTimeout(() => {
            imgEl.src = hotel.images[newIdx];
            imgEl.style.opacity = '1';
        }, 150);

        // Update dots
        hotel.images.forEach((_, i) => {
            const dot = document.getElementById(`${prefix}-${id}-dot-${i}`);
            if (dot) dot.style.background = i === newIdx ? 'white' : 'rgba(255,255,255,0.5)';
        });
    }

    renderDetails() {
        const hotel = this.state.selectedHotel;
        if (!hotel) return this.navigate('home');

        // CLEAR CONTENT TO PREVENT DUPLICATES
        this.mainContent.innerHTML = '';
        this.mainContent.scrollTop = 0;

        const images = hotel.images ? hotel.images : [hotel.image];

        const container = document.createElement('div');
        container.className = 'fade-in';
        container.innerHTML = `
            <div class="details-hero" style="overflow-x: auto; display: flex; scroll-snap-type: x mandatory;">
                <button class="icon-btn back-btn" id="back-btn" style="position: fixed;">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
                ${images.map(img => `
        <img src = "${img}" style = "
    min - width: 100 %;
    height: 100 %;
    object - fit: cover;
    scroll - snap - align: center;
    ">
        `).join('')}
            </div>
            <div style="padding-bottom: 80px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">
                    <div>
                        <h2>${hotel.name}</h2>
                        <div class="location-chip">
                            <span class="material-symbols-rounded" style="font-size: 16px;">location_on</span>
                            ${hotel.location}
                        </div>
                    </div>
                    <div class="price-tag" style="font-size: 18px;">₹${hotel.price}</div>
                </div>
                
                <p style="margin-bottom: 24px;">${hotel.description || "A lovely stay verified by Alibag.co.in."}</p>

                <!-- Room Types Table -->
                ${hotel.roomTypes && hotel.roomTypes.length > 0 ? `
        < h3 style = "margin-bottom: 12px;" > Available Rooms</h3 >
            <div style="background: white; border-radius: 16px; border: 1px solid #eee; overflow: hidden; margin-bottom: 24px;">
                ${hotel.roomTypes.map((r, idx) => `
                            <div class="room-row" onclick="app.selectRoomForBooking(${idx}, ${hotel.id})" style="
                                padding: 16px; 
                                border-bottom: 1px solid #eee; 
                                display: flex; 
                                justify-content: space-between; 
                                align-items: center;
                                cursor: pointer;
                                transition: background 0.2s;
                            ">
                                <div>
                                    <div style="font-weight: 600; font-size: 14px;">${r.name}</div>
                                    <div style="font-size: 12px; color: var(--text-light);">${r.description || 'Standard amenities included'}</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-weight: 700; color: var(--primary);">₹${r.price}</span>
                                    <span class="material-symbols-rounded" style="color: #ddd;">chevron_right</span>
                                </div>
                            </div>
                        `).join('')}
            </div>
    ` : ''}

                <h3 style="margin-bottom: 12px;">Amenities</h3>
                <div style="display: flex; gap: 16px; margin-bottom: 32px;">
                    ${['Wifi', 'Pool', 'Breakfast'].map(icon => `
        <div> style = "
    width: 60px; height: 60px;
    background: var(--primary - light);
    border - radius: var(--radius - sm);
    display: flex;
    align - items: center;
    justify - content: center;
    color: var(--primary);
    font - size: 12px;
    flex - direction: column;
    gap: 4px;
    ">
        <span class="material-symbols-rounded" >${icon === 'Wifi' ? 'wifi' : icon === 'Pool' ? 'pool' : 'restaurant'}</span >
            <span>${icon}</span>
                        </div >
        `).join('')}
                </div>

                <!-- Reviews Section -->
                <div style="margin-bottom: 32px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3>Reviews (${hotel.reviews ? hotel.reviews.length : 0})</h3>
                        <span style="color: #FFB400; font-weight: 600;">★ ${hotel.rating}</span>
                    </div>
                    
                    ${hotel.reviews && hotel.reviews.length > 0 ? hotel.reviews.map(review => `
        <div> style = "background: white; padding: 16px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);" >
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="font-weight: 600;">${review.user}</span>
                                <span style="font-size: 12px; color: var(--text-light);">${review.date}</span>
                            </div>
                            <div style="color: #FFB400; font-size: 12px; margin-bottom: 8px;">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                            <p style="font-size: 14px; margin-bottom: ${review.reply ? '12px' : '0'};">${review.text}</p>
                            
                            ${review.reply ? `
                                <div style="background: #F5F5F5; padding: 12px; border-radius: 8px; border-left: 3px solid var(--primary);">
                                    <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px; color: var(--primary);">Response from Owner</div>
                                    <p style="font-size: 13px; font-style: italic;">"${review.reply}"</p>
                                </div>
                            ` : ''
            }
                        </div >
        `).join('') : '<p>No reviews yet. Be the first!</p>'}

                    <button class="btn" style="width: 100%; border: 1px solid #eee; background: white; color: var(--text-main);" onclick="app.renderReviewModal(${hotel.id})">
                        Write a Review
                    </button>
                </div>

                <button class="btn btn-primary" id="book-now-btn">
                    <span>Check Availability</span>
                    <span class="material-symbols-rounded">calendar_month</span>
                </button>
            </div>
        `;

        this.mainContent.appendChild(container);

        container.querySelector('#back-btn').onclick = () => this.navigate('home');
        container.querySelector('#book-now-btn').onclick = () => this.navigate('booking', { hotelId: hotel.id });
    }

    renderReviewModal(hotelId) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 2000;
            display: flex; align-items: end; justify-content: center;
        `;
        modal.innerHTML = `
             <div class="fade-in-up" style="
                background: white; width: 100%; max-width: 500px;
                border-radius: 24px 24px 0 0; padding: 24px;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
             ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3 style="font-size: 20px;">Write a Review ✍️</h3>
                    <button id="close-modal" style="background:none; border:none; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 24px;">
                    ${[1, 2, 3, 4, 5].map(i => `
        <span class="material-symbols-rounded star-btn" data - val="${i}" style = "
    font - size: 32px; color: #ddd; cursor: pointer;
    ">star</span>
        `).join('')}
                </div>
                <input type="hidden" id="review-rating" value="0">

                <textarea id="review-text" placeholder="Share your experience... (minimum 10 chars)" style="
                    width: 100%; height: 120px; border: 2px solid #eee; border-radius: 12px; padding: 16px;
                    font-family: inherit; margin-bottom: 24px; resize: none;
                "></textarea>

                <button class="btn btn-primary" id="submit-review" style="width: 100%;">Submit Review</button>
             </div>
        `;
        document.body.appendChild(modal);

        // Star Logic
        const stars = modal.querySelectorAll('.star-btn');
        stars.forEach(star => {
            star.onclick = () => {
                const val = parseInt(star.dataset.val);
                document.getElementById('review-rating').value = val;
                stars.forEach((s, i) => {
                    s.style.color = i < val ? '#FFB400' : '#ddd';
                });
            };
        });

        // Close Logic
        modal.querySelector('#close-modal').onclick = () => document.body.removeChild(modal);
        modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

        // Submit Logic
        modal.querySelector('#submit-review').onclick = async () => {
            const rating = document.getElementById('review-rating').value;
            const text = document.getElementById('review-text').value;
            const user = JSON.parse(localStorage.getItem('alibag_user'));

            if (rating == 0) return alert('Please select a rating!');
            if (text.length < 10) return alert('Please tell us a bit more (min 10 chars).');

            // Content Moderation (Client-side fast check)
            const forbidden = ['damn', 'stupid', 'awful', 'hate', 'badword'];
            const hasForbidden = forbidden.some(w => text.toLowerCase().includes(w));
            const hasPhone = /\b\d{10}\b/.test(text);
            const hasEmail = /\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/.test(text);

            if (hasForbidden || hasPhone || hasEmail) {
                return alert('Review contains restricted content (profanity or personal info). Please revise.');
            }

            try {
                // Submit to Backend
                const res = await fetch(`${API_URL}/hotels/${hotelId}/reviews`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: user ? user.name : 'Anonymous',
                        userId: user ? user.id : null,
                        rating: rating,
                        text: text
                    })
                });

                const data = await res.json();

                if (!data.success) throw new Error(data.message || 'Failed');

                // Update local hotel data with new rating/review
                const hotel = HOTELS.find(h => h.id == hotelId);
                if (hotel) {
                    // The backend returns the new review and rating, let's update local state
                    // Ideally we re-fetch, but for speed we patch:
                    if (!hotel.reviews) hotel.reviews = [];
                    hotel.reviews.unshift(data.data);
                    if (data.newRating) hotel.rating = data.newRating;
                }

                document.body.removeChild(modal);
                this.renderDetails(); // Re-render to show new review
            } catch (e) {
                console.error(e);
                alert('Failed to submit review.');
            }
        };
    }

    renderBooking() {
        const hotel = this.state.selectedHotel;
        const container = document.createElement('div');
        container.className = 'fade-in';
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <button class="icon-btn" id="back-btn-booking">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
                <h2>Select Dates</h2>
            </div>
            
            <div style="background: white; padding: 24px; border-radius: var(--radius-md); box-shadow: var(--shadow-card); margin-bottom: 24px;">
                ${hotel.roomTypes && hotel.roomTypes.length > 0 ? `
        < label style = "display: block; margin-bottom: 12px; font-weight: 500;" > Select Room Type</label >
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                ${hotel.roomTypes.map((room, i) => `
                            <label style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #eee; border-radius: 12px; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <input type="radio" name="room-type" value="${i}" ${i === 0 ? 'checked' : ''}>
                                    <div>
                                        <div style="font-weight: 600;">${room.name}</div>
                                        <div style="font-size: 11px; color: var(--text-light);">${room.description}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 700;">₹${room.price}</div>
                            </label>
                        `).join('')}
            </div>
    ` : ''}

                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Check-in</label>
                <input type="date" style="
                    width: 100%; 
                    padding: 16px; 
                    border: 2px solid var(--background); 
                    border-radius: var(--radius-sm); 
                    font-family: inherit;
                    margin-bottom: 16px;
                " id="check-in">
                
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Check-out</label>
                <input type="date" style="
                    width: 100%; 
                    padding: 16px; 
                    border: 2px solid var(--background); 
                    border-radius: var(--radius-sm); 
                    font-family: inherit;
                " id="check-out">
            </div>

            <div style="background: var(--primary-light); padding: 24px; border-radius: var(--radius-md); margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span id="price-calc-text">Wait Price</span>
                    <span id="price-calc-total">--</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px;">
                    <span>Total</span>
                    <span id="final-total">--</span>
                </div>
            </div>

            <button class="btn btn-primary" id="confirm-dates-btn" disabled style="opacity: 0.5; cursor: not-allowed;">
                <span>Continue to Payment</span>
            </button>
        `;

        this.mainContent.appendChild(container);

        const checkIn = container.querySelector('#check-in');
        const checkOut = container.querySelector('#check-out');
        const confirmBtn = container.querySelector('#confirm-dates-btn');
        const priceText = container.querySelector('#price-calc-text');
        const priceTotal = container.querySelector('#price-calc-total');
        const finalTotal = container.querySelector('#final-total');
        const roomRadios = container.querySelectorAll('input[name="room-type"]');

        // Set min date
        const today = new Date().toISOString().split('T')[0];
        checkIn.min = today;
        checkOut.min = today;

        const updatePrice = () => {
            // Get selected room price
            let currentPrice = hotel.price;
            let selectedRoom = null;

            const checkedRadio = container.querySelector('input[name="room-type"]:checked');
            if (checkedRadio && hotel.roomTypes) {
                const idx = parseInt(checkedRadio.value);
                currentPrice = hotel.roomTypes[idx].price;
                selectedRoom = hotel.roomTypes[idx];
            }

            if (checkIn.value && checkOut.value) {
                const start = new Date(checkIn.value);
                const end = new Date(checkOut.value);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    const total = diffDays * currentPrice;
                    priceText.textContent = `${diffDays} night${diffDays > 1 ? 's' : ''}`;
                    priceTotal.textContent = `₹${currentPrice} x ${diffDays}`;
                    finalTotal.textContent = `₹${total}`;

                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';

                    this.state.tempBooking = {
                        hotel: hotel,
                        roomType: selectedRoom,
                        checkIn: checkIn.value,
                        checkOut: checkOut.value,
                        nights: diffDays,
                        totalPrice: total
                    };
                } else {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.5';
                }
            }
        };

        checkIn.addEventListener('change', updatePrice);
        checkOut.addEventListener('change', updatePrice);
        roomRadios.forEach(r => r.addEventListener('change', updatePrice));

        container.querySelector('#back-btn-booking').onclick = () => this.navigate('details', { hotelId: hotel.id });

        confirmBtn.onclick = () => {
            if (!this.state.tempBooking) return;
            this.navigate('payment'); // State is already in tempBooking
        };
    }

    renderPayment() {
        if (!this.state.tempBooking) return this.navigate('home');
        const booking = this.state.tempBooking;

        const container = document.createElement('div');
        container.className = 'fade-in';
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">
                <button class="icon-btn" id="back-btn-payment">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
                <h2>Confirm & Pay</h2>
            </div>

            <div style="background: white; padding: 24px; border-radius: var(--radius-md); box-shadow: var(--shadow-card); margin-bottom: 24px;">
                <h3 style="margin-bottom: 16px;">Booking Summary</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                     <span>Dates</span>
                     <b>${booking.checkIn} - ${booking.checkOut}</b>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; color: var(--primary);">
                     <span>Total Due</span>
                     <span>₹${booking.totalPrice}</span>
                </div>
                <p style="font-size: 12px; color: var(--text-light); margin-top: 16px;">
                    * You will not be charged until the host confirms.
                </p>
            </div>

            <button class="btn btn-primary" id="pay-btn" style="background: var(--success); color: var(--text-main);">
                <span>Request to Book</span>
                <span class="material-symbols-rounded">check_circle</span>
            </button>
         `;

        this.mainContent.appendChild(container);

        container.querySelector('#back-btn-payment').onclick = () => this.navigate('booking');

        container.querySelector('#pay-btn').onclick = () => {
            this.state.bookings.push({
                ...booking,
                id: Date.now(),
                status: 'PENDING_CONFIRMATION'
            });
            this.state.tempBooking = null;
            // Alibag.co.in 5-min promise alert
            alert('Request Sent! 📨\n\nWe are checking with the host (Kenji). You will receive a confirmation within 5 minutes.');
            this.navigate('bookings');
        };
    }

    renderMyBookings() {
        this.mainContent.innerHTML = `<h2>My Trips</h2>`;

        if (this.state.bookings.length === 0) {
            this.mainContent.innerHTML += `
                <div style="text-align: center; padding: 48px; color: var(--text-light);">
                    <span class="material-symbols-rounded" style="font-size: 48px;">beach_access</span>
                    <p>No trips planned yet.</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'fade-in';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '16px';

        this.state.bookings.forEach(booking => {
            const isPending = booking.status === 'PENDING_CONFIRMATION';
            const statusColor = isPending ? '#FFB400' : 'var(--success)';

            const item = document.createElement('div');
            item.style.cssText = `
                background: white; padding: 16px; border-radius: var(--radius-md);
                box-shadow: var(--shadow-card); display: flex; gap: 16px; align-items: center; margin-bottom: 16px;
            `;
            const mainImage = booking.hotel.images ? booking.hotel.images[0] : booking.hotel.image;
            item.innerHTML = `
                <img src="${mainImage}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">
                <div style="flex: 1;">
                    <h3 style="font-size: 16px; margin-bottom: 4px;">${booking.hotel.name}</h3>
                    <div style="font-size: 13px; color: var(--text-light); margin-bottom: 4px;">
                        ${booking.checkIn} — ${booking.checkOut}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="
                            font-size: 11px; 
                            background: ${statusColor}20; 
                            color: ${statusColor};
                            padding: 4px 8px; 
                            border-radius: 8px; 
                            font-weight: 700;
                        ">${booking.status.replace('_', ' ')}</span>
                        <span style="font-weight: 700;">₹${booking.totalPrice}</span>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
        this.mainContent.appendChild(list);
    }

    renderPlaceholder(title) {
        this.mainContent.innerHTML = `
            <h2>${title.charAt(0).toUpperCase() + title.slice(1)}</h2>
            <p>Coming soon...</p>
        `;
    }

    toggleSave(hotelId) {
        let saved = JSON.parse(localStorage.getItem('alibag_saved')) || [];
        const idx = saved.indexOf(hotelId);

        let msg = '';
        if (idx === -1) {
            saved.push(hotelId);
            msg = 'Saved to Wishlist ❤️';
        } else {
            saved.splice(idx, 1);
            msg = 'Removed from Wishlist 💔';
        }

        localStorage.setItem('alibag_saved', JSON.stringify(saved));
        this.render();

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
            border-radius: 24px; font-size: 13px; z-index: 3000;
            animation: fadeIn 0.3s;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 2000);
    }

    isSaved(hotelId) {
        const saved = JSON.parse(localStorage.getItem('alibag_saved')) || [];
        return saved.includes(hotelId);
    }

    renderAboutUs() {
        // SEO Content
        this.mainContent.innerHTML = `
            <div class="fade-in" style="padding-bottom: 40px;">
                <div style="background: var(--primary-light); padding: 40px 24px; text-align: center; border-radius: 0 0 24px 24px; margin-bottom: 32px; margin-top: -24px;">
                    <div style="width: 64px; height: 64px; background: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 16px; color: var(--primary);">
                        <span class="material-symbols-rounded" style="font-size: 32px;">water_lux</span>
                    </div>
                    <h1 style="color: var(--primary); font-size: 28px; margin-bottom: 8px;">About Alibag.co.in</h1>
                    <p style="color: var(--text-main);">Your trusted companion for Verified Coastal Stays.</p>
                </div>

                <div style="padding: 0 24px;">
                    <section style="margin-bottom: 40px;">
                        <h2 style="font-size: 20px; margin-bottom: 12px;">🌴 Why Choose Us?</h2>
                        <p style="color: var(--text-light); line-height: 1.6; margin-bottom: 16px;">
                            Searching for an <strong>affordable weekend resort in Alibag</strong>? We understand the struggle of finding clean, verified, and budget-friendly stays. Alibag.co.in is a hyperlocal platform dedicated to curating the best <strong>villas, cottages, and beach resorts</strong> in Alibaug.
                        </p>
                        <p style="color: var(--text-light); line-height: 1.6;">
                            Each property is human-verified to ensure no surprises when you arrive. Whether you are looking for a <strong>luxury villa with private pool</strong> or a simple <strong>1-day stay in Alibag</strong>, we have something for every traveler.
                        </p>
                    </section>
                    
                    <section style="margin-bottom: 40px;">
                        <h2 style="font-size: 20px; margin-bottom: 12px;">🚗 How to Reach Alibag</h2>
                        <div style="background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow-card);">
                            <div style="margin-bottom: 16px;">
                                <h3 style="font-size: 16px; margin-bottom: 4px;">⛴️ By Ferry (Mumbai to Alibag)</h3>
                                <p style="font-size: 13px; color: var(--text-light);">
                                    The fastest way! Take a Ro-Ro Ferry (M2M) or Catamaran from <strong>Gateway of India</strong> or <strong>Bhaucha Dhakka</strong> to Mandwa Jetty. It takes approx 45-60 mins. Buses and autos are available from Mandwa to Alibag city (30 mins).
                                </p>
                            </div>
                            <div>
                                <h3 style="font-size: 16px; margin-bottom: 4px;">🚘 By Road</h3>
                                <p style="font-size: 13px; color: var(--text-light);">
                                    Enjoy a scenic drive via the Mumbai-Goa highway. Distance is approx 95km from Mumbai (3-4 hours) and 140km from Pune (3.5 hours). Perfect for a <strong>weekend road trip</strong>.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 40px;">
                        <h2 style="font-size: 20px; margin-bottom: 12px;">🥥 Our Offerings</h2>
                        <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            ${[
                'Beachfront Resorts', 'Private Pool Villas', 'Jungle Camping',
                'Couple Friendly Stays', 'Group Cottages', 'Pet Friendly Stays'
            ].map(item => `
                <li style="
                    background: white; padding: 12px; border-radius: 8px; border: 1px solid #eee;
                    font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;
                ">
                    <span class="material-symbols-rounded" style="font-size: 16px; color: var(--success);">check_circle</span>
                    ${item}
                </li>
            `).join('')}
                        </ul>
                    </section>

                    <div style="background: #f9f9f9; padding: 24px; border-radius: 16px; font-size: 12px; color: #999;">
                        <strong>Popular Searches:</strong>
                        <p style="margin-top: 8px;">
                            Resorts in Nagaon beach, Varsoli beach cottages, hotel booking alibaug, cheap hotels in alibaug near beach under 2000, best family villa in alibaug, alibag camping near revdanda beach, weekend getaways from mumbai, places to visit in alibaug.
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: var(--text-light);">© 2025 Alibag.co.in Tech Pvt Ltd.</p>
                        <p style="font-size: 12px; color: var(--text-light);">Made with ❤️ in Alibag.</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderSaved() {
        // Filter hotels that are in the saved list
        const savedIds = JSON.parse(localStorage.getItem('alibag_saved')) || [];
        const savedHotels = HOTELS.filter(h => savedIds.includes(h.id));

        this.mainContent.innerHTML = `
            <div class="fade-in" style="padding: 24px;">
                <h2 style="font-size: 24px; margin-bottom: 24px;">My Wishlist (${savedHotels.length}) ❤️</h2>
                
                ${savedHotels.length === 0 ? `
                    <div style="text-align: center; margin-top: 60px; color: var(--text-light);">
                        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">heart_broken</span>
                        <p style="margin-top: 16px;">No saved stays yet.</p>
                        <button class="btn btn-primary" style="margin-top: 24px;" onclick="app.navigate('home')">Explore Stays</button>
                    </div>
                ` : `
                <div style="display: grid; gap: 24px;">
                        ${savedHotels.map(hotel => {
            const images = hotel.images || ['https://via.placeholder.com/400x300'];
            const nearness = hotel.description && (hotel.description.includes('Within') || hotel.description.includes('Beach-Touch'))
                ? hotel.description.split('.')[0]
                : null;

            return `
                            <div class="card" onclick="app.navigate('details', { hotelId: ${hotel.id} })">
                                <div style="position: relative; height: 200px; background: #eee;">
                                    <img src="${images[0]}" class="card-image">
                                    <button class="icon-btn" style="
                                        position: absolute; top: 12px; right: 12px; 
                                        background: rgba(255,255,255,0.9); width: 32px; height: 32px;
                                        color: ${this.isSaved(hotel.id) ? 'red' : 'var(--text-main)'};
                                    " onclick="event.stopPropagation(); app.toggleSave(${hotel.id})">
                                        <span class="material-symbols-rounded" style="font-size: 20px;">favorite</span>
                                    </button>
                                    ${nearness ? `<span style="position: absolute; bottom: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">📍 ${nearness}</span>` : ''}
                                </div>
                                <div class="card-content">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <h3 style="font-size: 16px;">${hotel.name}</h3>
                                        <div style="display: flex; align-items: center; gap: 4px; font-weight: 600;">
                                            <span class="material-symbols-rounded" style="font-size: 16px; color: var(--primary);">star</span>
                                            <span>${hotel.rating}</span>
                                        </div>
                                    </div>
                                    <p style="color: var(--text-light); font-size: 13px; margin-bottom: 8px;">${hotel.location}</p>
                                    
                                    ${hotel.roomTypes && hotel.roomTypes.length > 0 ? `
                                        <div style="margin: 8px 0; background: #f9f9f9; padding: 8px; border-radius: 8px; border: 1px dashed #eee;">
                                            <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-light); text-transform: uppercase;">Room Rates</div>
                                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                                ${hotel.roomTypes.map(r => `
                                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #555;">
                                                        <span>${r.name}</span>
                                                        <span style="font-weight: 600; color: var(--text-main);">₹${r.price}</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}

                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                        <div>
                                            <span style="font-weight: 700; font-size: 16px;">₹${hotel.price}</span>
                                            <span style="font-size: 12px; font-weight: 400; color: var(--text-light);"> / night</span>
                                        </div>
                                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Check Availability</button>
                                    </div>
                                </div>
                                </div>
                            </div>
                           `;
        }).join('')
            }
                    </div >
        `}
            </div>
        `;
    }

    renderNotifications() {
        // Mock Notifications
        const notifs = [
            { title: "Welcome to Alibag!", body: "Find your perfect weekend getaway.", time: "Just now", icon: "celebration" },
            { title: "Flash Deal ⚡", body: "20% off on Jungle Stays this weekend.", time: "2 hours ago", icon: "local_offer" }
        ];

        this.mainContent.innerHTML = `
            <div class="fade-in" style="padding: 24px;">
                <h2 style="font-size: 24px; margin-bottom: 24px;">Notifications 🔔</h2>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${notifs.map(n => `
                        <div style="background: white; padding: 16px; border-radius: 16px; display: flex; gap: 16px; box-shadow: var(--shadow-card);">
                            <div style="width: 48px; height: 48px; background: var(--primary-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                                <span class="material-symbols-rounded">${n.icon}</span>
                            </div>
                            <div>
                                <h3 style="font-size: 16px; margin-bottom: 4px;">${n.title}</h3>
                                <p style="font-size: 13px; color: var(--text-light); margin-bottom: 8px;">${n.body}</p>
                                <span style="font-size: 11px; color: #999;">${n.time}</span>
                            </div>
                        </div >
        `).join('')}
                </div>
            </div>
        `;
    }
    setupMenu() {
        // Define Menu Structure
        const menuItems = [
            // Stays Dropdown Group
            {
                id: 'stays-group',
                icon: 'bed',
                label: 'Stays',
                isDropdown: true,
                children: [
                    { icon: 'beach_access', label: 'Beach Stays', action: () => this.filterCategory('Beach') },
                    { icon: 'forest', label: 'Jungle Stays', action: () => this.filterCategory('Jungle') },
                    { icon: 'camping', label: 'Camping', action: () => this.filterCategory('Camping') }
                ]
            },
            { icon: 'local_offer', label: 'Special Deals', action: () => this.renderDeals() },
            { icon: 'favorite', label: 'Saved', action: () => this.renderSaved() },
            { icon: 'info', label: 'About Us', action: () => this.renderAboutUs() },
            { icon: 'admin_panel_settings', label: 'Admin Login', action: () => this.renderLoginModal() }
        ];

        const container = this.sideMenu.querySelector('.menu-items');

        // Helper to render items
        const renderItem = (item, index) => {
            if (item.isDropdown) {
                return `
                    <div class="menu-item" onclick="app.toggleSubMenu('${item.id}')" style="justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="material-symbols-rounded" style="color: var(--text-light);">${item.icon}</span>
                            <span style="font-weight: 500;">${item.label}</span>
                        </div>
                        <span class="material-symbols-rounded" id="${item.id}-arrow" style="font-size: 20px; transition: transform 0.3s; color: var(--text-light);">expand_more</span>
                    </div>
                    <div id="${item.id}" style="display: none; padding-left: 12px; overflow: hidden; transition: max-height 0.3s ease-out;">
                        ${item.children.map((child, childIdx) => `
                        <div class="menu-item" onclick="app.menuAction(${index}, ${childIdx})" style="font-size: 14px;">
                                <span class="material-symbols-rounded" style="color: var(--text-light); font-size: 20px;">${child.icon}</span>
                                <span style="font-weight: 500;">${child.label}</span>
                            </div>
        `).join('')}
                    </div>
                `;
            }
            return `
                <div class="menu-item" onclick="app.menuAction(${index})">
                    <span class="material-symbols-rounded" style="color: var(--text-light);">${item.icon}</span>
                    <span style="font-weight: 500;">${item.label}</span>
                </div>
            `;
        };

        container.innerHTML = `
            <div id="menu-header" style="padding: 24px; border-bottom: 1px solid #eee; margin-bottom: 16px; cursor: pointer;">
                <h2 style="font-size: 24px; color: var(--primary);">Explore Alibag 🌴</h2>
                <p style="color: var(--text-light); font-size: 13px;">Your gateway to paradise.</p>
            </div>
            ${menuItems.map((item, i) => renderItem(item, i)).join('')}
        `;

        // Header Click Action -> Home
        container.querySelector('#menu-header').onclick = () => {
            this.toggleMenu(false);
            this.navigate('home');
        };

        // Store items for callback
        this.menuItemsData = menuItems;

        // Restore Event Listeners
        if (this.menuBtn) this.menuBtn.onclick = () => this.toggleMenu(true);
        if (this.overlay) this.overlay.onclick = () => this.toggleMenu(false);
    }

    toggleSubMenu(id) {
        const el = document.getElementById(id);
        const arrow = document.getElementById(id + '-arrow');
        if (el) {
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? 'block' : 'none';
            if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    menuAction(index, childIndex = null) {
        this.toggleMenu(false);
        const item = this.menuItemsData[index];
        if (childIndex !== null && item.children) {
            item.children[childIndex].action();
        } else if (item.action) {
            item.action();
        }
    }

    selectRoomForBooking(roomIdx, hotelId) {
        const hotel = HOTELS.find(h => h.id === hotelId);
        if (!hotel || !hotel.roomTypes) return;

        this.navigate('booking', { hotelId: hotel.id });

        // Helper to check the radio button after navigation
        setTimeout(() => {
            const radios = document.querySelectorAll('input[name="room-type"]');
            if (radios[roomIdx]) {
                radios[roomIdx].click();
            }
        }, 100);
    }
}
window.app = new App();
