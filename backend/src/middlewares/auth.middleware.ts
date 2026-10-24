import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { UserPayload } from "../modules/auth/auth.service.js";

// Extension TypeScript : Permet à req.user d'être reconnu sans erreur par le compilateur
declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

// 1. Middleware pour intercepter et valider le jeton JWT
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'NO_TOKEN_PROVIDED',
                message: 'Accès refusé : Aucun jeton d\'authentification fourni.',
            },
        });
    }

    try {
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(token, secret) as UserPayload;

        // On attache l'utilisateur décodé à la requête courante
        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_OR_EXPIRED_TOKEN',
                message: 'Accès refusé : Jeton invalide ou expiré.',
            },
        });
    }
};

// 2. Middleware pour le contrôle d'accès basé sur les rôles (RBAC)
export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                code: 'UNAUTHENTICATED',
                message: 'Veuillez vous authentifier pour continuer.',
                },
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                code: 'FORBIDDEN',
                message: 'Droits insuffisants pour accéder à cette ressource.',
                },
            });
        }

        return next();
    };
};