export class RNG {
    private seed: number = 12345;

    // Ustawienie ziarna
    public setSeed(s: number) {
        // Zabezpieczenie, by seed nie był 0 (psuje niektóre algorytmy)
        this.seed = s % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    // Zwraca liczbę z zakresu <0, 1) - zamiennik Math.random()
    public next(): number {
        // Prosty algorytm LCG (Park-Miller)
        // seed = (seed * 16807) % 2147483647
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    // Pomocnicza: losowa liczba całkowita <0, max)
    public nextInt(max: number): number {
        return Math.floor(this.next() * max);
    }
}

// Eksportujemy jedną instancję (Singleton), której używa cała gra
export const Random = new RNG();