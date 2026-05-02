import { BaseBattleClient } from '../core/BaseBattleClient.js';

export class SingleBattleClient extends BaseBattleClient {
    constructor(ui) {
        super(ui);
    }

    /**
     * マッチング開始（バックエンドへの最初のアクション）
     */
    startMatch(maxLives = 1) {
        if (!this.playerId) {
            this.playerId = localStorage.getItem("sb_player_id");
        }
        const name = localStorage.getItem("sb_username") || "名無し";
        const ability = localStorage.getItem("sb_ability") || "";
        const ability_2 = localStorage.getItem("sb_ability_2") || "";

        this.sock.send(JSON.stringify({
            type: "find_match",
            info: { 
                player_id: this.playerId, 
                max_lives: maxLives,
                name: name,
                ability: ability,
                ability_2: ability_2
            }
        }));
    }

    /**
     * CPU戦の開始
     */
    startCpuBattle(p1MaxLives = 1, p2MaxLives = 1) {
        if (!this.playerId) {
            this.playerId = localStorage.getItem("sb_player_id");
        }
        const name = localStorage.getItem("sb_username") || "名無し";
        const ability = localStorage.getItem("sb_ability") || "";
        const ability_2 = localStorage.getItem("sb_ability_2") || "";

        this.sock.send(JSON.stringify({
            type: "make_new_battle",
            info: {
                player_id: this.playerId,
                player2_id: "cpu",
                p1_max_lives: p1MaxLives,
                p2_max_lives: p2MaxLives,
                name: name,
                ability: ability,
                ability_2: ability_2
            }
        }));
    }

    /**
     * プライベートルームへの参加
     */
    joinPrivateRoom(roomId, p1MaxLives = 1, p2MaxLives = 1) {
        this.sock.send(JSON.stringify({
            type: "join_private_room",
            info: {
                player_id: this.playerId,
                room_id: roomId,
                p1_max_lives: p1MaxLives,
                p2_max_lives: p2MaxLives
            }
        }));
    }
}
