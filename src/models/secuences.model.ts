// Definición de la interfaz SecuenceSongs
export interface SecuenceSongs {
    id: number;
    orden1: string;
    orden2: string;
    orden3: string;
    orden4: string;
    orden5: string;
    orden6: string;
    orden7: string;
    orden8: string;
    orden9: string;
    orden10: string;
    orden11: string;
    orden12: string;
}

// Exportación de las constantes
export const selectedKeys1 = ["2", "2", "2", "3", "e", "r", "q", "t", "e", "q", "7", "u"];
export const selectedKeys2 = ["3", "2", "3", "3", "3", "r", "5", "5", "6", "t", "7", "q"];
export const selectedKeys3 = ["2", "2", "2", "2", "2", "2", "2", "2", "2", "2", "2", "q"];
export const selectedKeys4 = ["q", "p", "q", "p", "q", "p", "q", "p", "q", "p", "q", "6"];
export const selectedKeys5 = ["q", "2", "w", "3", "e", "r", "5", "t", "6", "y", "7", "q"];

// Ejemplo de cómo podrías crear un objeto que implemente la interfaz SecuenceSongs
export const secuenceSongsExample: SecuenceSongs = {
    id: 1,
    orden1: selectedKeys1[0],
    orden2: selectedKeys1[1],
    orden3: selectedKeys1[2],
    orden4: selectedKeys1[3],
    orden5: selectedKeys1[4],
    orden6: selectedKeys1[5],
    orden7: selectedKeys1[6],
    orden8: selectedKeys1[7],
    orden9: selectedKeys1[8],
    orden10: selectedKeys1[9],
    orden11: selectedKeys1[10],
    orden12: selectedKeys1[11],
};
