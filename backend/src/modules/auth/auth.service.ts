import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db.js';

// Types TypeScript pour sécuriser les données manipulées
export interface RegisterDTO {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}

// Rôle attribué à toute inscription publique. Le rôle admin ne s'obtient que par
// promotion d'un administrateur existant (PATCH /api/admin/users/:id/role).
export const PUBLIC_REGISTRATION_ROLE = 'analyst';

export interface UserPayload {
    id: string;
    email: string;
    role: string;
}

// 1. Fonction utilitaire pour générer un JSON Web Token (JWT)
export const generateToken = (user: UserPayload): string => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // Le payload ne contient que des informations publiques d'identification (JAMAIS de mot de passe)
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        secret,
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn']}
    );
};

// 2. Service d'inscription (Register)
export const registerUser = async (data: RegisterDTO) => {
    const normalizedEmail = data.email.toLowerCase().trim();

    // A. Vérifier si l'email existe déjà
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
        throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // B. Hackage du mot de passe avec bcrypt (Salt rounds = 10)
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // C. Insertion sécurisée en base de données avec RETURNING (rôle imposé côté serveur)
    const role = PUBLIC_REGISTRATION_ROLE;
    const insertSql = `
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, role, is_active, created_at
    `;
    
    const result = await query(insertSql, [
        normalizedEmail,
        passwordHash,
        data.first_name.trim(),
        data.last_name.trim(),
        role,
    ]);

    const newUser = result.rows[0];

    // D. Génération du token pour connecter l'utilisateur immédiatement
    const token = generateToken({
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
    });
    
    return { user: newUser, token };
};

// 3. Service de connexion (Login)
export const loginUser = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    // A. Rechercher l'utilisateur par son email
    const result = await query(
        `SELECT id, email, password_hash, first_name, last_name, role, is_active 
        FROM users WHERE email = $1`,
        [normalizedEmail]
    );

    if (result.rows.length === 0) {
        throw new Error('INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // B. Vérifier si le compte n'a pas été désactivé par l'administrateur
    if (!user.is_active) {
        throw new Error('ACCOUNT_DISABLED');
    }

    // C. Vérifier le mot de passe avec bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('INVALID_CREDENTIALS');
    }

    // D. Générer le JWT
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
    });

    // Ne jamais renvoyer le password_hash au client
    const { password_hash, ...safeUser } = user;

    return { user: safeUser, token};
}