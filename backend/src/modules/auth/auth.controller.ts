import { Request, Response } from "express";
import { registerUser, loginUser } from "./auth.service.js";

// 1. Contrôleur Inscription
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, first_name, last_name, role } = req.body;

        // Validation des données d'entrée
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'VALIDATION_ERROR',
                    message: 'Tous les champs obligatoires doivent être renseignés.'
                },
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'Le mot de passe doit contenir au moins 8 caractères.'
                },
            });
        }

        const result = await registerUser({ email, password, first_name, last_name, role});

        return res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès.',
            data: result,
        });
    } catch (error: any) {
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: ' Cette adresse email est déjà utilisée.'
                },
            });
        }

        console.error('Erreur register:', error);
        return res.status(500).json({
            success: false,
            error: { 
                code: 'INTERNAL_SERVER_ERROR', 
                message: 'Une erreur interne est survenue.' 
            },
        });
    }
}

// 2. Contrôleur Connexion
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'VALIDATION_ERROR', 
                    message: 'Email et mot de passe requis.' 
                },
            });
        }

        const result = await loginUser(email, password);

        return res.status(200).json({
            success: true,
            message: 'Connexion réussie.',
            data: result,
        });
    } catch (error: any) {
        if (error.message === 'INVALID_CREDENTIALS') {
            return res.status(401).json({
                success: false,
                error: { 
                    code: 'INVALID_CREDENTIALS', 
                    message: 'Email ou mot de passe incorrect.' 
                },
            });
        }

        if (error.message === 'ACCOUNT_DISABLED') {
            return res.status(403).json({
                success: false,
                error: { 
                    code: 'ACCOUNT_DISABLED', 
                    message: 'Ce compte a été désactivé par un administrateur.' 
                },
            });
        }

        console.error('Erreur login:', error);
        return res.status(500).json({
            success: false,
            error: { 
                code: 'INTERNAL_SERVER_ERROR', 
                message: 'Une erreur interne est survenue.' 
            },
        });
    }
}