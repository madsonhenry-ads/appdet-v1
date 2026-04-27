const express = require('express');
const router = express.Router();
const pool = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin, apiLimiter } = require('../middleware');

// ==================== ADMIN API ROUTES ====================

// Admin login
router.post('/api/admin/login', apiLimiter, async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const loginIdentifier = email || username;
        
        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Email/username and password are required' });
        }
        
        let user = null;
        let validPassword = false;
        
        // First, check environment variables for master admin (backward compatibility)
        const envEmail = process.env.ADMIN_EMAIL;
        const envPassword = process.env.ADMIN_PASSWORD;
        
        if (envEmail && envPassword) {
            if (loginIdentifier === envEmail || loginIdentifier.toLowerCase() === envEmail.toLowerCase()) {
                validPassword = password === envPassword;
                if (validPassword) {
                    user = { email: envEmail, role: 'admin', name: 'Administrador Master', id: 0, username: 'admin' };
                    console.log(`✅ Master admin login: ${envEmail}`);
                }
            }
        }
        
        // If not master admin, try database users
        if (!validPassword) {
            const userResult = await pool.query(
                'SELECT * FROM admin_users WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)) AND is_active = true',
                [loginIdentifier]
            );
            
            if (userResult.rows.length > 0) {
                // User found in database
                const dbUser = userResult.rows[0];
                validPassword = await bcrypt.compare(password, dbUser.password_hash);
                
                if (validPassword) {
                    user = dbUser;
                    // Update last login
                    await pool.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [dbUser.id]);
                    console.log(`✅ Database user login: ${dbUser.email} (${dbUser.role})`);
                }
            }
        }
        
        if (!validPassword || !user) {
            console.log(`❌ Failed login attempt for: ${loginIdentifier}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token with user info
        const token = jwt.sign(
            { 
                userId: user.id,
                email: user.email, 
                username: user.username,
                role: user.role,
                name: user.name
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name,
                role: user.role
            },
            expiresIn: '24h'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ==================== USER MANAGEMENT (Admin Only) ====================

// Get all users
router.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, username, email, COALESCE(name, full_name) as name, role, is_active, last_login, created_at
            FROM admin_users
            ORDER BY created_at DESC
        `);
        
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user
router.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, password, name, role } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email and password are required' });
        }
        
        // Validate role
        const allowedRoles = ['admin', 'support', 'viewer'];
        const userRole = allowedRoles.includes(role) ? role : 'support';
        
        // Check if user already exists - with specific error
        const existingEmail = await pool.query(
            'SELECT id FROM admin_users WHERE email = $1',
            [email]
        );
        
        if (existingEmail.rows.length > 0) {
            return res.status(409).json({ error: 'Este email já está cadastrado no sistema' });
        }
        
        const existingUsername = await pool.query(
            'SELECT id FROM admin_users WHERE username = $1',
            [username]
        );
        
        if (existingUsername.rows.length > 0) {
            return res.status(409).json({ error: 'Este username já está em uso' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert new user (use both name and full_name for compatibility)
        const userName = name || username;
        const result = await pool.query(`
            INSERT INTO admin_users (username, email, password_hash, name, full_name, role, is_active, created_by)
            VALUES ($1, $2, $3, $4, $4, $5, true, $6)
            RETURNING id, username, email, COALESCE(name, full_name) as name, role, is_active, created_at
        `, [username, email, hashedPassword, userName, userRole, req.user.userId]);
        
        console.log(`✅ New user created: ${username} (${role}) by admin ${req.user.email}`);
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error creating user:', error);
        
        // Provide more specific error messages
        if (error.code === '23505') {
            // Unique constraint violation
            if (error.constraint && error.constraint.includes('email')) {
                return res.status(409).json({ error: 'Este email já está em uso' });
            }
            if (error.constraint && error.constraint.includes('username')) {
                return res.status(409).json({ error: 'Este username já está em uso' });
            }
            return res.status(409).json({ error: 'Usuário já existe com este email ou username' });
        }
        
        res.status(500).json({ error: 'Falha ao criar usuário: ' + (error.message || 'Erro desconhecido') });
    }
});

// Update user
router.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, is_active, password } = req.body;
        
        // Don't allow modifying the main admin (id = 1) by non-main-admins
        if (parseInt(id) === 1 && req.user.userId !== 1) {
            return res.status(403).json({ error: 'Cannot modify main admin user' });
        }
        
        // Build update query dynamically
        let updates = [];
        let values = [];
        let paramCount = 1;
        
        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (email !== undefined && email.trim()) {
            // Check if email is already in use by another user
            const emailCheck = await pool.query(
                'SELECT id FROM admin_users WHERE email = $1 AND id != $2',
                [email.trim().toLowerCase(), id]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ error: 'Este email já está em uso por outro usuário' });
            }
            updates.push(`email = $${paramCount++}`);
            values.push(email.trim().toLowerCase());
        }
        if (role !== undefined) {
            const allowedRoles = ['admin', 'support', 'viewer'];
            if (allowedRoles.includes(role)) {
                updates.push(`role = $${paramCount++}`);
                values.push(role);
            }
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramCount++}`);
            values.push(hashedPassword);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        values.push(id);
        
        const result = await pool.query(`
            UPDATE admin_users 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username, email, name, role, is_active, created_at
        `, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`✅ User updated: ${id} by admin ${req.user.email}`);
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Don't allow deleting the main admin
        if (parseInt(id) === 1) {
            return res.status(403).json({ error: 'Cannot delete main admin user' });
        }
        
        // Don't allow self-delete
        if (parseInt(id) === req.user.userId) {
            return res.status(403).json({ error: 'Cannot delete your own account' });
        }
        
        const result = await pool.query(
            'DELETE FROM admin_users WHERE id = $1 RETURNING username, email',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`🗑️ User deleted: ${result.rows[0].username} by admin ${req.user.email}`);
        
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Verify password for security-sensitive actions
router.post('/api/admin/verify-password', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.json({ valid: false, message: 'Password required' });
        }
        
        // Check if master admin (from env vars)
        if (req.user.userId === 0 || req.user.email === process.env.ADMIN_EMAIL) {
            // Verify against env password
            const envPassword = process.env.ADMIN_PASSWORD;
            if (password === envPassword) {
                console.log(`🔐 Password verified for master admin: ${req.user.email}`);
                return res.json({ valid: true });
            } else {
                console.log(`❌ Invalid password attempt for master admin: ${req.user.email}`);
                return res.json({ valid: false });
            }
        }
        
        // Check database user
        const result = await pool.query(
            'SELECT password_hash FROM admin_users WHERE id = $1',
            [req.user.userId]
        );
        
        if (result.rows.length === 0) {
            return res.json({ valid: false, message: 'User not found' });
        }
        
        const passwordMatch = await bcrypt.compare(password, result.rows[0].password_hash);
        
        if (passwordMatch) {
            console.log(`🔐 Password verified for user ID: ${req.user.userId}`);
            return res.json({ valid: true });
        } else {
            console.log(`❌ Invalid password attempt for user ID: ${req.user.userId}`);
            return res.json({ valid: false });
        }
        
    } catch (error) {
        console.error('Error verifying password:', error);
        res.status(500).json({ valid: false, error: 'Verification failed' });
    }
});

// Get current user profile
router.get('/api/admin/profile', authenticateToken, async (req, res) => {
    try {
        if (req.user.userId === 0) {
            // Fallback admin from env vars
            return res.json({
                user: {
                    id: 0,
                    username: 'admin',
                    email: req.user.email,
                    name: 'Administrador',
                    role: 'admin'
                }
            });
        }
        
        const result = await pool.query(`
            SELECT id, username, email, name, role, last_login, created_at
            FROM admin_users WHERE id = $1
        `, [req.user.userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update own password
router.put('/api/admin/profile/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        // Get current user
        const userResult = await pool.query(
            'SELECT password_hash FROM admin_users WHERE id = $1',
            [req.user.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
            [hashedPassword, req.user.userId]
        );
        
        console.log(`🔐 Password changed for user ${req.user.email}`);
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
