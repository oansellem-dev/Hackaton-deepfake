import express from 'express';

// La route du test du reflet de l'écran vit désormais dans le routeur candidat (candidate.ts) :
// POST /api/check/:token/flash, autorisée dans la fenêtre qui suit la vérification du visage.
// Ce routeur vide est conservé pour l'historique ; il ne déclare plus de route.
export const flashRouter = express.Router();
