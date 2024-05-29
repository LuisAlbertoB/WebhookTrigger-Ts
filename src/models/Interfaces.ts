export interface PlayerP {
  id: number;
  name: string;
  score: number;
  lives: number;
}

export interface ConnectedUser {
  name: string | null; // Mantén el nombre como nulo hasta que el usuario lo envíe
}