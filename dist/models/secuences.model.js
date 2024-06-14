"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLevelData = void 0;
function generateLevelData(userLevel) {
    let numberOfKeys;
    let score = 0;
    // Determinar el número de claves y el puntaje basado en el nivel
    if (userLevel >= 0) {
        numberOfKeys = 2 + Math.floor(userLevel / 3); // Empieza con 2 claves y luego 1 clave más cada 3 niveles
        score = 10 + 10 * userLevel; // Puntaje inicial de 10 y aumenta 10 por cada nivel
    }
    else {
        throw new Error('El nivel del usuario no puede ser negativo');
    }
    const keys = generateKeysForLevel(numberOfKeys); // Genera las claves
    return { keys, score };
}
exports.generateLevelData = generateLevelData;
// Función de ejemplo para generar claves para un nivel específico
function generateKeysForLevel(numberOfKeys) {
    const letters = ["i", "9", "o", "0", "p", "+", "a", "z", "s", "x", "d", "c"];
    const keys = [];
    for (let i = 0; i < numberOfKeys; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        keys.push(letters[randomIndex]);
    }
    return keys;
}
