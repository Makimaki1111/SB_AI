import os
import torch
import numpy as np

try:
    from ai_dl_env import ShiritoriNet
    from ai_self_play import DL_AI_Agent
except ImportError:
    from backend.ai_dl_env import ShiritoriNet
    from backend.ai_self_play import DL_AI_Agent

class ProductionAIAgent:
    """本番環境 (battle.py) でディープラーニングモデルを動かすためのラッパークラス"""
    _instance = None
    _model_loaded = False
    
    @classmethod
    def get_instance(cls, sb_info, abilities):
        if cls._instance is None:
            cls._instance = cls(sb_info, abilities)
        return cls._instance

    def __init__(self, sb_info, abilities):
        self.sb_info = sb_info
        self.abilities = abilities
        
        # デバイスの決定 (推論時もGPUが使えれば使うが、通常サーバー稼働ではCPUが多い)
        self.device = "cpu"
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
            
        print(f"[Production AI] Initializing Shiritori Deep Learning AI on {self.device}...")
        
        self.net = ShiritoriNet().to(self.device)
        self.net.eval()
        
        # 学習済みモデルの読み込み
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "shiritori_ai_model.pth")
        
        if os.path.exists(model_path):
            try:
                self.net.load_state_dict(torch.load(model_path, map_location=self.device))
                print(f"[Production AI] Successfully loaded model weights from {model_path}")
                ProductionAIAgent._model_loaded = True
            except Exception as e:
                print(f"[Production AI] Failed to load model: {e}")
        else:
            print(f"[Production AI] Default random-initialized model will be used. ({model_path} not found)")
            
        # 本番用のエージェント構成 (推論シミュレーション回数を指定。50だと0.X秒、500だと数秒)
        self.dl_agent = DL_AI_Agent(self.net, self.sb_info, self.abilities, device=self.device, num_simulations=50)

    def get_best_word(self, battle_info) -> str:
        from ai_simulator import SimState, SimPlayer
        
        # 現在のbattle_infoの状態をシミュレータ用(SimState)に変換
        p1 = battle_info.player1
        p2 = battle_info.player2
        
        sim_p1 = SimPlayer(
            id=p1.id, hp=p1.hp, attack_rank=p1.attack_rank, defense_rank=p1.defense_rank,
            types=p1.types[:], ability=p1.ability, ability_change_count=p1.ability_change_count, food_count=p1.food_count, medical_count=p1.medical_count,
            poison_turns=p1.poison_turns, leech_turns=p1.leech_turns
        )
        sim_p2 = SimPlayer(
            id=p2.id, hp=p2.hp, attack_rank=p2.attack_rank, defense_rank=p2.defense_rank,
            types=p2.types[:], ability=p2.ability, ability_change_count=p2.ability_change_count, food_count=p2.food_count, medical_count=p2.medical_count,
            poison_turns=p2.poison_turns, leech_turns=p2.leech_turns
        )
        
        state = SimState(
            player1=sim_p1,
            player2=sim_p2,
            player1_turn=battle_info.player1_turn,
            character=battle_info.character,
            player1_win=battle_info.player1_win,
            used_words=list(battle_info.used.keys()),
            last_turn_damage=battle_info.last_turn_damage if hasattr(battle_info, 'last_turn_damage') else 0,
            last_turn_word_length=battle_info.last_turn_word_length if hasattr(battle_info, 'last_turn_word_length') else 0
        )
        
        # MCTSを実行して最も勝率が高い(選ばれやすい)手を決める
        # 本番推論時は最強手を選びたいので temperature=0.0 (Greedy)
        my_id = p1.id if battle_info.player1_turn else p2.id
        
        # 本番環境では相手の特性は見えないため、MCTSシミュレーションに伝える必要がある。
        # 今回のMCTSは「もし相手がこの特性だったら」を推測するのではなく、完全に未知（0ベクトル）として扱うようにする。
        # DL_AI_Agent 側でも StateEncoder の hide_foe_ability 機能を使えるように本来は改造が必要だが、
        # 簡易的には self._hide_foe_ability のようなフラグを渡すか、MCTS中に自分支点なら隠す処理を入れる。
        
        words, probs = self.dl_agent.get_action_probabilities(state, my_id, temperature=0.0, hide_foe_ability=True)
        
        if not words:
            return ""
            
        # 確率が一番高いものを選ぶ
        best_word = words[np.argmax(probs)]
        
        return best_word
