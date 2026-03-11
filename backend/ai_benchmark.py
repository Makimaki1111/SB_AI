import sys
import time
from SB_info import SB_info
from copy import deepcopy

# battle.pyに必要なオブジェクトをロード
from battle import Battle_info, Player, get_default_abilities
from ai_agent import ShiritoriAI

class BenchmarkRunner:
    def __init__(self, num_games=1):
        print("Loading SB_info...")
        self.sb_info = SB_info("dic/word_data.csv")
        self.abilities = get_default_abilities()
        self.ai = ShiritoriAI(self.sb_info, self.abilities, max_depth=2, max_candidates=10)
        self.num_games = num_games
        self.results = {"ai_win": 0, "random_win": 0, "draws": 0}
        self.total_turns = 0

    def run_match(self, match_id: int):
        # AIはPlayer2として参加する (Battle_infoの仕様)
        battle = Battle_info(
            player1_id="random_ai",
            player2_id="minimax_ai",
            sb_info=self.sb_info,
            room_id=f"bench_{match_id}"
        )
        
        # CPUフラグを立てておく (Random AIはこれを使って動かすため)
        battle.is_cpu = True
        
        # ランダムに先攻後攻を決める (Battle_info内で既に random.random() < 0.5 されているのでそのまま使う)
        
        print(f"\n--- Match {match_id+1}/{self.num_games} ---")
        print(f"P1 (Random) Ability: {battle.abilities[battle.player1.ability].name}")
        print(f"P2 (Minimax) Ability: {battle.abilities[battle.player2.ability].name}")
        print(f"First character: {battle.character}")
        print(f"First Turn: {'Random AI' if battle.player1_turn else 'Minimax AI'}")

        turns = 0
        while battle.player1_win is None and turns < 200:
            if battle.player1_turn:
                # Random AI (Player 1)
                word = self._get_random_ai_word(battle)
                if not word:
                    battle.player1_win = False # 降参
                    print(f"Turn {turns}: Random AI could not find a word. Minimax AI wins!")
                    break
                print(f"Turn {turns}: Random AI plays '{word}'")
                battle.try_attack(battle.player1.id, word)
            else:
                # Minimax AI (Player 2)
                start_time = time.time()
                word = self.ai.get_best_word(battle)
                print(f"Turn {turns}: Minimax AI plays '{word}' in {time.time()-start_time:.3f}s")
                if not word:
                    battle.player1_win = True
                    print(f"Turn {turns}: Minimax AI could not find a word. Random AI wins!")
                    break
                battle.try_attack(battle.player2.id, word)
            
            turns += 1

        self.total_turns += turns
        
        if battle.player1_win is True:
            self.results["random_win"] += 1
            print(f"Result: Random AI Wins in {turns} turns. P1 HP: {battle.player1.hp}, P2 HP: {battle.player2.hp}")
        elif battle.player1_win is False:
            self.results["ai_win"] += 1
            print(f"Result: Minimax AI Wins in {turns} turns. P1 HP: {battle.player1.hp}, P2 HP: {battle.player2.hp}")
        else:
            self.results["draws"] += 1
            print("Result: Draw (Turn Limit)")

    def _get_random_ai_word(self, battle: Battle_info):
        """現在のシングルバトルのCPUと同じロジック"""
        candidates = self.sb_info.get_typed_word_candidates(battle.character)
        for word in candidates:
            if word not in battle.used:
                return word
        return ""

    def run_all(self):
        start_time = time.time()
        for i in range(self.num_games):
            self.run_match(i)
            
        print("\n================================")
        print(" Benchmark Results")
        print("================================")
        print(f"Total Matches: {self.num_games}")
        print(f"Minimax AI (P2) Wins: {self.results['ai_win']} ({(self.results['ai_win']/self.num_games)*100:.1f}%)")
        print(f"Random AI (P1) Wins:  {self.results['random_win']} ({(self.results['random_win']/self.num_games)*100:.1f}%)")
        print(f"Draws: {self.results['draws']}")
        print(f"Average Turns per Match: {self.total_turns / self.num_games:.1f}")
        print(f"Total Time: {time.time() - start_time:.2f}s")
        print("================================")

if __name__ == "__main__":
    Runner = BenchmarkRunner(num_games=1)
    Runner.run_all()
