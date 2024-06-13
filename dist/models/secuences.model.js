"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLevelData = void 0;
function generateLevelData(userLevel) {
    let keys = [];
    let score = 0;
    // Añade lógica para generar los datos de acuerdo al nivel seleccionado
    switch (userLevel) {
        case 0:
            keys = generateKeysForLevel(2);
            score = 10;
            break;
        case 1:
            keys = generateKeysForLevel(3);
            score = 20;
            break;
        case 2:
            keys = generateKeysForLevel(3);
            score = 30;
            break;
        case 3:
            keys = generateKeysForLevel(3);
            score = 40;
            break;
        case 4:
            keys = generateKeysForLevel(3);
            score = 50;
            break;
        case 5:
            keys = generateKeysForLevel(3);
            score = 60;
            break;
        case 6:
            keys = generateKeysForLevel(3);
            score = 70;
            break;
        case 7:
            keys = generateKeysForLevel(3);
            score = 80;
            break;
        case 8:
            keys = generateKeysForLevel(3);
            score = 90;
            break;
        case 9:
            keys = generateKeysForLevel(3);
            score = 100;
            break;
    }
    return { keys, score };
}
exports.generateLevelData = generateLevelData;
function generateKeysForLevel(nivel) {
    const letters = ["i", "9", "o", "0", "p", "+", "a", "z", "s", "x", "d", "c"];
    const keys = [];
    for (let i = 0; i < nivel; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        keys.push(letters[randomIndex]);
    }
    return keys;
}
