import { AppConfig } from '../Config';

export interface GameStats {
    totalMoves: number;             
    invalidMoves: number;           
    totalThinkingTime: number;      
    highestCascade: number;         
    matchCounts: { [size: number]: number }; 
    colorClears: { [typeId: number]: number };
}

export class StatsManager {
    public data: GameStats;
    public enabled: boolean = false;

    constructor() {
        this.data = this.createEmptyStats();
    }

    private createEmptyStats(): GameStats {
        const stats: GameStats = {
            totalMoves: 0,
            invalidMoves: 0,
            totalThinkingTime: 0,
            highestCascade: 0,
            matchCounts: { 3: 0, 4: 0, 5: 0 }, 
            colorClears: {}
        };
        for(let i=0; i < AppConfig.blockTypes; i++) stats.colorClears[i] = 0;
        return stats;
    }

    public reset() {
        this.data = this.createEmptyStats();
    }

    public recordMove(isValid: boolean) {
        if (!this.enabled) return;
        if (isValid) this.data.totalMoves++;
        else this.data.invalidMoves++;
    }

    public recordThinkingTime(dt: number) {
        if (!this.enabled) return;
        this.data.totalThinkingTime += dt;
    }

    public recordCascade(depth: number) {
        if (!this.enabled) return;
        if (depth > this.data.highestCascade) {
            this.data.highestCascade = depth;
        }
    }

    public recordMatch(typeId: number, size: number) {
        if (!this.enabled) return;
        
        if (this.data.colorClears[typeId] !== undefined) {
            this.data.colorClears[typeId]++;
        }
        
        if (size >= 5) this.data.matchCounts[5]++;
        else if (size === 4) this.data.matchCounts[4]++;
        else if (size === 3) this.data.matchCounts[3]++;
    }
}