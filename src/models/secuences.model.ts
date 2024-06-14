import { nivelUsuario } from '../server';

export function generateLevelData(userLevel: number): { keys: string[], score: number } {
    let numberOfKeys: number;
    let score: number = 0;

    // Determinar el número de claves y el puntaje basado en el nivel
    if (userLevel >= 0) {
        numberOfKeys = 2 + Math.floor(userLevel / 3); // Empieza con 2 claves y luego 1 clave más cada 3 niveles
        score = 10 + 10 * userLevel; // Puntaje inicial de 10 y aumenta 10 por cada nivel
    } else {
        throw new Error('El nivel del usuario no puede ser negativo');
    }

    const keys = generateKeysForLevel(numberOfKeys); // Genera las claves

    return { keys, score };
}

// Función de ejemplo para generar claves para un nivel específico
function generateKeysForLevel(numberOfKeys: number): string[] {
    const letters = ["i", "9", "o", "0", "p", "+", "a", "z", "s", "x", "d", "c"];
    const keys: string[] = [];
    for (let i = 0; i < numberOfKeys; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        keys.push(letters[randomIndex]);
    }
    return keys;
}
