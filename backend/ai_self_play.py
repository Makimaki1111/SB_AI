import torch
import numpy as np
import random
import time
from typing import List, Tuple
from copy import deepcopy

from ai_simulator import BattleSimulator, SimState, SimPlayer
from ai_dl_env import ShiritoriNet, StateEncoder, CHAR_TO_IDX, NUM_CHARS

class MCTSTreeNode:
    def __init__(self, state: SimState, parent=None, prior_prob=1.0):
        self.state = state
        self.parent = parent
        self.children = {}  # {word: MCTSTreeNode}
        self.visits = 0
        self.value_sum = 0.0
        self.prior_prob = prior_prob
        self.is_expanded = False

    def value(self) -> float:
        if self.visits == 0:
            return 0.0
        return self.value_sum / self.visits

class DL_AI_Agent:
    """ニューラルネットワークを使ったMCTSベースのAIエージェント"""
    def __init__(self, net: ShiritoriNet, sb_info, abilities, device="cpu", num_simulations=50):
        self.net = net
        self.net.eval()
        self.device = device
        self.sb_info = sb_info
        self.simulator = BattleSimulator(sb_info, abilities)
        self.num_simulations = num_simulations

    def _get_valid_candidates(self, initial: str, used_words: List[str], limit=50) -> List[str]:
        all_candidates = self.sb_info.get_typed_word_candidates(initial)
        valid = [w for w in all_candidates if w not in used_words]
        if len(valid) > limit:
            valid.sort(key=lambda x: len(x) + random.random()*1.5, reverse=True)
            valid = valid[:limit]
        return valid

    def get_action_probabilities(self, root_state: SimState, my_id: str, temperature=1.0, hide_foe_ability=False) -> Tuple[List[str], np.ndarray]:
        """
        現在の盤面からMCTSを実行し、各単語の選択確率（Policy Target）を返す。
        """
        root = MCTSTreeNode(root_state)
        
        # MCTS シミュレーションループ
        for _ in range(self.num_simulations):
            node = root
            search_path = [node]
            
            # 1. Selection (選択)
            while node.is_expanded and len(node.children) > 0:
                # UCB1 アッパーコンフィデンスバウンド
                best_ucb = -float('inf')
                best_word = None
                best_child = None
                
                for word, child in node.children.items():
                    # U = c * P * sqrt(N_parent) / (1 + N_child)
                    u = 1.0 * child.prior_prob * np.sqrt(node.visits) / (1 + child.visits)
                    q = child.value()
                    ucb = q + u
                    if ucb > best_ucb:
                        best_ucb = ucb
                        best_word = word
                        best_child = child
                
                node = best_child
                search_path.append(node)
                
            # 2. Expansion (展開) & Evaluation (評価)
            value = 0.0
            if node.state.player1_win is not None:
                # 終端状態
                # 自分(my_id)の勝利なら1.0、敗北なら-1.0
                am_p1 = (node.state.player1.id == my_id)
                value = 1.0 if node.state.player1_win == am_p1 else -1.0
            else:
                # ニューラルネットワークで評価
                encoded = StateEncoder.encode(node.state, my_id, hide_foe_ability=hide_foe_ability)
                inp = torch.tensor(encoded, dtype=torch.float32).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    pol_probs, val = self.net(inp)
                    
                value = val.item()
                policy = pol_probs[0].cpu().numpy()
                
                # 子ノードの展開
                candidates = self._get_valid_candidates(node.state.character, node.state.used_words)
                if candidates:
                    for word in candidates:
                        # Policy Headから、その単語の「最後の文字」の優先度を事前確率として使う
                        last_char = self.sb_info.get_next_initial(word)
                        prior = policy[CHAR_TO_IDX[last_char]] if last_char in CHAR_TO_IDX else 1.0 / NUM_CHARS
                        
                        next_state = self.simulator.simulate_move(node.state, word)
                        node.children[word] = MCTSTreeNode(next_state, parent=node, prior_prob=prior)
                    node.is_expanded = True
                else:
                    # 選べる単語がない = 負け
                    value = -1.0
            
            # 3. Backpropagation (バックプロパゲーション)
            # 各ノードの視点で価値を反転させながら戻す
            for n in reversed(search_path):
                n.value_sum += value
                n.visits += 1
                value = -value # ターン交代ごとの反転

        # シミュレーション終了後、訪問回数に応じたProbability Distributionを作成
        words = []
        visits = []
        for word, child in root.children.items():
            words.append(word)
            visits.append(child.visits)
            
        if not words:
            return [], np.array([])
            
        visits = np.array(visits, dtype=np.float32)
        
        if temperature == 0:
            # Greedy: 最大訪問回数のものを1.0にする
            probs = np.zeros_like(visits)
            probs[np.argmax(visits)] = 1.0
        else:
            # Temperature適用
            visits = visits ** (1.0 / temperature)
            probs = visits / np.sum(visits)
            
        return words, probs

def generate_self_play_data(net: ShiritoriNet, sb_info, abilities, num_games=10, device="cpu"):
    """自己対戦を行って、学習用データ (状態, Policy, 結果Value) のペアを生成する"""
    agent = DL_AI_Agent(net, sb_info, abilities, device=device, num_simulations=50) # ここを増やせば強くなるが遅くなる
    training_data = [] # List[(np.ndarray state_encoded, np.ndarray policy_target, float value_target)]
    
    print(f"Starting Self-Play for {num_games} games...")
    start_all = time.time()
    
    for g in range(num_games):
        # 簡易的にGame開始状態を作成
        # AIがあらゆる特性への対策を学習できるように、ランダムに特性を付与する
        ability_list = list(abilities.keys()) if abilities else [""]
        p1_ab = random.choice(ability_list) if ability_list else ""
        p2_ab = random.choice(ability_list) if ability_list else ""
        
        p1 = SimPlayer(id="ai_1", hp=60, attack_rank=0, defense_rank=0, types=[""], ability=p1_ab, ability_change_count=2, food_count=0, medical_count=0, poison_turns=0, leech_turns=0)
        p2 = SimPlayer(id="ai_2", hp=60, attack_rank=0, defense_rank=0, types=[""], ability=p2_ab, ability_change_count=2, food_count=0, medical_count=0, poison_turns=0, leech_turns=0)
        
        state = SimState(
            player1=p1, player2=p2, player1_turn=True, character=random.choice("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"),
            player1_win=None, used_words=[]
        )
        
        game_history = [] # List[(SimState, str current_player_id, List[str] words, np.ndarray probs)]
        
        turn = 0
        while state.player1_win is None and turn < 100:
            current_id = state.player1.id if state.player1_turn else state.player2.id
            
            # 温度パラメータ (序盤は探索のために高め、終盤は0にして最強手を選ぶ)
            temp = 1.0 if turn < 15 else 0.1
            
            words, probs = agent.get_action_probabilities(state, my_id=current_id, temperature=temp)
            
            if not words:
                state.player1_win = not state.player1_turn
                break
                
            # MCTSの分布に従って単語を選択
            chosen_word = np.random.choice(words, p=probs)
            
            # 学習用に状態を保存
            game_history.append((deepcopy(state), current_id, words, probs))
            
            state = agent.simulator.simulate_move(state, chosen_word)
            turn += 1
            
        # 試合終了。勝敗(+1 or -1)を各ターンに割り当てる
        print(f"Game {g+1}/{num_games} finished in {turn} turns. Winner: {'P1' if state.player1_win else 'P2'}")
        
        for hist_state, p_id, hist_words, hist_probs in game_history:
            # 勝敗は、そのターンのプレイヤーから見た結果
            am_p1 = (p_id == hist_state.player1.id)
            z = 1.0 if state.player1_win == am_p1 else -1.0
            
            encoded_state = StateEncoder.encode(hist_state, p_id)
            
            # Policy Target作成 (NUM_CHARS の確率分布にする。選んだ単語の末尾文字の確率を上げる)
            # 本来は出力ニューロンと1対1にするが、今回は「次に渡す文字への優先度」を学習させる
            policy_target = np.zeros(NUM_CHARS, dtype=np.float32)
            for w, prob in zip(hist_words, hist_probs):
                last_char = sb_info.get_next_initial(w)
                if last_char in CHAR_TO_IDX:
                    policy_target[CHAR_TO_IDX[last_char]] += prob
            
            training_data.append((encoded_state, policy_target, z))
            
    print(f"Generated {len(training_data)} training samples in {time.time()-start_all:.1f}s")
    return training_data

if __name__ == "__main__":
    from SB_info import SB_info
    from battle import get_default_abilities
    
    sb_info = SB_info()
    abilities = get_default_abilities()
    net = ShiritoriNet()
    
    # テストとして2試合だけ回してみる
    data = generate_self_play_data(net, sb_info, abilities, num_games=2)
    print("Example data point:", data[0][0].shape, data[0][1].shape, data[0][2])
