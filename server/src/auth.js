const users = [
    { id: 'u_1', name: 'Rahul', email: 'rahul@alibag.co.in', password: 'admin', phone: '+91 98765 43210' }
];

module.exports = {
    login: (req, res) => {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            // In a real app, send a JWT token here
            const { password, ...safeUser } = user;
            res.json({ success: true, user: safeUser });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    },

    register: (req, res) => {
        const { name, email, password } = req.body;
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const newUser = {
            id: `u_${Date.now()}`,
            name,
            email,
            password,
            phone: ''
        };
        users.push(newUser);

        const { password: _, ...safeUser } = newUser;
        res.json({ success: true, user: safeUser });
    },

    updateProfile: (req, res) => {
        const { id, ...updates } = req.body;
        const userIdx = users.findIndex(u => u.id === id);
        if (userIdx > -1) {
            users[userIdx] = { ...users[userIdx], ...updates };
            const { password, ...safeUser } = users[userIdx];
            res.json({ success: true, user: safeUser });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    }
};
