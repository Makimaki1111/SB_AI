import random
import time
from typing import List, Tuple, Dict
from ai_simulator import BattleSimulator, SimState, SimPlayer

class ShiritoriAI:
    def __init__(self, sb_info_instance, abilities_dict, max_depth=2, max_candidates=10):
        self.sb_info = sb_info_instance
        self.simulator = BattleSimulator(sb_info_instance, abilities_dict)
        self.max_depth = max_depth
        self.max_candidates = max_candidates
        self.time_limit = 1.0 # 1ターンの最大思考時間(秒)

    def evaluate_state(self, state: SimState, is_maximizing: bool) -> float:
        """
        盤面を評価する（点数が高いほどCPUにとって有利）。
        ※CPUは常に「player2」として評価する前提。
        """
        if state.player1_win is True:
            return -10000.0 # CPU負け
        if state.player1_win is False:
            return 10000.0  # CPU勝ち
            
        cpu = state.player2
        player = state.player1
        score = 0.0

        # HP差 (最重要)
        score += (cpu.hp - player.hp) * 10.0
        
        # ステータス差
        score += (cpu.attack_rank + cpu.defense_rank) * 5.0
        score -= (player.attack_rank + player.defense_rank) * 5.0

        # 状態異常・特殊状態
        if player.poison_turns > 0: score += 15.0
        if cpu.poison_turns > 0: score -= 15.0
        if cpu.leech_turns > 0: score += 10.0
        if player.leech_turns > 0: score -= 10.0
        
        # アイテム使用可能回数
        score += (6 - cpu.food_count) * 2.0
        score -= (6 - player.food_count) * 2.0
        score += (5 - cpu.medical_count) * 3.0
        score -= (5 - player.medical_count) * 3.0

        # 次のターン相手に渡す文字の「キツさ」を評価 (相手の手番のとき)
        if not state.player1_turn: 
            # 自分が言葉を使った直後 = 相手の手番 (player1_turn=True) になっているはず
            # 相手が使える単語の数が少ないほど高評価
            next_char = state.character
            candidates = self._get_valid_candidates(next_char, state.used_words, limit=50)
            score -= len(candidates) * 0.1 # 選択肢が多いほどマイナス

        return score if is_maximizing else -score

    def _get_valid_candidates(self, initial: str, used_words: List[str], limit: int = None) -> List[str]:
        """使える単語のリストを取得する"""
        all_candidates = self.sb_info.get_typed_word_candidates(initial)
        valid = [w for w in all_candidates if w not in used_words]
        if limit and len(valid) > limit:
            # ランダムに絞るか、長さでソートするかなど
            # 今回は文字数が長いものを優先しつつランダム性も持たせる簡易ソート
            valid.sort(key=lambda x: len(x) + random.random()*2, reverse=True)
            valid = valid[:limit]
        return valid

    def minimax(self, state: SimState, depth: int, alpha: float, beta: float, is_maximizing: bool, start_time: float) -> float:
        """アルファベータ法を用いたミニマックス探索"""
        if depth == 0 or state.player1_win is not None or (time.time() - start_time) > self.time_limit:
            return self.evaluate_state(state, True) # 常にCPU(Player2)基準のスコアを返すよう統一

        candidates = self._get_valid_candidates(state.character, state.used_words, limit=self.max_candidates)
        
        if not candidates:
            # 打てる手がない = 負け
            return -10000.0 if is_maximizing else 10000.0

        if is_maximizing:
            max_eval = -float('inf')
            for word in candidates:
                new_state = self.simulator.simulate_move(state, word)
                ev = self.minimax(new_state, depth - 1, alpha, beta, False, start_time)
                max_eval = max(max_eval, ev)
                alpha = max(alpha, ev)
                if beta <= alpha:
                    break # ベータカット
            return max_eval
        else:
            min_eval = float('inf')
            for word in candidates:
                new_state = self.simulator.simulate_move(state, word)
                ev = self.minimax(new_state, depth - 1, alpha, beta, True, start_time)
                min_eval = min(min_eval, ev)
                beta = min(beta, ev)
                if beta <= alpha:
                    break # アルファカット
            return min_eval

    def get_best_word(self, current_battle_info) -> str:
        """
        実際の Battle_info オブジェクトを受け取り、最適な単語を返す
        """
        # 現在の状態を SimState にディープコピー
        p1 = current_battle_info.player1
        p2 = current_battle_info.player2
        
        sim_p1 = SimPlayer(
            id=p1.id, hp=p1.hp, attack_rank=p1.attack_rank, defense_rank=p1.defense_rank,
            types=p1.types[:], ability=p1.ability, food_count=p1.food_count, medical_count=p1.medical_count,
            poison_turns=p1.poison_turns, leech_turns=p1.leech_turns
        )
        sim_p2 = SimPlayer(
            id=p2.id, hp=p2.hp, attack_rank=p2.attack_rank, defense_rank=p2.defense_rank,
            types=p2.types[:], ability=p2.ability, food_count=p2.food_count, medical_count=p2.medical_count,
            poison_turns=p2.poison_turns, leech_turns=p2.leech_turns
        )
        
        start_state = SimState(
            player1=sim_p1,
            player2=sim_p2,
            player1_turn=current_battle_info.player1_turn,
            character=current_battle_info.character,
            player1_win=current_battle_info.player1_win,
            used_words=list(current_battle_info.used.keys())
        )

        candidates = self._get_valid_candidates(start_state.character, start_state.used_words, limit=self.max_candidates)
        if not candidates:
            return ""

        best_word = ""
        best_score = -float('inf')
        alpha = -float('inf')
        beta = float('inf')
        start_time = time.time()

        for word in candidates:
            new_state = self.simulator.simulate_move(start_state, word)
            # 次は相手のターン(最小化ノード)
            score = self.minimax(new_state, self.max_depth - 1, alpha, beta, False, start_time)
            
            if score > best_score:
                best_score = score
                best_word = word
                
            alpha = max(alpha, best_score)
            
            # タイムアウトチェック (rootノードでも一応行う)
            if (time.time() - start_time) > self.time_limit and best_word != "":
                break

        # ベストな単語が見つからなかった（どれを選んでも即負け等）場合は最初のものを選ぶ
        if best_word == "":
            best_word = candidates[0]
            
        print(f"[AI] Chosen word: {best_word} (Score: {best_score:.2f}, Time: {time.time()-start_time:.3f}s)")
        return best_word
