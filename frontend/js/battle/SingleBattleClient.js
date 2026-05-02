import { BaseBattleClient } from '../core/BaseBattleClient.js';

export class SingleBattleClient extends BaseBattleClient {
    constructor(ui) {
        super(ui);
    }

    /**
     * マッチング開始 (ユーザー情報を付与)
     */
    startMatch(maxLives = 1) {
        const name = localStorage.getItem("sb_username") || "名無し";
        const ability = localStorage.getItem("sb_ability") || "";
        const ability_2 = localStorage.getItem("sb_ability_2") || "";

        this.send({
            type: "find_match",
            info: {
                player_id: this.playerId,
                max_lives: maxLives,
                name: name,
                ability: ability,
                ability_2: ability_2
            }
        });
    }

    /**
     * CPU戦開始
     */
    startCpuBattle(p1MaxLives = 1, p2MaxLives = 1) {
        const name = localStorage.getItem("sb_username") || "名無し";
        const ability = localStorage.getItem("sb_ability") || "";
        const ability_2 = localStorage.getItem("sb_ability_2") || "";

        this.send({
            type: "make_new_battle",
            info: {
                player1_id: this.playerId,
                player2_id: "cpu",
                p1_max_lives: p1MaxLives,
                p2_max_lives: p2MaxLives,
                name: name,
                ability: ability,
                ability_2: ability_2
            }
        });
    }

    // シングルバトル特有の終了処理
    handleClose() {
        super.handleClose();
        // 必要に応じてタイトルに戻る等の処理
    }
}
