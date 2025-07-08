const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = 3000;
// Language Package
const i18n = require('i18n');
const cookieParser = require('cookie-parser');

i18n.configure({
    locales: ['en', 'tr'],
    directory: path.join(__dirname, 'locales'),
    defaultLocale: 'en',
    queryParameter: 'lang',
    cookie: 'lang'
});

const db = new sqlite3.Database('database/events.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('SQLite database connected');
    }
});


// Middleware
app.use(cookieParser());
app.use(i18n.init);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
    })
);
app.use((req, res, next) => {
    res.locals.userName = req.session.userName || null;
    next();
});
// Language w cookies
app.use((req, res, next) => {
    let userLang = req.cookies?.lang;
    if (!userLang) {
        userLang = req.acceptsLanguages('tr', 'en') || 'en';
    }
    if (!['en', 'tr'].includes(userLang)) {
        userLang = 'en';
    }
    res.setLocale(userLang);
    next();
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Authorization-Admin Middleware
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }

    console.log('Unauthorized access attempt:', {
        url: req.originalUrl,
        method: req.method,
        userId: req.session.userId || null,
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'You must be logged in!' });
    }

    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.adminId) {
        return next();
    }

    console.log('Unauthorized admin attempt:', {
        url: req.originalUrl,
        method: req.method,
        adminId: req.session.adminId || null,
    });

    res.redirect('/admin-login');
}

// Language route
app.get('/set-lang/:lang', (req, res) => {
    const lang = req.params.lang;

    if (!['en', 'tr'].includes(lang)) {
        return res.status(400).send('Invalid language selection');
    }
    res.cookie('lang', lang, { maxAge: 900000, httpOnly: true });
    res.setLocale(lang);
    res.redirect('back');
});



// Routes
app.get('/', (req, res) => {
    res.render('index');
});



// Fetch Events (with Pagination)
app.get('/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 10; // Quantity of item limit
    const page = parseInt(req.query.page) || 1;    // Current page
    const offset = (page - 1) * limit;             // Start point of the shown item

    const sql = 'SELECT * FROM Events LIMIT ? OFFSET ?';
    db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching events:', err.message);
            res.status(500).json({ error: 'Failed to fetch events' });
        } else {
            db.get('SELECT COUNT(*) AS count FROM Events', [], (err, result) => {
                if (err) {
                    console.error('Error fetching count:', err.message);
                    res.status(500).json({ error: 'Failed to fetch event count' });
                } else {
                    res.json({
                        events: rows,
                        total: result.count,
                        page: page,
                        totalPages: Math.ceil(result.count / limit),
                    });
                }
            });
        }
    });
});



// Register
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    const { name, surname, email, age } = req.body;

    if (!name || !surname || !email || !age) {
        return res.status(400).send('Please fill all fields.');
    }

    if (isNaN(age) || age <= 0) {
        return res.status(400).send('Age must be a valid positive number.');
    }

    const sql = 'INSERT INTO Users (name, surname, email, age) VALUES (?, ?, ?, ?)';
    db.run(sql, [name, surname, email, age], function (err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).send('Email already exists.');
            }
            console.error('Error registering user:', err.message);
            return res.status(500).send('Server error.');
        }
        res.redirect('/');
    });
});



// Login
app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { name, email } = req.body;

    const sql = 'SELECT * FROM Users WHERE name = ? AND email = ?';
    db.get(sql, [name, email], (err, user) => {
        if (err) {
            console.error('Error during login:', err.message);
            return res.status(500).send('Unexpected error');
        }

        if (!user) {
            return res.status(400).send('Invalid input data');
        }

        req.session.userId = user.id;
        req.session.userName = user.name;

        res.redirect('/');
    });
});



// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err.message);
            return res.status(500).send('Unexpected error');
        }
        res.redirect('/');
    });
});



// Add Event (Authenticated Only)
app.get('/add', isAuthenticated, (req, res) => res.render('add'));

app.post('/add', isAuthenticated, (req, res) => {

    const { name, date, location } = req.body;
    if (!name || !date || !location) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const alphabeticRegex = /^[A-Za-z\s]+$/;
    if (!alphabeticRegex.test(location)) {
        return res.status(400).json({ error: 'Location must contain only alphabetic characters and spaces' });
    }

    const sql = 'INSERT INTO Events (name, date, location) VALUES (?, ?, ?)';
    db.run(sql, [name, date, location], (err) => {
        if (err) {
            console.error('Error adding event:', err.message);
            return res.status(500).json({ error: 'Failed to add event' });
        }
        res.redirect('/');
    });
});



// Edit Event (Authenticated Only)
app.get('/edit/:id', isAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM Events WHERE id = ?';
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching event for edit:', err.message);
            res.redirect('/');
        } else {
            res.render('edit', { eventData: row });
        }
    });
});

app.post('/edit/:id', isAuthenticated, (req, res) => {
    const { name, date, location } = req.body;
    const sql = 'UPDATE Events SET name = ?, date = ?, location = ? WHERE id = ?';
    db.run(sql, [name, date, location, req.params.id], (err) => {
        if (err) {
            console.error('Error updating event:', err.message);
            res.redirect(`/edit/${req.params.id}`);
        } else {
            res.redirect('/');
        }
    });
});



// Delete Event (Authenticated Only)
app.post('/delete/:id', isAuthenticated, (req, res) => {
    const { id: eventId } = req.params;

    db.run('DELETE FROM Events WHERE id = ?', [eventId], function (err) {
        if (err) {
            console.error('Error deleting event:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete the event.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        res.status(200).json({ success: true, message: 'Event deleted' });
    });
});



// Admin Panel Route
app.get('/admin', (req, res) => {
    if (!req.session.adminId) {
        return res.redirect('/admin-login');
    }

    db.all('SELECT * FROM Users', [], (err, users) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.render('admin', { users });
    });
});



// Delete User (Admin Authenticated)
app.post('/admin/delete/:id', isAdmin, (req, res) => {
    const userId = req.params.id;

    db.run('DELETE FROM Users WHERE id = ?', [userId], (err) => {
        if (err) {
            console.error('Error deleting user:', err.message);
            return res.status(500).send('Unexpected error');
        }
        res.redirect('/admin');
    });
});



// Admin Login
app.get('/admin-login', (req, res) => {
    res.render('admin-login', { errorMessage: null }); // Hata mesajı için değişken ekliyoruz
});

app.post('/admin-login', (req, res) => {
    const { name, email } = req.body;

    const sql = 'SELECT * FROM Users WHERE name = ? AND email = ?';
    db.get(sql, [name, email], (err, user) => {
        if (err) {
            console.error('Error during admin login:', err.message);
            return res.status(500).send('Unexpecte error');
        }

        if (!user) {
            return res.render('admin-login', { errorMessage: 'Invalid name or email' });
        }

        // Role value check
        if (user.role !== 'admin') {
            return res.render('admin-login', { errorMessage: 'You are not an admin' });
        }

        req.session.adminId = user.id;
        res.redirect('/admin');
    });
});



// Event Info (Fetch)
app.get('/event-info/:id', (req, res) => {
    const eventId = req.params.id;

    const query = `
        SELECT Users.name AS userName, Participants.participation_date AS participationDate
        FROM Participants
                 JOIN Users ON Participants.user_id = Users.id
        WHERE Participants.event_id = ?`;
    db.all(query, [eventId], (err, rows) => {
        if (err) {
            console.error('Error fetching participants:', err);
            return res.status(500).send([]);
        }

        console.log('Fetched participants:', rows);
        res.json(rows);
    });
});



// Sign Up
app.post('/sign-up/:id', isAuthenticated, (req, res) => {
    const { id: eventId } = req.params;
    const userId = req.session.userId;

    const checkQuery = 'SELECT * FROM Participants WHERE event_id = ? AND user_id = ?';
    db.get(checkQuery, [eventId, userId], (err, row) => {
        if (err) {
            console.error('Error checking participation:', err.message);
            return res.status(500).json({ success: false, message: 'Unexpected error' });
        }

        if (row) {
            return res.status(400).json({ success: false, message: 'You are already signed up for this event' });
        }

        const insertQuery = 'INSERT INTO Participants (event_id, user_id) VALUES (?, ?)';
        db.run(insertQuery, [eventId, userId], function (err) {
            if (err) {
                console.error('Error signing up for event:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to sign up for the event' });
            }
            res.status(200).json({ success: true, message: 'Successfully signed up' });
        });
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
